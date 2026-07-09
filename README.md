# GrowEasy CSV Importer

An AI-powered CSV importer that intelligently maps any arbitrary CSV structure into a standard GrowEasy CRM lead format. Upload any CSV file — regardless of column names — and the AI will figure out what goes where.

---

## How It Works

1. **Upload** — Drag-and-drop or pick any CSV file. The app parses it incrementally (streaming) using PapaParse so large files show rows as they load without freezing the UI.
2. **Preview** — See the raw CSV data in a virtualized table (handles 100k+ rows smoothly) with sticky headers and horizontal + vertical scrolling.
3. **Confirm** — Hit "Start AI Import". The frontend sends all rows to the backend over a streaming connection. The backend processes them in configurable batches through an AI model, streaming live progress back.
4. **Results** — AI-extracted CRM records are displayed in a table with hover tooltips, status badges, and download options (CSV or JSON). Skipped rows (missing email and mobile) are shown separately.

---

## Key Design Decisions

| Decision | Why |
|---|---|
| **Stateless backend (no DB)** | Processing is purely in-memory — rows in, CRM records out. No SQLite, no persisted state, no native module headaches. Simpler, faster, easier to deploy anywhere. |
| **Single streaming endpoint** | `POST /api/process` receives rows, runs AI batches, and streams SSE progress events back through the same HTTP connection. No polling, no import IDs, no two-step handshake. |
| **XHR streaming on the frontend** | `EventSource` only supports GET requests. XHR lets us POST the row data and still consume the SSE response incrementally — best of both worlds. |
| **Client-side CSV parsing** | Avoids uploading a raw file to the server. PapaParse streaming mode parses the CSV directly in the browser and sends clean JSON rows. |
| **AI as a swappable provider** | Gemini is tried first. If it fails, OpenRouter is used as a fallback. The system prompt is shared between both providers. |
| **Batch processing with retry + backoff** | Large CSVs are split into configurable-size batches (default: 20 rows). On rate limits (429), retries use exponential backoff. On token limit errors, batches are halved automatically. |
| **Strict AI output validation** | Even after the AI responds, the backend enforces `crm_status` and `data_source` enum constraints, stamps `created_at` with the actual import timestamp, and skips any record missing both email and mobile. |
| **Download as CSV or JSON** | Results can be exported in either format from the same dropdown button. |

---

## CRM Fields Extracted

| Field | Description |
|---|---|
| `created_at` | Import timestamp (set by the system — not from the CSV) |
| `name` | Lead full name |
| `email` | Primary email (extras go to `crm_note`) |
| `country_code` | Dialing code e.g. `+91` |
| `mobile_without_country_code` | Primary mobile (extras go to `crm_note`) |
| `company` | Company or organisation name |
| `city` | City |
| `state` | State or province |
| `country` | Country |
| `lead_owner` | Assigned lead owner / sales rep |
| `crm_status` | One of: `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE` |
| `crm_note` | Remarks, extra contacts, follow-up notes, unmappable data |
| `data_source` | One of: `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots` |
| `possession_time` | Expected property possession time |
| `description` | Additional description |

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router, `output: standalone`)
- **UI:** React 18, Tailwind CSS, Framer Motion, Lucide Icons
- **CSV Parsing:** PapaParse (streaming step mode)
- **Virtualization:** `@tanstack/react-virtual` (preview table)
- **Notifications:** `react-hot-toast`

### Backend
- **Runtime:** Node.js 20, Express 5
- **Language:** TypeScript (compiled with `tsc`)
- **AI:** Google Gemini (`@google/generative-ai`) with OpenRouter fallback
- **Architecture:** Fully stateless — no database, no file I/O

### Shared
- **`shared/`** — TypeScript types (`CRMRecord`, `ImportStatusResponse`, etc.) used by both frontend and backend to prevent type drift.

---

## Project Structure

```
groweasy-csv/
├── frontend/                        # Next.js 14 application
│   ├── src/
│   │   └── app/
│   │       ├── components/
│   │       │   ├── UploadStep.tsx          — Step 1: drag-and-drop / file picker
│   │       │   ├── PreviewTable.tsx        — Step 2: raw CSV preview (virtualized)
│   │       │   ├── ConfirmStep.tsx         — Step 3: trigger AI import via XHR stream
│   │       │   ├── ResultsStep.tsx         — Step 4: results table + CSV/JSON download
│   │       │   ├── ProgressIndicator.tsx   — Step progress bar
│   │       │   ├── HoverTooltip.tsx        — Tooltip + CRM field descriptions
│   │       │   ├── ThemeToggle.tsx         — Light / dark mode toggle
│   │       │   └── ToastProvider.tsx       — Toast notification provider
│   │       ├── layout.tsx                  — Root layout, header, theme script
│   │       ├── page.tsx                    — 4-step state machine
│   │       └── globals.css                 — Global styles + CSS variables
│   ├── tailwind.config.ts
│   └── Dockerfile                          — Multi-stage: build → standalone Next.js
│
├── backend/                         # Express API server (stateless)
│   ├── src/
│   │   ├── index.ts                        — Routes, in-memory batch processing, SSE streaming
│   │   ├── aiExtractor.ts                  — AI provider dispatcher (Gemini → OpenRouter)
│   │   └── ai/
│   │       ├── shared.ts                   — SYSTEM_PROMPT, JSON cleaner, strict rules
│   │       └── openRouter.ts               — OpenRouter API client with free-model fallback
│   ├── Dockerfile                          — Multi-stage: build → slim runner (no native modules)
│   └── tsconfig.json
│
├── shared/                          # Shared TypeScript types
│   └── src/types.ts                        — CRMRecord, ImportStatusResponse, etc.
│
├── docker-compose.yml               — Orchestrates frontend + backend
├── .env                             — Docker environment (API keys)
└── .gitignore
```

---

## Local Setup

### Prerequisites
- Node.js v20+
- A **Gemini API key** (`GEMINI_API_KEY`) and/or an **OpenRouter API key** (`OPENROUTER_API_KEY`)

---

### 1. Environment Variables

#### Root `.env` (used by Docker):
```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
OPENROUTER_API_KEY=your-openrouter-api-key
```

#### `backend/.env` (used for manual / local dev):
```env
PORT=3001
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
OPENROUTER_API_KEY=your-openrouter-api-key
AI_BATCH_SIZE=20
```

#### `frontend/.env` (used for manual / local dev):
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

---

### 2. Run with Docker (recommended)

```bash
# Clone and enter the repo
git clone <repo-url>
cd groweasy-csv

# Add your API keys to .env
cp .env.example .env   # then edit .env

# Build and start both services
docker compose up --build
```

- Frontend → [http://localhost:3000](http://localhost:3000)
- Backend  → [http://localhost:3001](http://localhost:3001)

---

### 3. Run Manually (without Docker)

```bash
# Install all workspace dependencies from repo root
npm install

# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check — returns `{ status: "ok", timestamp }` |
| `POST` | `/api/process` | Accept rows → run AI batches → stream SSE progress + results |

### `POST /api/process`

**Request body:**
```json
{
  "rows": [{ "Name": "John", "Email": "john@example.com", ... }],
  "filename": "leads.csv"
}
```

**Response:** `text/event-stream` — streams the following SSE events:

| Event type | Payload |
|---|---|
| `progress` | `{ batchesCompleted: 2, batchesTotal: 5 }` |
| `complete` | `{ result: { records: [...], skipped: [...], ... } }` |
| `error` | `{ message: "..." }` |

**Limits:** max 5000 rows per request.

---

## AI Configuration

### Provider Selection

The backend tries **Gemini first**, then falls back to **OpenRouter** if Gemini fails.

Set these in your `.env`:

```env
GEMINI_API_KEY=...          # required for Gemini
GEMINI_MODEL=gemini-2.0-flash
OPENROUTER_API_KEY=...      # required for OpenRouter fallback
```

Set `AI_BATCH_SIZE` to control how many CSV rows are sent to the AI per request (default: `20`, range: `5–50`).

### AI Extraction Rules (strictly enforced)

1. **`crm_status`** — Must be exactly one of: `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE` — or `null`.
2. **`data_source`** — Must be exactly one of: `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots` — or `null`.
3. **`created_at`** — Always set to the current import timestamp by the backend (never from the CSV).
4. **Multiple emails** — First email in `email` field; extras appended to `crm_note`.
5. **Multiple mobiles** — First mobile in `mobile_without_country_code`; extras appended to `crm_note`.
6. **`crm_note`** — Used for remarks, follow-up notes, extra contacts, and any data that doesn't fit another field.
7. **Skip invalid records** — Any row with neither an email nor a mobile number is skipped entirely and reported in the `skipped` list.
8. **CSV safety** — No unescaped line breaks inside field values.

---

## Deployment

### Docker (anywhere with Docker)

```bash
docker compose up --build -d
```


**Build command:** `npm install && npx tsc`  
**Start command:** `node dist/backend/src/index.js`  
**Environment variables:** `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENROUTER_API_KEY`, `AI_BATCH_SIZE`, `PORT`

---
