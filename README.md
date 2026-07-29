# ChaibookLM

A NotebookLM-style research assistant: create notebooks, add sources (PDFs, plain text, website URLs, YouTube videos, VTT/SRT transcripts — including whole-course `.zip` uploads), and ask questions grounded in those sources with inline citations that link back to the exact page, timestamp, or passage.

---

## Architecture

```
┌─────────────┐        ┌──────────────────┐        ┌─────────────┐
│   Frontend   │◄──────►│   Backend API     │◄──────►│  Postgres   │
│ React + Vite │  HTTP  │  Express (REST +  │        │ (Drizzle)   │
│  + Tailwind  │  /SSE  │   SSE streaming)  │        └─────────────┘
└─────────────┘        └─────────┬─────────┘
                                   │
                        ┌──────────┼───────────┐
                        ▼          ▼           ▼
                  ┌──────────┐ ┌───────┐  ┌──────────┐
                  │  BullMQ   │ │ Redis │  │  Qdrant   │
                  │  Worker   │ │(queue)│  │ (vectors) │
                  └──────────┘ └───────┘  └──────────┘
```

- **Frontend** (`frontend/`) — React + Vite, Tailwind CSS v4, shadcn-style components on Radix primitives, Clerk for auth.
- **Backend** (`backend/`) — Express REST API. Auth via Clerk session verification. File uploads via Multer.
- **Queue** — Every uploaded source is enqueued (BullMQ + Redis) rather than processed inline, so uploads return instantly and processing status is tracked per-source.
- **Worker** (`backend/workers/processSource.js`) — Picks up queued jobs and runs the full indexing pipeline (extract → chunk → embed → store).
- **Vector store** — Qdrant, one collection, each point tagged with `user_id` / `notebook_id` / `source_id` for isolation and filtering.
- **Relational store** — Postgres (via Drizzle ORM) holds users, notebooks, sources, extracted text, chunk metadata, conversations, and messages (with citations).

### Backend folder structure

```
backend/
├── server.js              Express app entrypoint, route mounting, global error handler
├── config.js               OpenAI + Qdrant clients, tunable CONFIG constants
├── db/
│   ├── schema.js            Drizzle table definitions
│   ├── migrations/           SQL migrations (drizzle-kit generated)
│   └── index.js              DB client
├── routes/
│   ├── notebooks.js          CRUD + rename for notebooks
│   ├── sources.js            Upload/list/delete/re-index sources (all 6 source types)
│   └── ask.js                 Conversation history, ask (sync), ask/stream (SSE)
├── extractors/               One file per source type -> { fullText, segments }
│   ├── pdf.js                 pdf-parse with per-page offset tracking
│   ├── youtube.js              youtube-transcript with per-segment timestamps
│   ├── vtt.js                  Custom VTT/SRT cue parser with timestamps
│   ├── text.js / url.js        Plain text passthrough / cheerio HTML scrape
│   └── index.js                Dispatches by source type
├── pipeline/
│   ├── indexer.js              Orchestrates extract -> chunk -> embed -> store, tracks status per stage
│   ├── chunker.js              RecursiveCharacterTextSplitter + offset mapping
│   ├── positionMapper.js        Maps a chunk's offset back to a page/timestamp
│   └── withRetry.js             Shared retry-with-backoff for flaky Qdrant calls
├── query/                     The CRAG (Corrective RAG) query pipeline
│   ├── queryTranslation.js      Rewritten / step-back / sub-queries / HyDE generation
│   ├── retriever.js             Embed variants -> Qdrant search -> RRF fuse -> per-source cap
│   ├── generator.js              Grounded answer generation (context-only, conversation-aware)
│   ├── grader.js                 Scores the answer, extracts improvement keywords on low score
│   └── cragLoop.js               Orchestrates the retry loop, builds the citation payload
├── queues/sourceQueue.js       BullMQ queue definition
├── workers/processSource.js    BullMQ worker entrypoint
├── memory/mem0.js              Mem0 REST wrapper: per-notebook long-term fact recall
└── middleware/
    ├── auth.js                  Clerk token verification + user upsert
    └── asyncHandler.js           Wraps routes so rejected promises reach the error handler
```

### Frontend folder structure

```
frontend/src/
├── App.jsx                  Auth gate, top-level notebook/workspace routing
├── NotebooksScreen.jsx        Notebook grid: create, rename (inline), delete
├── NotebookWorkspace.jsx       3-column layout: source rail | chat | citations panel
├── AddSourceModal.jsx          Source-type picker + upload/URL/text form
├── ChatPanel.jsx                Message list (markdown), streaming, avatars
├── CitationsPanel.jsx           Right-hand list of citations for the latest answer
├── SourceViewer.jsx              Modal: PDF page jump / YouTube timestamp / text highlight
├── components/ui/               shadcn-style primitives (Button, Dialog, Avatar, Card, Input)
├── components/StatusDot.jsx      Pulsing amber / green / red status indicator
├── components/ConfirmDialog.jsx  Reusable destructive-action confirmation
├── lib/citations.js              Groups + labels citations (page ranges, timestamps)
├── lib/sourceStatus.js            Status -> label/color mapping
└── api.js                        All backend calls, incl. manual SSE frame parsing
```

---

## RAG pipeline in detail

### 1. Ingestion (per source type)

Every extractor returns a common shape: `{ fullText, segments }`, where `segments` records **where** each piece of text came from in the original source:

| Source type | Segment metadata |
|---|---|
| PDF | `pageNumber` + character range within `fullText` |
| YouTube | `startTimeSeconds` per transcript segment |
| VTT / SRT | `startTimeSeconds` per cue (real timestamps parsed from `-->` lines) |
| Plain text / Website | Character offset range (no natural "pages") |

This positional data is what later lets a citation jump to the exact PDF page or video timestamp instead of just naming the source.

### 2. Chunking

`RecursiveCharacterTextSplitter` (500 chars, 50 overlap) splits `fullText`. Each resulting chunk is then **located back** in `fullText` (`chunker.js`) and mapped to its page/timestamp (`positionMapper.js`), so every chunk stored in Postgres/Qdrant carries `pageNumber`, `startTimeSeconds`, `startOffset`, `endOffset` alongside its text.

### 3. Embeddings

OpenAI `text-embedding-3-small`, batched with automatic sub-batching (`embeddings.js`) to stay under both the 300k-token and 2048-item per-request limits — large PDFs/courses don't fail on a single oversized request.

### 4. Storage

Chunks are stored in **both** Postgres (source of truth, used for the Source Viewer) and Qdrant (for vector search). Each Qdrant point's payload includes `user_id`, `notebook_id`, `source_id`, `chunk_id`, `chunk_index`, and the positional fields — `notebook_id` is the isolation boundary enforced on every search.

### 5. Query phase (CRAG — Corrective RAG)

For every question, `cragLoop.js` runs:

1. **Query translation** (`queryTranslation.js`) — one LLM call produces a rewritten query, a step-back (broader) query, and 3 sub-queries; a second call produces a HyDE passage (a hypothetical answer, embedded instead of the raw question — often closer to real document vectors).
2. **Retrieval** (`retriever.js`) — all variants are embedded and searched against Qdrant **filtered by `notebook_id`**. Each variant's ranked list is fused with **Reciprocal Rank Fusion (RRF)**. Before the final top-K, results are **capped per source** (max 3 chunks per source) so one large document can't crowd out a smaller, equally relevant one.
3. **Generation** (`generator.js`) — the original (untranslated) question is answered using only the retrieved chunks as context, with prior conversation turns included for follow-up awareness. The prompt explicitly instructs the model to say so if the context is insufficient, rather than guessing.
4. **Grading** (`grader.js`) — a second, cheap LLM call scores the answer 1–10. If below threshold, it extracts keywords describing what's missing, which steer the next retry's HyDE passage.
5. **Retry** — up to 3 attempts; the best-scoring answer across all attempts is returned even if none crossed the threshold.
6. **Citations** — the chunks that produced the final answer are resolved back to their source (title, type, URL) and positional data, deduplicated, and grouped by exact page/timestamp (not collapsed into a range) before being sent to the client.

### 6. Streaming

`POST /api/notebooks/:id/ask/stream` runs the full CRAG loop above (grading needs the complete answer text, so this part isn't streamed), then streams the finalized answer to the client word-by-word over Server-Sent Events — no extra LLM cost, just a client-perceived typewriter effect while the backend already has the final text.

### 7. Long-term memory (Mem0)

Conversation history sent to `generator.js` is capped at the last 10 messages — fine for immediate follow-ups, but a fact stated in message #1 is invisible by message #12. `memory/mem0.js` closes that gap: after every exchange, Mem0 extracts durable facts (preferences, constraints, stated goals) from the Q&A pair and stores them scoped to that notebook's `run_id`. Before generating an answer, the notebook is searched for facts relevant to the *current* question — regardless of how long ago they were mentioned — and injected into the prompt as a distinct "things the user has told you" block, separate from (and trusted more than) the raw conversation history. Memory is scoped per-notebook, not per-user, so it doesn't cross the same isolation boundary as sources/citations; it's entirely optional (skipped silently if `MEM0_API_KEY` is unset) and calls Mem0's REST API directly rather than its npm SDK, since the SDK's LangChain peer dependency conflicted with the chunking library already in use.

---

## Setup

### Prerequisites

- Node.js 18+
- Docker (for local Postgres/Redis, or use hosted equivalents — see below)
- API keys: [OpenAI](https://platform.openai.com), [Clerk](https://clerk.com)
- A Qdrant instance (local via Docker, or a free [Qdrant Cloud](https://cloud.qdrant.io) cluster)

### 1. Clone and configure environment

```bash
git clone <this-repo>
cd ChaibookLM
cp .env.example .env
# fill in OPENAI_API_KEY, VITE_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
```

### 2. Start local infrastructure

```bash
docker compose up -d   # Postgres (5433) + Redis (6380)
docker run -p 6333:6333 qdrant/qdrant   # Qdrant (6333)
```

### 3. Backend

```bash
cd backend
npm install
npm run db:migrate   # apply schema to Postgres
npm start             # API server on :3002
```

In a second terminal, start the background worker (required for source processing):

```bash
cd backend
npm run worker
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

---

## Environment variables

All variables live in a single root-level `.env` (see `.env.example`):

| Variable | Used by | Description |
|---|---|---|
| `OPENAI_API_KEY` | backend | OpenAI API key |
| `OPENAI_CHAT_MODEL` | backend | Model for query translation + answer generation (default `gpt-4o-mini`) |
| `OPENAI_GRADER_MODEL` | backend | Model for grading answers (default `gpt-4o-mini`) |
| `OPENAI_EMBEDDING_MODEL` | backend | Embedding model (default `text-embedding-3-small`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | frontend | Clerk publishable key |
| `CLERK_SECRET_KEY` | backend | Clerk secret key, used to verify session tokens |
| `VITE_API_BASE` | frontend | Backend API base URL (defaults to `http://localhost:3002/api` for local dev) |
| `DATABASE_URL` | backend | Postgres connection string |
| `REDIS_URL` | backend | Redis connection string (BullMQ queue) |
| `QDRANT_URL` | backend | Qdrant instance URL |
| `QDRANT_API_KEY` | backend | Qdrant API key (only needed for Qdrant Cloud) |
| `QDRANT_COLLECTION` | backend | Qdrant collection name |
| `MEM0_API_KEY` | backend | Mem0 API key for long-term per-notebook memory ([app.mem0.ai](https://app.mem0.ai), free tier available). Optional — memory is silently skipped if unset. |
| `PORT` | backend | API server port (default `3002`) |

## Deployment

- `render.yaml` at the repo root defines two Render services (web + background worker) for the backend.
- `vercel.json` at the repo root builds the frontend from the `frontend/` subdirectory.
- See inline comments in `.env.example` for free-tier hosted alternatives to local Docker services (Neon for Postgres, Upstash for Redis, Qdrant Cloud for vectors).

**Known limitation:** on Render's free tier, the filesystem is ephemeral — uploaded PDF/VTT files are lost on restart/redeploy (indexed chunks and embeddings persist fine; only the "view original file" / re-index actions for file-based sources are affected until re-uploaded).

---

## Notable design decisions

- **Per-notebook isolation** is enforced at the Qdrant query level (`notebook_id` filter on every search), not just at the application layer.
- **Positional metadata is captured at extraction time**, not reconstructed later — this is what makes "click a citation → jump to the exact page/timestamp" possible instead of just naming the source.
- **Per-source retrieval capping** was added deliberately: a naive global top-K over RRF-fused results lets one large, generally-relevant source dominate every answer's context, silently starving smaller sources of any chance to be cited.
- **Chunking preserves offsets** by re-locating each langchain-split chunk in the original text, rather than tracking offsets through the splitter (which doesn't expose them) — a pragmatic choice that works because chunks are near-verbatim substrings.
- **Streaming replays a computed answer** rather than streaming raw LLM tokens, because the CRAG loop's grading step needs the complete answer text before it can decide whether to retry — token-level streaming isn't compatible with a self-correcting retrieval loop without either double-generating or streaming a draft that might get discarded.
- **Memory is scoped per-notebook, not per-user**, even though Mem0 supports both: notebooks are already a hard isolation boundary for sources, so letting a fact from one notebook silently influence answers in an unrelated notebook would contradict that model.
