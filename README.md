# IjuiCityLab

Site institucional do **Ijuí City Lab** — laboratório urbano de inovação e
sandbox regulatório no bairro São Geraldo (Ijuí/RS).

## Estrutura

| Pasta / arquivo | Função |
|---|---|
| `ijui-city-lab.html`, `styles.css`, `script.js`, `site-data.js` | Site público (single page) |
| `portal/` | Área do participante — envio e acompanhamento de propostas |
| `admin/` | Área administrativa — equipe do Ijuí City Lab |
| `backend/` | API Node.js + SQLite que recebe os formulários e atende as duas áreas |

## Como rodar

```bash
cd backend
cp .env.example .env   # edite JWT_SECRET e credenciais do admin
npm install
npm start
```

Aberto em <http://localhost:3000/> — o backend também serve as páginas
estáticas (`/`, `/portal`, `/admin`).

Detalhes de endpoints e modelo de dados em [`backend/README.md`](backend/README.md).
