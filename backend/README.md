# Ijuí City Lab — Backend

API REST que recebe os formulários de contato e propostas de projeto do site
e expõe duas áreas autenticadas:

- **`/portal`** — participantes (proponentes de projeto) cadastram conta, enviam
  propostas e acompanham o status.
- **`/admin`** — equipe administrativa do Ijuí City Lab gerencia contatos,
  propostas, participantes e a própria equipe.

## Stack

- Node.js (>= 18) + Express
- SQLite via `better-sqlite3` (arquivo único, zero configuração)
- Autenticação JWT (`jsonwebtoken`) com hash de senha `bcryptjs`
- Rate limiting nas rotas públicas e de autenticação

## Setup

```bash
cd backend
cp .env.example .env
# edite .env: defina JWT_SECRET e as credenciais do admin inicial
npm install
npm start
```

Acessos:

- Site público: <http://localhost:3000/>
- Portal do participante: <http://localhost:3000/portal>
- Administração: <http://localhost:3000/admin>
- Health check: <http://localhost:3000/api/health>

O servidor cria a base SQLite em `backend/data/icl.sqlite` na primeira execução
e gera o primeiro administrador a partir das variáveis `ADMIN_EMAIL` /
`ADMIN_PASSWORD` definidas no `.env`. Esses valores só são usados se ainda não
houver um usuário com aquele e-mail.

## Endpoints

### Públicos

| Método | Rota | Função |
|---|---|---|
| `POST` | `/api/contact` | Envia mensagem do formulário de contato |
| `POST` | `/api/proposals` | Submete proposta anônima (sem login) |
| `POST` | `/api/auth/register` | Cria conta de participante |
| `POST` | `/api/auth/login` | Login do participante |
| `POST` | `/api/auth/admin/login` | Login do administrador |
| `GET`  | `/api/options` | Lista valores válidos de área/perfil/estágio |

### Participante (header `Authorization: Bearer <token>`)

| Método | Rota | Função |
|---|---|---|
| `GET`    | `/api/me` | Perfil do participante autenticado |
| `PATCH`  | `/api/me` | Atualiza nome/empresa/CNPJ/telefone |
| `POST`   | `/api/me/password` | Troca de senha |
| `GET`    | `/api/me/proposals` | Lista as próprias propostas |
| `POST`   | `/api/me/proposals` | Submete nova proposta (vinculada ao usuário) |
| `GET`    | `/api/me/proposals/:id` | Detalhe da própria proposta |
| `PATCH`  | `/api/me/proposals/:id` | Edita a proposta (somente enquanto `submitted`) |
| `DELETE` | `/api/me/proposals/:id` | Remove a proposta (somente enquanto `submitted`) |

### Admin (header `Authorization: Bearer <token>` de role `admin`)

| Método | Rota | Função |
|---|---|---|
| `GET`    | `/api/admin/stats` | KPIs (contagem por status etc.) |
| `GET`    | `/api/admin/contacts` | Lista contatos (filtra por `?status=`) |
| `PATCH`  | `/api/admin/contacts/:id` | Muda status / observações internas |
| `DELETE` | `/api/admin/contacts/:id` | Remove contato |
| `GET`    | `/api/admin/proposals` | Lista propostas (filtra por `?status=`) |
| `GET`    | `/api/admin/proposals/:id` | Detalhe completo da proposta |
| `PATCH`  | `/api/admin/proposals/:id` | Muda status / observações internas |
| `DELETE` | `/api/admin/proposals/:id` | Remove proposta |
| `GET`    | `/api/admin/participants` | Lista participantes cadastrados |
| `DELETE` | `/api/admin/participants/:id` | Remove participante |
| `POST`   | `/api/admin/admins` | Adiciona novo administrador |

## Estados (status)

- **Propostas:** `submitted` → `under_review` → `approved` / `rejected` / `archived`
- **Contatos:** `new` → `read` → `replied` / `archived`

O participante só consegue editar/excluir uma proposta enquanto ela estiver
em `submitted`. A partir do momento em que a equipe muda o status, a proposta
fica em modo leitura para o proponente — alterações passam pela equipe.

## Esquema de dados

`users`, `contacts`, `proposals` — definidas em `src/db.js` e criadas
automaticamente no primeiro start. A coluna `proposals.user_id` é `NULL`
para submissões feitas pelo formulário público (sem login).

## Deploy

Como é um único processo Node + arquivo SQLite, dá para rodar em qualquer
host (Render, Fly, Railway, VPS). Em produção:

1. Defina `JWT_SECRET` forte e único.
2. Restrinja `CORS_ORIGIN` ao domínio do site.
3. Sirva atrás de HTTPS (reverse proxy ou plataforma).
4. Faça backup periódico de `backend/data/icl.sqlite`.
