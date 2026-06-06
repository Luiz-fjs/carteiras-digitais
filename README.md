# AccessChain

Sistema de controle de acesso para salas de agremiações universitárias baseado em **DIDs** (Decentralized Identifiers) e **VCs** (Verifiable Credentials), conforme padrão W3C.

## Pré-requisitos

- Node.js 20+
- Docker Desktop

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Subir banco de dados
docker compose up -d

# 3. Criar tabelas e gerar Prisma client
cd apps/api
npx prisma db push
npx prisma generate

# 4. Popular banco com issuers e salas
npx tsx prisma/seed.ts

# 5. Voltar à raiz e iniciar todos os serviços
cd ../..
npm run dev:api &     # API em localhost:3000
npm run dev:portal &  # Portal do Issuer em localhost:3001
npm run dev:wallet &  # Carteira Digital em localhost:3002
npm run dev:terminal  # Terminal da Sala em localhost:3003
```

## URLs

| App | URL | Descrição |
|-----|-----|-----------|
| API | http://localhost:3000 | Backend NestJS |
| Portal do Issuer | http://localhost:3001 | Emissão de credenciais |
| Carteira Digital | http://localhost:3002 | Wallet do aluno (gera QR Code) |
| Terminal da Sala | http://localhost:3003 | Fechadura (lê QR Code com câmera) |
| pgAdmin | http://localhost:5050 | Administração do banco |

## Fluxo de uso

1. Abra a **Carteira Digital** (3002) → copie seu DID   
2. Abra o **Portal do Issuer** (3001) → selecione UNIFESP → emita uma credencial de Aluno com o DID copiado
3. No Portal, selecione uma agremiação (CodeBloco, AAJA, etc.) → emita uma credencial de Membro
4. Volte à **Carteira Digital** → clique "Atualizar" → veja suas credenciais
5. Clique "Apresentar na porta" → selecione a sala → gere o QR Code
6. Abra o **Terminal da Sala** (3003) → modo Câmera → aponte o QR Code para a webcam
7. O terminal verifica e mostra ACESSO LIBERADO ou NEGADO
