# AI Caddy Voice Agent

A RAG-enabled voice agent ("Chip") that acts as a virtual golf caddy—answering course questions, recommending clubs, and providing strategy. Built with **LiveKit**, **LlamaIndex**, and **React**.

## Design Document

### How It Works End-to-End

1. **User** completes the intake form (handicap, age, handedness, gender), then selects a course (by location search, geolocation, or manual name).
2. **Token API** (Vercel serverless) creates a LiveKit access token with participant metadata (`userProfile`, `selectedCourse`) and returns it.
3. **Frontend** connects to the LiveKit room via WebRTC. The agent is dispatched by LiveKit Cloud when the user joins.
4. **Agent** reads user profile and selected course from metadata, generates a course-specific RAG guide if needed, and greets the user as Chip.
5. **RAG** runs on each user turn via `on_user_turn_completed`: the agent queries course-specific or default yardage book PDF (indexed with LlamaIndex + Chroma) and injects retrieved context.
6. **Tools**: `get_nearby_golf_courses(location)` uses Overpass/Nominatim for real course lookups; `update_my_yardages(club, distance)` captures yardages and pushes them to the frontend via data channel.
7. **Yardage persistence**: When the user tells Chip their club distances, the agent publishes an updated profile; the frontend saves it to `localStorage` for the next session.
8. **Live transcript** streams to the frontend in real time.

### User Flow

```
Intake Form → Location / Course Select → Start Call → Caddy Session → (Yardages stored for next time)
```

### RAG Integration

- **Default**: Static `agent/data/yardage_book.pdf` (TPC Sawgrass or similar), indexed at startup.
- **Dynamic per-course**: When the user selects a course, the agent generates a hole-by-hole guide (GolfCourseAPI + LLM, or LLM-only fallback), saves as PDF to `agent/data/courses/{slug}.pdf`, and indexes in a per-course Chroma collection.
- **Indexing**: LlamaIndex chunks (~512 tokens, 50 overlap), embeds with OpenAI `text-embedding-3-small`. Hole-level metadata when structure permits.
- **Retrieval**: Similarity search with `similarity_top_k=3`.

### Tools and Frameworks

- **LiveKit Agents** (Python): STT (Deepgram Nova-3), LLM (OpenAI GPT-4.1 mini), TTS (Cartesia Sonic), VAD (Silero), turn detection (MultilingualModel).
- **LlamaIndex**: RAG pipeline, PDF loading, Chroma vector store.
- **React + Vite**: Frontend with `@livekit/components-react`, mobile-first layout.
- **Overpass / Nominatim**: Golf course search (free, no API key).
- **Vercel**: Frontend + token API + nearby-courses API deployment. LiveKit Cloud for media and agent hosting.

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

Optional: `GOLF_COURSE_API_KEY` for structured hole data when generating course guides (free signup at golfcourseapi.com).

### 2. Agent (Python)

```bash
cd agent
# Install (with uv)
uv sync

# Or with pip
pip install .

# Optional: Place yardage book PDF at agent/data/yardage_book.pdf (TPC Sawgrass or similar)
# Per-course guides are generated under agent/data/courses/

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

Loads `.env` from the project root. Serves `/api/token` and `/api/nearby-courses` (proxied by Vite to `localhost:3001`).

---

## Deploy to Vercel

1. Connect the repo to Vercel; set root to `frontend`.
2. Add env vars: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `VITE_LIVEKIT_URL` (Vercel provides its own URL).
3. Deploy. The `/api/token` and `/api/nearby-courses` serverless functions run automatically.

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
| **Intake** | Handicap, age, handedness, gender. No yardages pre-call; learned via voice. |
| **Course selection** | Geolocation or city/zip → Overpass (leisure=golf_course). Manual course name fallback. |
| **RAG chunking** | 512 tokens, 50 overlap; hole-level metadata when possible |
| **Vector DB** | Chroma (local in agent container); per-course collections for dynamic guides |
| **Course guide generation** | GolfCourseAPI (if key set) + LLM expansion, or LLM-only. Output PDF per course. |
| **Club yardages** | Voice (tool). Stored in `userProfile`. Pushed to frontend via LiveKit data channel; frontend saves to `localStorage`. |
| **Tool call** | `get_nearby_golf_courses` uses Overpass + Nominatim |
| **Hosting** | Frontend + token API + nearby-courses on Vercel; agent on LiveKit Cloud or AWS ECS |
| **Mobile** | Mobile-first layout; touch targets, safe areas, readable transcript |

---

## Project Structure

```
AICaddyVoiceAgent/
├── agent/               # Python LiveKit agent
│   ├── src/
│   │   ├── agent.py
│   │   ├── caddy_agent.py
│   │   ├── course_guide.py   # Course PDF generation (GolfCourseAPI + LLM)
│   │   ├── rag.py
│   │   └── tools.py
│   ├── data/
│   │   ├── yardage_book.pdf
│   │   └── courses/         # Generated per-course PDFs
│   └── vector_store/
├── frontend/            # React + Vite
│   ├── api/
│   │   ├── token.ts         # Vercel serverless
│   │   └── nearby-courses.ts # Overpass/Nominatim proxy
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── IntakeForm.tsx
│   │       ├── CourseSelect.tsx
│   │       ├── PreCallView.tsx
│   │       └── CallView.tsx
│   └── api-server.js    # Local dev (token + nearby-courses)
└── README.md
```
