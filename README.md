# Nexus Observatory

Nexus Observatory is a portfolio-grade AI observability dashboard for monitoring, debugging, and comparing LLM and agent runs.

The current app includes a FastAPI backend, SQLite run persistence, a Next.js dashboard, and mock/OpenAI-compatible run execution.

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

Create a mock run execution:

```bash
curl -X POST http://localhost:8000/runs/execute \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain AI observability simply.","provider":"mock","model":"mock-model"}'
```

## OpenAI-Compatible Provider

The backend can call OpenAI-style chat completion APIs through `provider="openai_compatible"`.

Configure these variables in the backend environment:

```bash
export OPENAI_COMPATIBLE_BASE_URL="http://localhost:11434/v1"
export OPENAI_COMPATIBLE_API_KEY="your-api-key"
export OPENAI_COMPATIBLE_DEFAULT_MODEL="openai-compatible-default"
```

`OPENAI_COMPATIBLE_BASE_URL` should usually end at `/v1` when the provider uses OpenAI-style paths, because Nexus Observatory calls:

```txt
{OPENAI_COMPATIBLE_BASE_URL}/chat/completions
```

Do not expose API keys to the frontend. The Next.js app only needs `NEXT_PUBLIC_API_BASE_URL`.

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

Authentication, Docker, WebSocket, trace timelines, and model comparison are intentionally deferred to later milestones.
