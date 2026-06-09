# AccessChain

Sistema de controle de acesso para salas de agremiações universitárias baseado em **DIDs** (Decentralized Identifiers) e **VCs** (Verifiable Credentials), conforme padrão W3C.

A ideia é trocar a fechadura tradicional (cartão / digital / chave) por uma verificação **descentralizada**: o aluno carrega suas credenciais em uma carteira digital no próprio celular, e prova que tem direito de entrar em uma sala sem precisar consultar nenhum banco central na hora da entrada — o terminal valida a assinatura criptográfica da credencial localmente.

---

## Visão geral

O projeto é um **monorepo** com 4 aplicações independentes que se comunicam entre si:

| App | Porta | Quem usa | O que faz |
|-----|-------|----------|-----------|
| **API** (NestJS) | 3000 | — | Backend que emite credenciais, gera nonces e verifica apresentações. |
| **Portal do Issuer** | 3001 | UNIFESP, agremiações | Emite credenciais (`StudentCredential`, `MembershipCredential`) para um DID. |
| **Carteira Digital** | 3002 | Aluno | Gera o DID do aluno, guarda credenciais, gera QR Code / código copia-e-cola para apresentar na porta. |
| **Terminal da Sala** | 3003 | Fechadura / porteiro | Lê o QR Code (câmera **ou** colando o código) e libera ou nega o acesso. |

O fluxo de confiança é:

```
UNIFESP  ──emite──▶  StudentCredential (aluno)
Agremiação ──emite──▶  MembershipCredential (membro)
                                   │
                                   ▼
                      Carteira do aluno (browser)
                                   │
                  assina uma VP (Verifiable Presentation)
                                   │
                            QR Code / código
                                   │
                                   ▼
                    Terminal da Sala  ──verifica──▶  libera / nega
```

---

## Pré-requisitos

- **Node.js 20+**
- Não precisa Docker — o projeto usa SQLite por padrão (arquivo `apps/api/prisma/dev.db`).

---

## Setup (primeira vez)

### 1. Criar o `.env` na raiz

Crie um arquivo `.env` na raiz do repositório com:

```
DATABASE_URL=file:./dev.db
API_PORT=3000
JWT_SECRET=dev-secret-change-in-production
ISSUER_KEY_ENCRYPTION_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
NEXT_PUBLIC_API_URL=http://localhost:3000
```

> O `ISSUER_KEY_ENCRYPTION_SECRET` precisa ser **64 caracteres hexadecimais** (32 bytes). O valor acima serve só para desenvolvimento.

### 2. Instalar dependências

```bash
npm install
```

### 3. Preparar o banco

```bash
cd apps/api
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts   # popula UNIFESP + agremiações + salas
cd ../..
```

> Se já existe um `apps/api/prisma/dev.db` populado, **pule o seed** (rodar de novo pode duplicar dados).

---

## Rodar (dia-a-dia)

Depois do setup, basta subir os 4 serviços. **Abra 4 janelas do terminal** na raiz do projeto e rode um em cada:

```bash
npm run dev:api       # API           → http://localhost:3000
npm run dev:portal    # Portal Issuer → http://localhost:3001
npm run dev:wallet    # Carteira      → http://localhost:3002
npm run dev:terminal  # Terminal      → http://localhost:3003
```

Espere cada um terminar de subir antes de testar (a API precisa estar online primeiro).

> No Windows o `&` do bash não funciona em PowerShell — por isso 4 janelas separadas. No Linux/Mac dá pra encadear com `&` mesmo.

---

## URLs

| App | URL |
|-----|-----|
| API | http://localhost:3000 |
| Portal do Issuer | http://localhost:3001 |
| Carteira Digital | http://localhost:3002 |
| Terminal da Sala | http://localhost:3003 |

---

## Fluxo de uso (end-to-end)

1. **Carteira Digital** (`:3002`) — abre e copia o **DID** gerado para o aluno.
2. **Portal do Issuer** (`:3001`):
   - Seleciona **UNIFESP** → emite **StudentCredential** para o DID copiado.
   - Seleciona uma **agremiação** (CodeBloco, AAAJA, etc.) → emite **MembershipCredential** para o mesmo DID.
3. Volta à **Carteira** → clica **"Atualizar"** → as duas credenciais aparecem listadas.
4. Clica **"Apresentar na porta"** em uma credencial → escolhe a sala → clica **"Gerar QR Code para acesso"**.
   - O QR Code aparece **junto com um código copia-e-cola** (estilo Pix), com botão **Copiar**.
   - O código expira em 5 minutos.
5. **Terminal da Sala** (`:3003`) — escolha um dos modos no toggle do topo:
   - **Câmera** → clica em **"Iniciar leitura"**, autoriza a câmera, aponta para o QR.
   - **Colar** → cola o código (ou clica **"Colar da área de transferência"**) → **"Verificar"**.
   - **Simulação** → modo demo, não precisa da carteira.
6. O terminal exibe **ACESSO LIBERADO** ✅ ou **NEGADO** ❌ com o motivo, e registra no log lateral.

---

## Modos de apresentação no terminal

Adicionamos duas formas de entregar a credencial na porta:

- **QR Code** — recomendado quando você tem câmera funcional no terminal e o aluno está fisicamente presente com o celular.
- **Copia-e-cola** — quando a câmera falha (sem permissão, navegador sem suporte, IP em rede local sem HTTPS) ou para testes manuais no próprio computador.

Os dois caminhos usam **a mesma rota de verificação na API** (`POST /presentations/verify`), validando assinatura, nonce, escopo da sala e revogação.

---

## Notas sobre a câmera

- Navegadores **só liberam câmera em `https://` ou em `localhost`**. Se você acessar o terminal pelo IP da rede no celular (ex.: `192.168.x.x:3003`), a câmera **não funciona** — use o modo **Colar** ou exponha via `ngrok`/`mkcert` para ter HTTPS.
- Em laptops com câmera frontal, o `html5-qrcode` tenta primeiro a traseira (`facingMode: { exact: 'environment' }`) e cai para qualquer câmera disponível se a traseira não existir.

---

## Arquitetura (resumo técnico)

- **DIDs**: método `did:key` com chaves Ed25519 (`@noble/ed25519`).
- **VCs / VPs**: assinadas como JWT (`jose`), seguindo o data model W3C VC 1.1.
- **Anti-replay**: a API emite um **nonce** por sala via `POST /presentations/nonce`; a carteira embute esse nonce na VP; o terminal envia tudo de volta em `POST /presentations/verify`. Nonces são single-use e expiram em segundos.
- **Chaves privadas dos issuers**: cifradas em AES-256 no banco usando `ISSUER_KEY_ENCRYPTION_SECRET`.
- **Banco**: SQLite via Prisma. O `schema.prisma` define `Issuer`, `Room`, `Credential`, `VisitorApproval`, `AccessLog`, `Nonce`.

---

## Estrutura do repositório

```
.
├── apps/
│   ├── api/                  # NestJS — backend
│   ├── issuer-portal/        # Next.js — Portal do Issuer
│   ├── holder-wallet/        # Next.js — Carteira Digital
│   └── verifier-terminal/    # Next.js — Terminal da Sala
├── packages/
│   ├── crypto/               # primitivas DID/VC/VP compartilhadas
│   └── shared-types/         # tipos TypeScript compartilhados
└── docker-compose.yml        # (opcional) Postgres + pgAdmin, não usado por padrão
```

---

## Troubleshooting rápido

| Problema | O que fazer |
|----------|-------------|
| `npm run dev:api` quebra com erro de Prisma | Verifique o `.env` — `DATABASE_URL=file:./dev.db`, não Postgres. |
| API derruba na inicialização com erro de hex | `ISSUER_KEY_ENCRYPTION_SECRET` precisa ter 64 chars hex (0-9a-f). |
| Câmera abre mas não lê o QR | Confira se está em `localhost` ou `https://`. Em rede local sem HTTPS, use o modo **Colar**. |
| `'cameraIdOrConfig' should have exactly 1 key` | Já corrigido — atualize para a versão atual do `QRScanner.tsx`. |
| QR expirou antes de ler | Clica em **"Gerar novo QR Code"** na carteira. Validade padrão: 5 minutos. |
| Seed duplicou dados | Apague `apps/api/prisma/dev.db` e rode `npx prisma db push && npx tsx prisma/seed.ts` de novo. |
