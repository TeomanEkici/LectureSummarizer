import type { PoolClient } from "pg";
import type { AIChunkOutput } from "./llm";

export async function createLectureIfNotExists(
  client: PoolClient,
  userId: number,
  title: string
): Promise<number> {
  const res = await client.query(
    `
    INSERT INTO lectures (user_id, title, date)
    VALUES ($1, $2, NOW())
    RETURNING id
  `,
    [userId, title]
  );
  return res.rows[0].id as number;
}

export async function insertTranscriptChunk(
  client: PoolClient,
  lectureId: number,
  timestamp: string,
  text: string
) {
  await client.query(
    `
    INSERT INTO transcript_chunks (lecture_id, timestamp, text)
    VALUES ($1, $2, $3)
  `,
    [lectureId, timestamp, text]
  );
}

export async function upsertGeneratedNotes(
  client: PoolClient,
  lectureId: number,
  aiOutput: AIChunkOutput
) {
  await client.query(
    `
    INSERT INTO generated_notes (lecture_id, summary, key_points, flashcards, quiz_questions)
    VALUES ($1, '', $2, $3, $4)
    ON CONFLICT (lecture_id)
    DO UPDATE SET
      key_points = $2,
      flashcards = $3,
      quiz_questions = $4
  `,
    [
      lectureId,
      JSON.stringify(aiOutput.notesSection),
      JSON.stringify(aiOutput.flashcards),
      JSON.stringify(aiOutput.quizQuestions)
    ]
  );
}
