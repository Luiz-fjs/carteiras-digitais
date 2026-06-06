"""
ISSUER -- Servidor da Agremiação

Responsabilidades:
  - Manter a chave privada que assina todas as credenciais
  - Publicar a chave pública via JWKS (/.well-known/jwks.json)
  - Cadastrar membros e suas chaves públicas
  - Emitir Verifiable Credentials no formato SD-JWT VC
  - Revogar credenciais
  - Servir o status de cada membro (para verificação de revogação)
"""

import base64
import json
import time
import uuid

import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

app = FastAPI(title="Issuer -- Agremiação", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Chave do Issuer -- gerada uma vez ao iniciar o servidor
# Em produção: carregar de arquivo ou HSM
# ---------------------------------------------------------------------------
ISSUER_PRIVATE_KEY = Ed25519PrivateKey.generate()
ISSUER_PUBLIC_KEY = ISSUER_PRIVATE_KEY.public_key()
ISSUER_URL = "http://localhost:8000"
KID = "agremiacao-key-1"

# ---------------------------------------------------------------------------
# "Banco de dados" em memória -- suficiente para a demo
# ---------------------------------------------------------------------------
members: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Schemas de entrada
# ---------------------------------------------------------------------------
class NewMember(BaseModel):
    name: str
    matricula: str
    pub_key_jwk: dict       # chave pública Ed25519 do estudante (JWK)
    rooms: list[str]        # ex: ["sala-a", "sala-b"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def issuer_public_jwk() -> dict:
    raw = ISSUER_PUBLIC_KEY.public_bytes(Encoding.Raw, PublicFormat.Raw)
    return {
        "kty": "OKP",
        "crv": "Ed25519",
        "kid": KID,
        "use": "sig",
        "x": b64url_encode(raw),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def index():
    rows = "".join(
        f"<tr>"
        f"<td>{mid}</td>"
        f"<td>{m['name']}</td>"
        f"<td>{m['matricula']}</td>"
        f"<td>{', '.join(m['rooms'])}</td>"
        f"<td>{'[OK] Ativo' if m['active'] else '[ERRO] Revogado'}</td>"
        f"</tr>"
        for mid, m in members.items()
    )
    return f"""
    <html><head><title>Issuer -- Painel</title>
    <style>
      body {{ font-family: sans-serif; padding: 2rem; }}
      table {{ border-collapse: collapse; width: 100%; }}
      th, td {{ border: 1px solid #ccc; padding: 8px; text-align: left; }}
      th {{ background: #f0f0f0; }}
    </style></head>
    <body>
    <h1>Issuer -- Painel da Agremiação</h1>
    <h3>Membros cadastrados</h3>
    <table>
      <tr><th>ID</th><th>Nome</th><th>Matrícula</th><th>Salas</th><th>Status</th></tr>
      {rows if rows else "<tr><td colspan='5'>Nenhum membro ainda</td></tr>"}
    </table>
    <br>
    <a href="/docs">-> Ver API (Swagger)</a>
    </body></html>
    """


@app.get("/.well-known/jwks.json", summary="Chave pública do Issuer (JWKS)")
def jwks():
    """
    Qualquer Verifier pode buscar aqui a chave pública para verificar
    assinaturas das credenciais. Não requer autenticação -- é público.
    """
    return {"keys": [issuer_public_jwk()]}


@app.post("/members", summary="Cadastrar novo membro")
def add_member(data: NewMember):
    """
    Administrador da agremiação cadastra um estudante.
    Recebe a chave pública do estudante (gerada na wallet).
    """
    holder_id = str(uuid.uuid4())
    members[holder_id] = {
        "name": data.name,
        "matricula": data.matricula,
        "pub_key_jwk": data.pub_key_jwk,
        "rooms": data.rooms,
        "active": True,
        "credential_ids": [],
    }
    return {"holder_id": holder_id, "message": f"Membro {data.name} cadastrado"}


@app.get("/members", summary="Listar membros")
def list_members():
    return {
        mid: {k: v for k, v in m.items() if k != "pub_key_jwk"}
        for mid, m in members.items()
    }


@app.post("/issue/{holder_id}", summary="Emitir credencial para um membro")
def issue_credential(holder_id: str):
    """
    Emite uma Verifiable Credential no formato SD-JWT VC.

    O payload contém:
      - iss: identificador do Issuer
      - sub: identificador do holder (estudante)
      - cnf: chave pública do holder (Holder Binding)
      - rooms: salas autorizadas
      - exp: expiração em 24 horas
      - jti: ID único desta credencial
    """
    if holder_id not in members:
        raise HTTPException(404, "Membro não encontrado")

    m = members[holder_id]

    if not m["active"]:
        raise HTTPException(403, "Membro revogado -- não é possível emitir nova credencial")

    cred_id = str(uuid.uuid4())
    now = int(time.time())

    payload = {
        # Campos padrão JWT
        "iss": ISSUER_URL,
        "sub": holder_id,
        "iat": now,
        "exp": now + 86400,      # 24 horas
        "jti": cred_id,
        # Tipo da credencial (SD-JWT VC)
        "vct": "AccessCredential",
        # Claims da credencial
        "name": m["name"],
        "matricula": m["matricula"],
        "rooms": m["rooms"],
        # Holder Binding -- vincula a credencial à chave pública do estudante
        # Sem isso, qualquer um que copie o JWT poderia usá-lo
        "cnf": {
            "jwk": m["pub_key_jwk"]
        },
        # Referência para verificação de revogação
        "status_uri": f"{ISSUER_URL}/status/{holder_id}",
    }

    # Assina com Ed25519 usando a chave privada do Issuer
    token = jwt.encode(
        payload,
        ISSUER_PRIVATE_KEY,
        algorithm="EdDSA",
        headers={"kid": KID, "typ": "vc+sd-jwt"},
    )

    members[holder_id]["credential_ids"].append(cred_id)

    print(f"[ISSUER] [OK] Credencial emitida para {m['name']} (jti={cred_id[:8]}...)")

    return {
        "sd_jwt_vc": token,
        "holder_id": holder_id,
        "credential_id": cred_id,
        "expires_in": "24 horas",
    }


@app.get("/status/{holder_id}", summary="Verificar status de revogação")
def check_status(holder_id: str):
    """
    Verifier consulta este endpoint para saber se a credencial
    do estudante foi revogada. Retorna active=true se válido.
    """
    if holder_id not in members:
        return {"active": False, "reason": "holder não encontrado"}
    m = members[holder_id]
    return {
        "active": m["active"],
        "holder_id": holder_id,
        "name": m["name"],
    }


@app.delete("/revoke/{holder_id}", summary="Revogar credencial de um membro")
def revoke_member(holder_id: str):
    """
    Administrador remove o membro da agremiação.
    A partir deste momento, qualquer apresentação de credencial
    deste holder será rejeitada pelo Verifier.
    """
    if holder_id not in members:
        raise HTTPException(404, "Membro não encontrado")
    members[holder_id]["active"] = False
    name = members[holder_id]["name"]
    print(f"[ISSUER] [NEGADO] Credencial de {name} revogada")
    return {"revoked": True, "holder_id": holder_id, "name": name}
