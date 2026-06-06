"""
DEMO -- Fluxo completo end-to-end

Executa todos os passos do sistema automaticamente:
  1. Gera chaves do estudante (simula a wallet)
  2. Cadastra o estudante no Issuer
  3. Emite a Verifiable Credential
  4. Busca challenge do Verifier (nonce)
  5. Gera a Verifiable Presentation (assina o nonce)
  6. Envia ao Verifier -> porta abre
  7. Testa replay attack -> deve falhar
  8. Revoga a credencial
  9. Tenta acesso com credencial revogada -> deve falhar

Pré-requisito: Issuer (porta 8000) e Verifier (porta 8001) rodando.
"""

import asyncio
import base64
import time

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

ISSUER   = "http://localhost:8000"
VERIFIER = "http://localhost:8001"

SEP  = "-" * 60
SEP2 = "=" * 60


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_kb_jwt(private_key: Ed25519PrivateKey, nonce: str, aud: str) -> str:
    """Cria o Key Binding JWT -- prova de posse da chave privada do holder."""
    headers  = {"alg": "EdDSA", "typ": "kb+jwt"}
    payload  = {"nonce": nonce, "aud": aud, "iat": int(time.time())}
    return jwt.encode(payload, private_key, algorithm="EdDSA", headers=headers)


def print_step(n: int, title: str):
    print(f"\n{SEP}")
    print(f"  PASSO {n} -- {title}")
    print(SEP)


def print_result(label: str, value):
    if isinstance(value, str) and len(value) > 80:
        print(f"  {label}: {value[:60]}...")
    else:
        print(f"  {label}: {value}")


async def run_demo():
    print(f"\n{SEP2}")
    print("  DEMO -- Controle de Acesso com Identidade Digital")
    print(f"{SEP2}")

    async with httpx.AsyncClient() as c:

        # ==================================================================
        # PASSO 1 -- Gerar chaves do estudante (papel da Wallet)
        # ==================================================================
        print_step(1, "Gerar chaves Ed25519 do estudante (Wallet)")

        priv_key = Ed25519PrivateKey.generate()
        pub_key  = priv_key.public_key()
        pub_raw  = pub_key.public_bytes(Encoding.Raw, PublicFormat.Raw)

        pub_jwk = {
            "kty": "OKP",
            "crv": "Ed25519",
            "x": b64url(pub_raw),
        }
        print("  [OK] Par de chaves gerado")
        print(f"  Chave pública (x): {pub_jwk['x'][:40]}...")
        print("  [AVISO]  Chave privada: fica apenas na wallet (nunca sai)")

        # ==================================================================
        # PASSO 2 -- Cadastrar membro no Issuer
        # ==================================================================
        print_step(2, "Administrador cadastra o estudante no Issuer")

        r = await c.post(f"{ISSUER}/members", json={
            "name": "João da Silva",
            "matricula": "2021001234",
            "pub_key_jwk": pub_jwk,
            "rooms": ["scitec-jr", "enactus-unifesp-sjc"],
        })
        r.raise_for_status()
        holder_id = r.json()["holder_id"]
        print(f"  [OK] Membro cadastrado")
        print_result("  holder_id", holder_id)
        print("  Salas autorizadas: scitec-jr, enactus-unifesp-sjc")

        # ==================================================================
        # PASSO 3 -- Issuer emite a Verifiable Credential
        # ==================================================================
        print_step(3, "Issuer emite a Verifiable Credential (SD-JWT VC)")

        r = await c.post(f"{ISSUER}/issue/{holder_id}")
        r.raise_for_status()
        sd_jwt_vc = r.json()["sd_jwt_vc"]
        print("  [OK] Credencial emitida e armazenada na wallet")
        print_result("  SD-JWT VC", sd_jwt_vc)
        print("  Contém: nome, matrícula, salas, expiração, cnf.jwk (Holder Binding)")

        # ==================================================================
        # PASSO 4 -- Estudante chega à porta -> Verifier emite challenge
        # ==================================================================
        print_step(4, "Estudante chega à porta -> Verifier gera challenge (nonce)")

        r = await c.get(f"{VERIFIER}/challenge/scitec-jr")
        r.raise_for_status()
        challenge = r.json()
        nonce  = challenge["nonce"]
        aud    = challenge["aud"]
        print(f"  [OK] Challenge gerado pelo Verifier")
        print_result("  nonce", nonce)
        print(f"  Expira em: {challenge['expires_in']}s")
        print("  (Em produção: exibido como QR Code na porta)")

        # ==================================================================
        # PASSO 5 -- Wallet assina o nonce -> gera Verifiable Presentation
        # ==================================================================
        print_step(5, "Wallet assina o nonce -> Verifiable Presentation")

        kb_jwt   = make_kb_jwt(priv_key, nonce, aud)
        vp_token = f"{sd_jwt_vc}~{kb_jwt}"

        print("  [OK] Key Binding JWT assinado com chave privada do estudante")
        print("  Formato VP: SD-JWT VC ~ KB-JWT")
        print_result("  VP Token", vp_token)

        # ==================================================================
        # PASSO 6 -- Verifier valida a VP -> porta abre
        # ==================================================================
        print_step(6, "Verifier valida a VP -> decisão de acesso")

        r = await c.post(f"{VERIFIER}/verify", json={"vp_token": vp_token})
        result = r.json()

        if r.status_code == 200:
            print(f"\n  +==================================+")
            print(f"  |  [OK]  PORTA ABERTA                |")
            print(f"  |  {result['message'][:34]:<34}|")
            print(f"  +==================================+")
        else:
            print(f"  [ERRO] ACESSO NEGADO: {result}")

        # ==================================================================
        # PASSO 7 -- Testa replay attack (reusar o mesmo VP)
        # ==================================================================
        print_step(7, "ATAQUE: Replay attack -- reusar o mesmo VP Token")

        r2 = await c.post(f"{VERIFIER}/verify", json={"vp_token": vp_token})
        if r2.status_code != 200:
            print(f"  [OK] Replay attack bloqueado corretamente!")
            print(f"  Motivo: {r2.json().get('detail')}")
        else:
            print(f"  [ERRO] FALHA DE SEGURANÇA: replay attack funcionou!")

        # ==================================================================
        # PASSO 8 -- Administrador revoga o membro
        # ==================================================================
        print_step(8, "Administrador revoga a credencial do estudante")

        r = await c.delete(f"{ISSUER}/revoke/{holder_id}")
        r.raise_for_status()
        print(f"  [OK] Credencial revogada: {r.json()}")

        # ==================================================================
        # PASSO 9 -- Tenta acesso com credencial revogada
        # ==================================================================
        print_step(9, "Tenta acesso com credencial revogada -> deve falhar")

        r = await c.get(f"{VERIFIER}/challenge/scitec-jr")
        challenge2 = r.json()
        kb_jwt2    = make_kb_jwt(priv_key, challenge2["nonce"], challenge2["aud"])
        vp_token2  = f"{sd_jwt_vc}~{kb_jwt2}"

        r3 = await c.post(f"{VERIFIER}/verify", json={"vp_token": vp_token2})
        if r3.status_code == 403:
            print(f"  [OK] Acesso negado corretamente após revogação!")
            print(f"  Motivo: {r3.json().get('detail')}")
        else:
            print(f"  [ERRO] FALHA: acesso concedido mesmo com credencial revogada!")

    # ==================================================================
    # RESUMO
    # ==================================================================
    print(f"\n{SEP2}")
    print("  RESUMO -- Conceitos demonstrados")
    print(SEP2)
    conceitos = [
        ("Verifiable Credential (SD-JWT VC)", "Credencial assinada pelo Issuer"),
        ("Assinatura Ed25519",               "Verificação criptográfica de autenticidade"),
        ("Holder Binding (cnf.jwk)",         "VC vinculada à chave pública do estudante"),
        ("Key Binding JWT",                  "Prova de posse da chave privada na apresentação"),
        ("Nonce (anti-replay)",              "Cada apresentação usa um nonce único"),
        ("Revogação",                        "Issuer pode invalidar credenciais a qualquer momento"),
        ("JWKS",                             "Chave pública do Issuer consultada pelo Verifier"),
        ("Expiração (exp)",                  "Credencial com tempo de vida limitado"),
    ]
    for conceito, desc in conceitos:
        print(f"  [OK] {conceito:<35} -- {desc}")
    print()


if __name__ == "__main__":
    asyncio.run(run_demo())
