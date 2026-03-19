# AI Caddy Voice Agent

A RAG-enabled voice agent ("Chip") that acts as a virtual golf caddy—answering course questions, recommending clubs, and providing strategy. Built with **LiveKit**, **LlamaIndex**, and **React**.

## Design Document

### How It Works End-to-End

1. **User** opens the React frontend (mobile-friendly), optionally enters club yardages, and clicks **Start Call**.
2. **Token API** (Vercel serverless) creates a LiveKit access token with participant metadata (club yardages) and returns it.
3. **Frontend** connects to the LiveKit room via WebRTC. The agent is dispatched by LiveKit Cloud when the user joins.
4. **Agent** (Python, STT→LLM→TTS) joins the room, reads club yardages from participant metadata, and greets the user as Chip.
5. **RAG** runs on each user turn via `on_user_turn_completed`: the agent queries the course yardage book PDF (indexed with LlamaIndex + Chroma) and injects retrieved context before the LLM responds.
6. **Tools**: `get_nearby_golf_courses(location)` for course lookups; `update_my_yardages(club, distance)` for voice-based yardage capture.
7. **Live transcript** streams to the frontend in real time.

### RAG Integration

- **Source**: TPC Sawgrass Dye's Valley yardage book PDF (or any course yardage book).
- **Indexing**: LlamaIndex chunks the PDF (~512 tokens, 50 overlap), embeds with OpenAI `text-embedding-3-small`, stores in Chroma.
- **Retrieval**: On every user turn, the agent calls `rag_lookup(query)` and injects results into the chat context before the LLM generates a response.
- **Chunking**: Hole-level metadata when possible; similarity search with `similarity_top_k=3`.

### Tools and Frameworks

- **LiveKit Agents** (Python): STT (Deepgram Nova-3), LLM (OpenAI GPT-4.1 mini), TTS (Cartesia Sonic), VAD (Silero), turn detection (MultilingualModel).
- **LlamaIndex**: RAG pipeline, PDF loading, Chroma vector store.
- **React + Vite**: Frontend with `@livekit/components-react`, mobile-first layout.
- **Vercel**: Frontend + token API deployment. LiveKit Cloud for media and agent hosting.

---

## Setup Instructions

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+ (3.9+ may work; LiveKit agents recommend 3.10)
- **uv** (recommended for Python) or pip
- LiveKit Cloud account
- OpenAI API key

### 1. Clone and Configure

```bash
git clone <repo-url>
cd AICaddyVoiceAgent
cp .env.example .env
# Edit .env with LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, OPENAI_API_KEY, VITE_LIVEKIT_URL
```

All services (agent, token API, frontend) use this single `.env` at the project root.

### 2. Agent (Python)

```bash
cd agent
# Install (with uv)
uv sync

# Or with pip
pip install .

# Place yardage book PDF at agent/data/yardage_book.pdf (TPC Sawgrass or similar)

# Run locally (loads .env from project root)
uv run src/agent.py dev
# Or: python -m src.agent dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite loads `.env` from the project root. Ensure `VITE_LIVEKIT_URL` is set there.

### 4. Token API (local dev)

In another terminal:

```bash
cd frontend
node api-server.js
```

Loads `.env` from the project root. Ensure Vite proxy targets `localhost:3001` (see `vite.config.ts`).

---

## Deploy to Vercel

1. Connect the repo to Vercel; set root to `frontend`.
2. Add env vars: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `VITE_LIVEKIT_URL` (Vercel provides its own URL).
3. Deploy. The `/api/token` serverless function runs automatically.

---

## Deploy Agent to LiveKit Cloud

```bash
cd agent
lk cloud auth   # if not already
lk agent deploy
```

Or use AWS ECS with the included Dockerfile.

---

## Design Decisions / Assumptions

| Topic | Decision |
|-------|----------|
| **RAG chunking** | 512 tokens, 50 overlap; works for hole layouts and distance tables |
| **Vector DB** | Chroma (local in agent container); can switch to Pinecone for scale |
| **Club yardages** | Form + voice (tool). File upload/parsing deferred. Passed via participant metadata |
| **Tool call** | `get_nearby_golf_courses` uses mock data; can plug Overpass API |
| **Hosting** | Frontend + token API on Vercel; agent on LiveKit Cloud or AWS ECS |
| **Mobile** | Mobile-first layout; touch targets, safe areas, readable transcript |

---

## Project Structure

```
AICaddyVoiceAgent/
├── agent/               # Python LiveKit agent
│   ├── src/
│   │   ├── agent.py
│   │   ├── caddy_agent.py
│   │   ├── rag.py
│   │   └── tools.py
│   ├── data/
│   │   └── yardage_book.pdf
│   └── vector_store/
├── frontend/            # React + Vite
│   ├── api/
│   │   └── token.ts     # Vercel serverless
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   └── api-server.js    # Local dev token API
└── README.md
```
