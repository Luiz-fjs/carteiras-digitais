"""
run_demo.py -- Inicia Issuer + Verifier e executa a demo completa.

Uso: python run_demo.py
"""

import asyncio
import threading
import time

import uvicorn


def start_issuer():
    config = uvicorn.Config("issuer.main:app", host="127.0.0.1", port=8000, log_level="warning")
    uvicorn.Server(config).run()


def start_verifier():
    config = uvicorn.Config("verifier.main:app", host="127.0.0.1", port=8001, log_level="warning")
    uvicorn.Server(config).run()


if __name__ == "__main__":
    # Sobe os servidores em threads daemon (morrem junto com o processo principal)
    threading.Thread(target=start_issuer,  daemon=True).start()
    threading.Thread(target=start_verifier, daemon=True).start()

    print("Aguardando servidores iniciarem...")
    time.sleep(2)

    # Importa e executa a demo
    from demo import run_demo
    asyncio.run(run_demo())
