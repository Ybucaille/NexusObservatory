# Nexus Observatory

Nexus Observatory is an AI observability dashboard for monitoring, debugging and comparing LLM runs from a clean local-first interface.

It is designed as a portfolio-grade product: a polished dashboard backed by real API data, local persistence, provider abstraction, run traces and model comparison workflows.

## Product Preview

Product screenshots are planned for the portfolio release.

### Dashboard

_Screenshot placeholder._

### Run Detail

_Screenshot placeholder._

### Trace Timeline

_Screenshot placeholder._

### Model Lab

_Screenshot placeholder._

### Provider Settings

_Screenshot placeholder._

## What It Does

Nexus Observatory helps developers inspect AI executions in one place:

- Execute prompts through a local mock provider or an OpenAI-compatible backend.
- Persist AI executions as inspectable runs.
- Track latency, token usage, provider, model, prompt, response and metadata.
- Inspect individual runs with a trace timeline.
- Compare the same prompt across multiple providers/models in Model Lab.
- Check provider readiness from a read-only Settings page.

## Features

- **Dashboard metrics**: total runs, successful runs, failed runs, average latency, total tokens and most used model.
- **Run history**: searchable-style table layout with status, provider, model, latency, tokens and prompt preview.
- **Run detail view**: prompt, response, model/provider metadata, timestamps, token usage and structured metadata.
- **Trace timeline**: execution steps such as request received, provider selected, provider call started, provider call finished and run stored.
- **Prompt execution**: compact dashboard panel for running prompts and storing results.
- **Model Lab**: compare one prompt across multiple targets with partial success handling.
- **Provider Settings**: read-only provider readiness cards for `mock` and `openai_compatible`.

## Stack

Frontend:

- Next.js
- TypeScript
- Tailwind CSS

Backend:

- FastAPI
- Python
- SQLite
- Python standard library `sqlite3`
- Uvicorn

Providers:

- `mock`: local/demo provider that requires no credentials.
- `openai_compatible`: calls OpenAI-style chat completions APIs from the backend.

## Repository Structure

```txt
apps/
  api/    FastAPI backend
  web/    Next.js frontend
```

## Local Setup

### Backend

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

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

The frontend expects the backend URL in:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Mock Provider

The mock provider runs locally and does not require backend provider configuration or API keys.

Create a mock run:

```bash
curl -X POST http://localhost:8000/runs/execute \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain AI observability simply.","provider":"mock","model":"mock-model"}'
```

The created run appears in the dashboard, the Runs page and the Run Detail page.

## OpenAI-Compatible Provider

The backend can call OpenAI-style chat completion APIs through `provider="openai_compatible"`.

Configure these variables in the backend environment.

OpenAI example:

```bash
export OPENAI_COMPATIBLE_BASE_URL="https://api.openai.com/v1"
export OPENAI_COMPATIBLE_API_KEY="your-api-key"
export OPENAI_COMPATIBLE_DEFAULT_MODEL="gpt-4o-mini"
```

Local OpenAI-compatible backend example:

```bash
export OPENAI_COMPATIBLE_BASE_URL="http://localhost:11434/v1"
export OPENAI_COMPATIBLE_API_KEY="ollama"
export OPENAI_COMPATIBLE_DEFAULT_MODEL="llama3.1"
```

`OPENAI_COMPATIBLE_BASE_URL` should usually end at `/v1` when the provider uses OpenAI-style paths, because Nexus Observatory calls:

```txt
{OPENAI_COMPATIBLE_BASE_URL}/chat/completions
```

API keys stay backend-side through environment variables. They are never stored in the database and are never exposed to the Next.js frontend.

The frontend only selects the provider/model and sends the prompt to the backend.

## Provider Status

The Settings page calls:

```txt
GET /providers/status
```

It reports whether each provider is available and configured. For OpenAI-compatible backends, it only returns booleans such as `api_key_configured`; it never returns the API key value.

## Demo Flow

1. Start the backend.
2. Start the frontend.
3. Execute a mock prompt from the dashboard.
4. Inspect the created run in the Runs page.
5. View the trace timeline on the Run Detail page.
6. Compare mock and OpenAI-compatible providers in Model Lab.
7. Check provider status in Settings.

## Validation

Backend:

```bash
cd apps/api
source .venv/bin/activate
python -m compileall app tests
python -m unittest discover -s tests
```

Frontend:

```bash
cd apps/web
npm run build
```
