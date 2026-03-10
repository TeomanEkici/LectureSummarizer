import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import http from "http";
import { WebSocketServer } from "ws";
import { Pool } from "pg";
import { processTranscriptChunk, runFinalProcessing } from "./llm";
import { transcribeAudioChunk } from "./stt";
import {
  createLectureIfNotExists,
  insertTranscriptChunk,
  upsertGeneratedNotes
} from "./storage";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/lecture" });

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000"
  })
);

const upload = multer({ storage: multer.memoryStorage() });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

type LectureContext = {
  lectureId: number;
  transcript: string;
};

const lectureContexts = new Map<string, LectureContext>();

const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => {
    clients.delete(ws);
  });
});

app.post(
  "/api/audio-chunk",
  upload.single("audio"),
  async (req, res): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Missing audio file" });
        return;
      }

      const lectureTitle = (req.body.lectureTitle as string) || "Untitled";
      const userId = 1;

      const poolClient = await pool.connect();
      try {
        const lectureId = await createLectureIfNotExists(
          poolClient,
          userId,
          lectureTitle
        );

        const transcriptText = await transcribeAudioChunk(req.file.buffer);

        const timestamp = new Date().toISOString();
        await insertTranscriptChunk(poolClient, lectureId, timestamp, transcriptText);

        const key = `${userId}:${lectureId}`;
        const existing = lectureContexts.get(key) ?? {
          lectureId,
          transcript: ""
        };
        const updatedTranscript =
          existing.transcript + "\n" + `[${timestamp}] ${transcriptText}`;
        lectureContexts.set(key, { lectureId, transcript: updatedTranscript });

        const aiOutput = await processTranscriptChunk(
          updatedTranscript,
          transcriptText
        );

        await upsertGeneratedNotes(poolClient, lectureId, aiOutput);

        const wsPayloadTranscript = JSON.stringify({
          type: "transcript",
          payload: {
            timestamp: new Date().toLocaleTimeString(),
            text: transcriptText
          }
        });

        const wsPayloadNotes = JSON.stringify({
          type: "notes",
          payload: aiOutput.notesSection
        });

        const wsPayloadFlashcards = JSON.stringify({
          type: "flashcards",
          payload: aiOutput.flashcards
        });

        const wsPayloadQuiz = JSON.stringify({
          type: "quiz",
          payload: aiOutput.quizQuestions
        });

        clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(wsPayloadTranscript);
            client.send(wsPayloadNotes);
            client.send(wsPayloadFlashcards);
            client.send(wsPayloadQuiz);
          }
        });

        res.json({ ok: true });
      } finally {
        poolClient.release();
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to process audio chunk" });
    }
  }
);

app.post("/api/lectures/:lectureId/finalize", async (req, res) => {
  const lectureId = Number(req.params.lectureId);
  if (!Number.isFinite(lectureId)) {
    res.status(400).json({ error: "Invalid lecture id" });
    return;
  }

  const client = await pool.connect();
  try {
    const result = await runFinalProcessing(client, lectureId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to run final processing" });
  } finally {
    client.release();
  }
});

const port = Number(process.env.PORT) || 4000;
server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

