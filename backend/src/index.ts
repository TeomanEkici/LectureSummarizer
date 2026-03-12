import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import http from "http";
import { Pool } from "pg";
import { generateStudyMaterialsFromTranscript, runFinalProcessing } from "./llm";
import { transcribeAudioChunk } from "./stt";
import {
  createLectureIfNotExists,
  insertTranscriptChunk,
  upsertGeneratedNotes
} from "./storage";
import { extractTextFromSlides } from "./slides";

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000"
  })
);

const upload = multer({ storage: multer.memoryStorage() });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.post(
  "/api/upload/audio",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = (req as any).file as any | undefined;
      if (!file) {
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

        const transcriptText = await transcribeAudioChunk(file.buffer);
        const timestamp = new Date().toISOString();

        await insertTranscriptChunk(
          poolClient,
          lectureId,
          timestamp,
          transcriptText
        );

        const finalResult = await runFinalProcessing(poolClient, lectureId);

        await upsertGeneratedNotes(poolClient, lectureId, {
          notesSection: finalResult.notes[0] ?? {
            section_title: lectureTitle,
            key_points: [],
            definitions: []
          },
          flashcards: finalResult.flashcards,
          quizQuestions: finalResult.quiz
        });

        res.json({
          lectureId,
          transcript: transcriptText,
          ...finalResult
        });
      } finally {
        poolClient.release();
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to process audio upload" });
    }
  }
);

app.post(
  "/api/upload/slides",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = (req as any).file as any | undefined;
      if (!file) {
        res.status(400).json({ error: "Missing slide deck file" });
        return;
      }

      const lectureTitle = (req.body.lectureTitle as string) || "Untitled";
      const userId = 1;

      const text = await extractTextFromSlides(file.buffer);
      const useDb = !!process.env.DATABASE_URL;

      if (!useDb) {
        const finalResult = await generateStudyMaterialsFromTranscript(text);
        res.json({
          lectureId: null,
          transcript: text,
          ...finalResult
        });
        return;
      }

      const poolClient = await pool.connect();
      try {
        const lectureId = await createLectureIfNotExists(
          poolClient,
          userId,
          lectureTitle
        );

        const timestamp = new Date().toISOString();
        await insertTranscriptChunk(poolClient, lectureId, timestamp, text);

        const finalResult = await runFinalProcessing(poolClient, lectureId);

        await upsertGeneratedNotes(poolClient, lectureId, {
          notesSection: finalResult.notes[0] ?? {
            section_title: lectureTitle,
            key_points: [],
            definitions: []
          },
          flashcards: finalResult.flashcards,
          quizQuestions: finalResult.quiz
        });

        res.json({
          lectureId,
          transcript: text,
          ...finalResult
        });
      } finally {
        poolClient.release();
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to process slide upload" });
    }
  }
);

const port = Number(process.env.PORT) || 4000;
server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
