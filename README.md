# Nexus Observatory

Nexus Observatory is a portfolio-grade AI observability dashboard for monitoring, debugging, and comparing LLM and agent runs.

The current milestone is **Milestone 0 — Project Setup**. The repository contains a minimal FastAPI backend and a Next.js dashboard shell only.

## Repository Structure

```txt
apps/
  api/    FastAPI backend
  web/    Next.js frontend
```

The local `.ai/` folder contains project notes and is intentionally ignored by Git.

## Backend Setup

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health checks:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/ready
```

Expected responses:

```json
{"status":"ok"}
{"status":"ready"}
```

## Frontend Setup

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` if local overrides are needed:

```bash
cp .env.example .env
```

The frontend does not connect to the backend yet. Database, authentication, Docker, WebSocket, and LLM providers are intentionally deferred to later milestones.
