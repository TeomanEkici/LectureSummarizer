## AI Lecture Note Generator

This project is a full-stack web application that records classroom lectures and turns them into structured notes, flashcards, and quizzes in real time.

### Tech Stack

- **Frontend**: Next.js 14 (App Router) + React + Tailwind CSS
- **Backend**: Node.js + Express + WebSockets (`ws`)
- **Database**: PostgreSQL (via `pg`)
- **AI Services**:
  - Speech-to-text via AssemblyAI (pluggable)
  - LLM via OpenAI (GPT-4.1 mini by default)

### Project Structure

- `frontend/` – Next.js app with recording UI, live transcript, notes, flashcards, and quiz panels.
- `backend/` – Express server handling audio chunks, transcription, AI processing, and WebSocket pushes.

### Getting Started

1. **Install dependencies** (from the project root):

   ```bash
   pnpm install
   ```

2. **Environment variables**

   Create `backend/.env`:

   ```bash
   PORT=4000
   DATABASE_URL=postgres://user:password@localhost:5432/lecture_notes
   FRONTEND_ORIGIN=http://localhost:3000
   STT_PROVIDER=assemblyai
   ASSEMBLYAI_API_KEY=your_assemblyai_key
   OPENAI_API_KEY=your_openai_key
   ```

   Create `frontend/.env.local`:

   ```bash
   NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
   NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws/lecture
   ```

3. **Prepare the database**

   ```bash
   createdb lecture_notes
   psql lecture_notes -f backend/schema.sql
   ```

4. **Run the apps**

   In the project root:

   ```bash
   pnpm dev
   ```

   This runs both the backend (on `http://localhost:4000`) and the frontend (on `http://localhost:3000`).

### How It Works (High Level)

- The browser records microphone audio using `MediaRecorder` and sends chunks every ~5 seconds to the backend.
- The backend streams each chunk to a speech-to-text provider (e.g., AssemblyAI) and stores the transcript.
- For each new chunk, the backend sends recent transcript context to an LLM, which:
  - Updates structured notes
  - Generates flashcards
  - Proposes quiz questions
- Updates are pushed to the frontend in real time over WebSockets.
- When the lecture ends, a final LLM pass creates polished notes, a summary, a full flashcard set, and a practice quiz.

