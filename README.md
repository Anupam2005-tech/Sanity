# Sanity CSV Importer

An AI-powered CSV importer that intelligently maps any arbitrary CSV structure into a standard CRM lead format using AI (Gemini or OpenRouter). Built for the GrowEasy assignment submission.

**Live Demo:** [https://sanity-csv.vercel.app](https://sanity-csv.vercel.app)
**Position Applied For:** Software Developer (Full-Time)

---

## How It Works

1. **Upload** — Drag-and-drop or pick any CSV file. The app parses it incrementally (streaming) using PapaParse so large files show rows as they load.
2. **Preview** — See the raw CSV data in a virtualized table (handles 100k+ rows smoothly) with sticky headers, horizontal+vertical scrolling, and no visible scrollbars.
3. **Confirm** — Hit "Confirm Import". The frontend sends the data to the backend, which persists an import record and processes rows in configurable batches through an AI model.
4. **Results** — The AI maps arbitrary column names to CRM fields, enforcing strict allowed values. Successfully parsed records and skipped rows are displayed with hover tooltips, badges, and export-to-CSV.

### Key Design Decisions

| Decision | Why |
|----------|-----|
| **Client-side CSV parsing** | Avoids uploading the file twice; immediate preview without a server round-trip. PapaParse streaming mode prevents UI freezes on large files. |
| **SQLite with persistent volume** | Every import session is persisted — survive server restarts, view past imports, recover from network drops. The database file lives on a persistent disk (Render supports this; Vercel serverless doesn't). |
| **AI as a swappable provider** | An `AI_PROVIDER` env var switches between Gemini and OpenRouter. OpenRouter dynamically fetches free models and falls back through them, so no hardcoded model list. |
| **Batch processing with exponential backoff** | Large CSVs are split into configurable-size batches. On rate limits (429), retries use exponential backoff (`3^(n-1)` seconds). On token errors, batches are halved automatically. |
| **Virtualized tables everywhere** | Using `@tanstack/react-virtual` for all data tables — thousands of rows rendered as DOM only for visible viewport. Zero layout shift, smooth scrolling. |
| **Sticky headers, hidden scrollbars** | All tables have sticky column headers. Scrollbars are hidden via CSS for a clean look while keeping full scroll functionality. |

---

## Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI:** React 18, Tailwind CSS, Framer Motion
- **CSV Parsing:** PapaParse (streaming step mode)
- **Virtualization:** `@tanstack/react-virtual`
- **Testing:** Vitest + Testing Library
- **Deployment:** Vercel

### Backend
- **Runtime:** Node.js 20+, Express 5
- **Language:** TypeScript
- **Database:** SQLite via `better-sqlite3`
- **AI:** Google Gemini (`@google/generative-ai`) and OpenRouter API
- **Testing:** Vitest
- **Deployment:** Render

### Shared
- **`shared/`** — TypeScript types (`CRMRecord`, `SkippedRecord`, API DTOs) used by both frontend and backend, preventing type drift.

---

## Project Structure

```
sanity-csv/
├── frontend/                    # Next.js 14 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/      # UI components (each step is one component)
│   │   │   │   ├── UploadStep.tsx       — Step 1: drag-and-drop/file picker
│   │   │   │   ├── PreviewTable.tsx     — Step 2: raw CSV preview table
│   │   │   │   ├── ConfirmStep.tsx      — Step 3: confirm & trigger import
│   │   │   │   ├── ResultsStep.tsx      — Step 4: AI-extracted results with preview modal
│   │   │   │   ├── ProgressIndicator.tsx— Step progress bar (circles + connecting line)
│   │   │   │   ├── HoverTooltip.tsx      — Shared tooltip + CRM field descriptions
│   │   │   │   ├── ThemeToggle.tsx       — Light/dark mode toggle
│   │   │   │   └── ToastProvider.tsx     — Toast notification provider
│   │   │   ├── layout.tsx        — Root layout, header, theme script
│   │   │   ├── page.tsx          — Main page with 4-step state machine
│   │   │   └── globals.css       — Global styles, CSS variables for theming
│   │   └── __tests__/            — Frontend unit tests
│   ├── tailwind.config.ts
│   └── Dockerfile                — Multi-stage: build → standalone Next.js
│
├── backend/                      # Express API server
│   ├── src/
│   │   ├── index.ts              — Express app setup, routes, CORS, error handling
│   │   ├── aiExtractor.ts        — AI provider dispatcher (Gemini vs OpenRouter)
│   │   ├── batchProcessor.ts     — Batch splitting, retry logic, progress tracking
│   │   ├── ai/
│   │   │   ├── shared.ts         — SYSTEM_PROMPT, JSON parser, enum validation
│   │   │   └── openRouter.ts     — OpenRouter API client with free-model fallback
│   │   ├── db/
│   │   │   └── client.ts         — SQLite init, schema, sweep-stuck logic
│   │   └── __tests__/            — Backend unit tests
│   ├── Dockerfile                — Multi-stage: build → slim production image
│   └── tsconfig.json
│
├── shared/                       # Shared TypeScript types
│   └── src/types.ts              — CRMRecord, ImportStatusResponse, etc.
│
├── docker-compose.yml            — Orchestrates frontend + backend + volume
├── .env                          — Docker environment (API keys)
└── .gitignore                    — Ignores node_modules, .env, build artifacts
```

---

## Local Setup

### Prerequisites
- Node.js v20+
- A Gemini API key or OpenRouter API key

### 1. Environment Variables

#### Root `.env` (for Docker):
```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-openrouter-api-key
```

#### `backend/.env` (for manual run):
```env
PORT=3001
GEMINI_API_KEY=your-gemini-api-key
AI_BATCH_SIZE=20
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-openrouter-api-key
SQLITE_PATH=./data/sanity.db
GEMINI_MODEL=gemini-2.0-flash
```

#### `frontend/.env` (for manual run):
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 2. Install & Run (Manual)

```bash
# Install all workspace dependencies
npm install

# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Frontend: `http://localhost:3000` | Backend: `http://localhost:3001`

### 3. Install & Run (Docker)

```bash
docker compose up --build
```

### 4. Run Tests

```bash
# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && npm test
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/imports` | Create a new import with CSV row data |
| `GET` | `/api/imports/:id` | Get import status and results |
| `POST` | `/api/imports/:id/process` | Start AI processing |
| `GET` | `/api/imports/:id/stream` | SSE stream for real-time progress updates (text/event-stream) |

---

## AI Configuration

### Provider Switching

Set `AI_PROVIDER` in your `.env`:

- `gemini` — Uses Google Gemini (`@google/generative-ai`). Set `GEMINI_API_KEY` and `GEMINI_MODEL`.
- `openrouter` — Uses OpenRouter API. Set `OPENROUTER_API_KEY`. Dynamically fetches free models, falls back through up to 5 models, with a hardcoded fallback list if the API fetch fails.

### AI Instructions

The system prompt enforces:

1. **CRM Status** — Only `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE`
2. **Data Source** — Only `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots` (blank if uncertain)
3. **Date Format** — `created_at` must be parseable by `new Date(created_at)`
4. **CRM Notes** — Extra numbers, emails, follow-up notes, anything useful
5. **Multiple Emails/Mobiles** — First in the main field, rest in `crm_note`
6. **Skip Invalid Records** — Records with neither email nor mobile are skipped

---

## Deployment

### Frontend → Vercel

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Set root directory to `frontend/`.
4. Add environment variable: `NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com`.
5. Deploy.

### Backend → Render

1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Set:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npx tsc`
   - **Start Command:** `node dist/index.js`
4. Add a **Persistent Disk** (Render → your service → Disks) — mount it at `/data`.
5. Set environment variables (all from `backend/.env`), with `SQLITE_PATH=/data/sanity.db`.
6. Deploy.

### Docker

```bash
docker compose up --build
```

---

