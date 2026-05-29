# GSM-AI v2 — Phone Intelligence Platform

AI-powered smartphone research. 24,786 phones. Natural language search. Side-by-side comparison. Redis caching. All free services.

---

## Stack

| Layer        | Tech                                          | Cost  |
|---|---|---|
| Frontend     | React 18, Vite, Tailwind CSS, Zustand         | Free  |
| Backend      | Node.js 20, Express, ESM                      | Free  |
| Database     | PostgreSQL 16 (JSONB + tsvector + GIN)        | Free  |
| Cache        | Redis 7 (LRU, 128mb cap)                     | Free  |
| Vector DB    | ChromaDB                                      | Free  |
| AI Chat      | Groq — Llama 3.3 70B                         | Free  |
| Embeddings   | HuggingFace — all-MiniLM-L6-v2               | Free  |
| Deploy       | Railway (backend+db) + Vercel (frontend)      | Free  |

---

## Quickstart — Docker (recommended)

```bash
git clone <repo> && cd gsm-ai

# 1. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — add GROQ_API_KEY and HF_API_KEY

# 2. Place your dataset
cp /path/to/dataset.csv backend/dataset.csv

# 3. Start everything
docker-compose up --build

# 4. Import the dataset (in a new terminal)
docker-compose exec backend node scripts/runImport.js
```

- Frontend → http://localhost
- Backend  → http://localhost:5000
- ChromaDB → http://localhost:8000

---

## Local Dev (no Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis 7: `brew install redis && redis-server`
- ChromaDB: `pip install chromadb && chroma run --path ./chroma-data`

### Backend
```bash
cd backend
cp .env.example .env        # fill in keys
npm install

# Create DB and schema
createdb gsmai
psql gsmai < db/schema.sql

# Start dev server
npm run dev                 # nodemon, port 5000

# Import dataset (separate terminal)
cp /path/to/dataset.csv ./dataset.csv
npm run import
```

### Frontend
```bash
cd frontend
npm install
npm run dev                 # Vite, port 5173
```

---

## Environment Variables

```env
# backend/.env
PORT=5000
FRONTEND_URL=http://localhost:5173

DB_USER=postgres
DB_HOST=localhost
DB_NAME=gsmai
DB_PASS=yourpassword
DB_PORT=5432

# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=32_char_minimum_random_string
JWT_REFRESH_SECRET=another_32_char_minimum_random_string

# groq.com → free, no card
GROQ_API_KEY=gsk_...

# huggingface.co/settings/tokens → free read token
HF_API_KEY=hf_...

CHROMA_PATH=http://localhost:8000
REDIS_URL=redis://localhost:6379
DATASET_PATH=./dataset.csv
```

---

## API Reference

### Auth
| Method | Route           | Body                        | Description          |
|---|---|---|---|
| POST   | /auth/register  | name, email, password       | Register             |
| POST   | /auth/login     | email, password             | Login                |
| POST   | /auth/refresh   | —                           | Refresh access token |
| POST   | /auth/logout    | —                           | Logout               |

### Chat
| Method | Route           | Body / Query                | Description          |
|---|---|---|---|
| POST   | /chat           | { message }                 | AI chat with RAG     |
| POST   | /chat/compare   | { phoneA, phoneB }          | Compare two phones   |
| GET    | /chat/history   | ?limit=20&offset=0          | Chat history         |
| DELETE | /chat/history   | —                           | Clear history        |

### User
| Method | Route                     | Description                  |
|---|---|---|
| GET    | /user/phones/search       | Full-text search (?q=&page=) |
| GET    | /user/phones/brands       | All brand names              |
| GET    | /user/phones/:id          | Full specs for one phone     |
| GET    | /user/favorites           | User's saved phones          |
| POST   | /user/favorites/:phoneId  | Save a phone                 |
| DELETE | /user/favorites/:phoneId  | Remove a phone               |
| GET    | /user/recommendations     | AI-based recommendations     |

### Admin (admin role only)
| Method | Route                  | Description                  |
|---|---|---|
| GET    | /admin/stats           | System overview stats        |
| GET    | /admin/import-runs     | Import history               |
| GET    | /admin/embed-status    | Embedding queue status       |
| POST   | /admin/import          | Trigger CSV import           |
| POST   | /admin/embed           | Process embedding queue      |
| DELETE | /admin/cache           | Flush Redis cache            |
| GET    | /admin/phones          | Browse phones (?q=&page=)    |
| GET    | /admin/phones/:id      | Full specs                   |
| GET    | /admin/users           | List users (?page=)          |
| PATCH  | /admin/users/:id/role  | Promote/demote user          |

---

## Database Schema

```
users            id, email, password_hash, name, role, refresh_token
phones           id, brand, model, url, specs (JSONB), search_vec (TSVECTOR)
chat_history     id, user_id, message, response, cached, model
favorite_phones  id, user_id, phone_id  [UNIQUE pair]
import_runs      id, imported, skipped, errors, total, status
embedding_queue  id, phone_id, attempts, status
```

Indexes: GIN on `specs`, GIN on `search_vec`, trigram on `model` + `brand`.

---

## Dataset Import

The import is **idempotent** — safe to re-run, skips existing phones.

```bash
# Docker
docker-compose exec backend node scripts/runImport.js

# Local
cd backend && npm run import

# Via API (admin token required)
curl -X POST http://localhost:5000/admin/import \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Import then queues all phones for embedding. The embedding step runs separately:
```bash
# Process embedding queue (resumes if interrupted)
curl -X POST http://localhost:5000/admin/embed \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Embedding 24k phones on HuggingFace free tier takes ~8 hours (1.2s per phone). It resumes from where it stopped if interrupted.

---

## Make First User Admin

```sql
-- Run in psql after registering your account
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

---

## Free Deployment

### Railway (backend + Postgres + Redis + ChromaDB)

1. Go to [railway.app](https://railway.app) → New Project
2. Add services: **PostgreSQL**, **Redis**, **Deploy from GitHub**
3. Set all env vars from `.env.example` in the Railway dashboard
4. Railway auto-detects `railway.json` and runs `node server.js`
5. After deploy: run schema via Railway's Postgres console
6. Import dataset via the Admin Panel

### Vercel (frontend)

1. Go to [vercel.com](https://vercel.com) → New Project → Import repo
2. Set **Root Directory** to `frontend`
3. Set env var: `VITE_API_URL=https://your-railway-backend.up.railway.app`
4. Update `vite.config.js` proxy target to your Railway URL for production

> ChromaDB on Railway: add a custom Docker service using `chromadb/chroma:latest`, port 8000, persistent volume at `/chroma/chroma`.

---

## Features Summary

| Feature | Implementation |
|---|---|
| AI Chat | Groq Llama 3.3 70B + RAG context from ChromaDB |
| Phone Compare | Dedicated `/chat/compare` endpoint with structured output |
| Full-text Search | PostgreSQL `tsvector` + `pg_trgm` trigram fuzzy match |
| Vector Recommendations | ChromaDB similarity search on HF embeddings |
| Redis Caching | 1h TTL for chat, 24h for comparisons; graceful fallback |
| Auth | JWT (15m) + httpOnly refresh cookie (7d) |
| Admin Panel | Stats, phone browser, user management, import/embed control |
| Embedding Queue | Retry-safe, resumable, rate-limited to HF free tier |
| Dataset Import | Batched, transactional, idempotent, 24k phones |

---

## Production Checklist

- [ ] Strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ random chars)
- [ ] `NODE_ENV=production` set
- [ ] HTTPS termination (Railway/Vercel handle this automatically)
- [ ] `FRONTEND_URL` set to your actual domain
- [ ] Admin user promoted in DB
- [ ] Dataset imported + embedding queue processed
- [ ] Postgres backups enabled (Railway does this automatically)
