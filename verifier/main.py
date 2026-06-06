"""
VERIFIER -- Dispositivo na Porta

Endpoints principais:
  GET  /room/{room_id}/challenge  -- retorna o challenge atual da sala (para a interface da porta)
  GET  /room/{room_id}/events     -- eventos recentes (acesso liberado/negado)
  POST /verify                    -- valida a Verifiable Presentation
"""

import base64
import time
import uuid
from collections import deque

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
import pathlib

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

DOOR_HTML = pathlib.Path(__file__).parent / "door.html"

app = FastAPI(title="Verifier -- Dispositivo na Porta", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ISSUER_URL   = "http://localhost:8000"
VERIFIER_URL = "http://localhost:8001"
NONCE_TTL    = 60

# nonces de uso único: nonce -> {room_id, at}
active_nonces: dict[str, dict] = {}

# challenge persistente por sala: room_id -> {nonce, at}
# a interface da porta sempre mostra o mesmo nonce até ele ser usado ou expirar
room_challenges: dict[str, dict] = {}

# log de eventos (últimos 50)
access_log: deque = deque(maxlen=50)

_issuer_jwk_cache: dict | None = None
_issuer_jwk_cached_at: float = 0
JWKS_CACHE_TTL = 300


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def b64url_decode(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


async def get_issuer_public_key() -> Ed25519PublicKey:
    global _issuer_jwk_cache, _issuer_jwk_cached_at
    now = time.time()
    if _issuer_jwk_cache is None or (now - _issuer_jwk_cached_at) > JWKS_CACHE_TTL:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{ISSUER_URL}/.well-known/jwks.json", timeout=5)
        resp.raise_for_status()
        _issuer_jwk_cache = resp.json()["keys"][0]
        _issuer_jwk_cached_at = now
    return Ed25519PublicKey.from_public_bytes(b64url_decode(_issuer_jwk_cache["x"]))


def get_or_create_room_challenge(room_id: str) -> dict:
    """Retorna o challenge ativo da sala, ou cria um novo se expirado/inexistente."""
    now = time.time()
    existing = room_challenges.get(room_id)

    if existing:
        nonce = existing["nonce"]
        age   = now - existing["at"]
        # ainda é válido e ainda está nos nonces ativos
        if age < NONCE_TTL and nonce in active_nonces:
            return existing

    # cria novo challenge
    nonce = str(uuid.uuid4())
    challenge = {"nonce": nonce, "room_id": room_id, "at": now, "aud": VERIFIER_URL}
    room_challenges[room_id] = challenge
    active_nonces[nonce] = {"room_id": room_id, "at": now}
    return challenge


def log_event(room_id: str, holder_name: str, access: str, reason: str = ""):
    access_log.append({
        "ts": time.time(),
        "room_id": room_id,
        "holder_name": holder_name,
        "access": access,   # "granted" | "denied"
        "reason": reason,
    })


# ---------------------------------------------------------------------------
# Interface visual da porta
# ---------------------------------------------------------------------------

@app.get("/door", response_class=FileResponse, summary="Interface visual da porta")
def door_ui():
    """Abre a interface da maçaneta no browser."""
    return FileResponse(DOOR_HTML, media_type="text/html")


# ---------------------------------------------------------------------------
# Endpoints da interface da porta
# ---------------------------------------------------------------------------

@app.get("/room/{room_id}/challenge", summary="Challenge atual da sala (para a interface da porta)")
def room_challenge(room_id: str):
    """
    Retorna o nonce atual da sala. A interface da porta chama este endpoint
    periodicamente para exibir um QR Code atualizado.
    """
    ch = get_or_create_room_challenge(room_id)
    return {
        "nonce":      ch["nonce"],
        "room_id":    room_id,
        "aud":        VERIFIER_URL,
        "expires_in": max(0, int(NONCE_TTL - (time.time() - ch["at"]))),
    }


@app.get("/room/{room_id}/events", summary="Eventos recentes da sala")
def room_events(room_id: str, since: float = 0.0):
    """
    Retorna eventos de acesso da sala desde o timestamp 'since'.
    A interface da porta faz polling deste endpoint para animar a porta.
    """
    events = [e for e in access_log if e["room_id"] == room_id and e["ts"] > since]
    return {"events": events, "server_time": time.time()}


# ---------------------------------------------------------------------------
# Endpoint legado de challenge (usado pelo demo.py)
# ---------------------------------------------------------------------------

@app.get("/challenge/{room_id}", summary="Gerar challenge (compatibilidade com demo.py)")
def generate_challenge(room_id: str):
    ch = get_or_create_room_challenge(room_id)
    return {
        "nonce": ch["nonce"],
        "room_id": room_id,
        "aud": VERIFIER_URL,
        "expires_in": NONCE_TTL,
    }


# ---------------------------------------------------------------------------
# Validação principal
# ---------------------------------------------------------------------------

class PresentationRequest(BaseModel):
    vp_token: str


@app.post("/verify", summary="Verificar Verifiable Presentation")
async def verify_presentation(data: PresentationRequest):
    parts = data.vp_token.split("~")
    if len(parts) < 2:
        raise HTTPException(400, "Formato invalido: esperado <SD-JWT>~<KB-JWT>")

    sd_jwt_vc = parts[0]
    kb_jwt    = parts[-1]

    # 1. chave publica do Issuer
    try:
        issuer_pub_key = await get_issuer_public_key()
    except Exception as e:
        raise HTTPException(502, f"Nao foi possivel obter JWKS: {e}")

    # 2. valida assinatura da VC
    try:
        vc_payload = jwt.decode(
            sd_jwt_vc, issuer_pub_key,
            algorithms=["EdDSA"], options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Credencial expirada")
    except jwt.InvalidSignatureError:
        raise HTTPException(401, "Assinatura da VC invalida")
    except Exception as e:
        raise HTTPException(401, f"VC invalida: {e}")

    holder_id   = vc_payload.get("sub", "")
    holder_name = vc_payload.get("name", "Desconhecido")
    rooms       = vc_payload.get("rooms", [])

    # 3. revogacao
    try:
        async with httpx.AsyncClient() as client:
            st = await client.get(f"{ISSUER_URL}/status/{holder_id}", timeout=5)
        if not st.json().get("active", False):
            log_event("?", holder_name, "denied", "Credencial revogada")
            raise HTTPException(403, "Credencial revogada")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Erro ao verificar revogacao: {e}")

    # 4. Key Binding JWT
    holder_jwk = vc_payload.get("cnf", {}).get("jwk", {})
    if not holder_jwk:
        raise HTTPException(400, "Holder Binding ausente (cnf.jwk)")

    try:
        raw_holder    = b64url_decode(holder_jwk["x"])
        holder_pubkey = Ed25519PublicKey.from_public_bytes(raw_holder)
        kb_payload    = jwt.decode(
            kb_jwt, holder_pubkey,
            algorithms=["EdDSA"], options={"verify_aud": False},
        )
    except Exception as e:
        raise HTTPException(401, f"Key Binding invalido: {e}")

    # 5. nonce
    nonce = kb_payload.get("nonce", "")
    if nonce not in active_nonces:
        raise HTTPException(401, "Nonce invalido ou ja utilizado (replay attack?)")

    nonce_data = active_nonces.pop(nonce)

    if time.time() - nonce_data["at"] > NONCE_TTL:
        raise HTTPException(401, "Nonce expirado")

    room_id = nonce_data["room_id"]

    # 6. autorizacao para a sala
    if room_id not in rooms:
        log_event(room_id, holder_name, "denied", f"Sem permissao para {room_id}")
        raise HTTPException(403, f"Sem permissao para '{room_id}'. Autorizado: {rooms}")

    # ACESSO LIBERADO
    log_event(room_id, holder_name, "granted")
    print(f"[VERIFIER] PORTA ABERTA -- {holder_name} -> {room_id}")

    return {
        "access": "granted",
        "room": room_id,
        "holder_name": holder_name,
        "holder_id": holder_id,
        "message": f"Bem-vindo, {holder_name}! Acesso a {room_id} liberado.",
    }
