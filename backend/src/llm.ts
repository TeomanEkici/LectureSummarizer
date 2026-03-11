import OpenAI from "openai";
import type { PoolClient } from "pg";

export type NotesSection = {
  section_title: string;
  key_points: string[];
  definitions: { term: string; definition: string }[];
};

export type Flashcard = {
  id: string;
  question: string;
  answer: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  type: "mcq" | "short";
};

export type AIChunkOutput = {
  notesSection: NotesSection;
  flashcards: Flashcard[];
  quizQuestions: QuizQuestion[];
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function processTranscriptChunk(
  fullTranscript: string,
  recentChunk: string
): Promise<AIChunkOutput> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      notesSection: {
        section_title: "Lecture Section",
        key_points: [recentChunk],
        definitions: []
      },
      flashcards: [],
      quizQuestions: []
    };
  }

  const prompt = `
You are an AI study assistant. The following is a partial transcript of a lecture, along with the most recent chunk.

Full transcript so far:
${fullTranscript}

Most recent chunk:
${recentChunk}

1. Extract or update a single coherent notes section from the most recent content.
2. Propose a few flashcards.
3. Propose a few quiz questions (mixture of multiple choice and short answer).

Return STRICT JSON with this shape:
{
  "notesSection": {
    "section_title": string,
    "key_points": string[],
    "definitions": [
      { "term": string, "definition": string }
    ]
  },
  "flashcards": [
    { "id": string, "question": string, "answer": string }
  ],
  "quizQuestions": [
    {
      "id": string,
      "question": string,
      "options": string[] | null,
      "correctAnswer": string,
      "type": "mcq" | "short"
    }
  ]
}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("Empty LLM response");
  }

  const parsed = JSON.parse(content) as AIChunkOutput;
  return parsed;
}

export async function runFinalProcessing(client: PoolClient, lectureId: number) {
  const transcriptRes = await client.query(
    "SELECT timestamp, text FROM transcript_chunks WHERE lecture_id = $1 ORDER BY timestamp ASC",
    [lectureId]
  );

  const fullTranscript = transcriptRes.rows
    .map((row) => `[${row.timestamp.toISOString?.() ?? row.timestamp}] ${row.text}`)
    .join("\n");

  return generateStudyMaterialsFromTranscript(fullTranscript, lectureId, client);
}

export async function generateStudyMaterialsFromTranscript(
  fullTranscript: string,
  lectureId?: number,
  client?: PoolClient
) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      summary: "Summary placeholder (set OPENAI_API_KEY to enable real summaries).",
      notes: [] as NotesSection[],
      flashcards: [] as Flashcard[],
      quiz: [] as QuizQuestion[]
    };
  }

  const prompt = `
You are an AI tutor. Given the full lecture transcript below, produce:

1. Clean, structured notes organized into sections.
2. A 200–300 word summary.
3. A comprehensive set of study flashcards.
4. A 5–10 question practice quiz (mix MCQ and short answer).

Transcript:
${fullTranscript}

Return STRICT JSON with shape:
{
  "summary": string,
  "notes": [
    {
      "section_title": string,
      "key_points": string[],
      "definitions": [
        { "term": string, "definition": string }
      ]
    }
  ],
  "flashcards": [
    { "id": string, "question": string, "answer": string }
  ],
  "quiz": [
    {
      "id": string,
      "question": string,
      "options": string[] | null,
      "correctAnswer": string,
      "type": "mcq" | "short"
    }
  ]
}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("Empty LLM response");
  }

  const parsed = JSON.parse(content) as {
    summary: string;
    notes: NotesSection[];
    flashcards: Flashcard[];
    quiz: QuizQuestion[];
  };
  if (client && typeof lectureId === "number") {
    await client.query(
      `
      UPDATE generated_notes
      SET summary = $1,
          key_points = $2,
          flashcards = $3,
          quiz_questions = $4
      WHERE lecture_id = $5
    `,
      [
        parsed.summary,
        JSON.stringify(parsed.notes),
        JSON.stringify(parsed.flashcards),
        JSON.stringify(parsed.quiz),
        lectureId
      ]
    );
  }

  return parsed;
}

