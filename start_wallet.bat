@echo off
echo Iniciando Wallet (servidor HTTP) na porta 3000...
echo Abra o browser em: http://localhost:3000
cd wallet
python -m http.server 3000
