"use client";

import { useState } from "react";
import classNames from "classnames";

type Flashcard = {
  id: string;
  question: string;
  answer: string;
};

type QuizQuestion = {
  id: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  type: "mcq" | "short";
};

type NotesSection = {
  section_title: string;
  key_points: string[];
  definitions: { term: string; definition: string }[];
};

type UploadKind = "audio" | "slides";

export const RecordingDashboard = () => {
  const [lectureTitle, setLectureTitle] = useState("Untitled Lecture");
  const [uploadKind, setUploadKind] = useState<UploadKind>("audio");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<
    { timestamp: string; text: string }[]
  >([]);
  const [notes, setNotes] = useState<NotesSection[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<"flashcards" | "quiz" | "key-terms">(
    "flashcards"
  );

  const backendBase =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  const handleGenerate = async () => {
    if (!file) {
      alert("Please choose a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lectureTitle", lectureTitle);

    const endpoint =
      uploadKind === "audio" ? "/api/upload/audio" : "/api/upload/slides";

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${backendBase}${endpoint}`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to generate study materials.");
      }

      const data = await res.json();

      setSummary(data.summary ?? null);
      setNotes(data.notes ?? []);
      setFlashcards(data.flashcards ?? []);
      setQuiz(data.quiz ?? []);

      const transcriptText: string | undefined = data.transcript;
      if (transcriptText) {
        const lines = transcriptText
          .split(/\n+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((text) => ({ timestamp: "", text }));
        setLiveTranscript(lines);
      } else {
        setLiveTranscript([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (type: "markdown" | "json") => {
    const payload = {
      title: lectureTitle,
      notes,
      flashcards,
      quiz,
      transcript: liveTranscript
    };

    const blob =
      type === "json"
        ? new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json"
          })
        : new Blob(
            [
              `# ${lectureTitle}\n\n`,
              "## Notes\n",
              ...notes.map((section) => {
                const defs = section.definitions
                  .map((d) => `- **${d.term}**: ${d.definition}`)
                  .join("\n");
                const points = section.key_points
                  .map((p) => `- ${p}`)
                  .join("\n");
                return `### ${section.section_title}\n${points}\n\n${defs}\n\n`;
              })
            ],
            { type: "text/markdown" }
          );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      type === "json" ? "lecture-materials.json" : "lecture-notes.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between bg-surface/80 backdrop-blur">
        <div className="flex items-center gap-4">
          <input
            className="bg-background border border-gray-700 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={lectureTitle}
            onChange={(e) => setLectureTitle(e.target.value)}
            placeholder="Lecture title"
          />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Source:</span>
            <button
              className={classNames(
                "px-3 py-1 rounded-full",
                uploadKind === "audio"
                  ? "bg-accent text-white"
                  : "bg-background text-gray-400"
              )}
              onClick={() => setUploadKind("audio")}
            >
              Audio file
            </button>
            <button
              className={classNames(
                "px-3 py-1 rounded-full",
                uploadKind === "slides"
                  ? "bg-accent text-white"
                  : "bg-background text-gray-400"
              )}
              onClick={() => setUploadKind("slides")}
            >
              Slide deck
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs border border-gray-700 rounded px-3 py-2 cursor-pointer hover:border-accent transition-colors">
            <span className="text-gray-200">
              {file ? "Change file" : "Choose file"}
            </span>
            <input
              type="file"
              accept={
                uploadKind === "audio"
                  ? "audio/*"
                  : ".pdf,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              }
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
              }}
            />
          </label>
          <button
            onClick={handleGenerate}
            disabled={isProcessing}
            className={classNames(
              "px-4 py-2 rounded text-sm font-medium transition-colors",
              isProcessing
                ? "bg-gray-700 text-gray-300 cursor-wait"
                : "bg-accent hover:bg-indigo-500"
            )}
          >
            {isProcessing ? "Generating..." : "Generate Study Materials"}
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)] gap-4 p-4 overflow-hidden">
        <section className="bg-surface rounded-lg border border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">
              Transcript / Slide Text
            </h2>
          </div>
          <div className="flex-1 overflow-auto px-4 py-3 space-y-2 text-sm">
            {liveTranscript.map((line, idx) => (
              <div key={`${line.timestamp}-${idx}`} className="flex gap-2">
                <span className="text-xs text-gray-500 font-mono shrink-0">
                  {line.timestamp}
                </span>
                <p className="text-gray-100">{line.text}</p>
              </div>
            ))}
            {liveTranscript.length === 0 && (
              <p className="text-xs text-gray-500 italic">
                The extracted transcript or slide text will appear here after
                processing your file.
              </p>
            )}
          </div>
        </section>

        <section className="bg-surface rounded-lg border border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">
              Structured Notes
            </h2>
          </div>
          <div className="flex-1 overflow-auto px-4 py-3 space-y-4 text-sm">
            {summary && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 mb-1">
                  Summary
                </p>
                <p className="text-gray-200 text-sm leading-relaxed">
                  {summary}
                </p>
              </div>
            )}
            {notes.map((section) => (
              <div key={section.section_title} className="space-y-2">
                <h3 className="text-xs uppercase tracking-wide text-accent font-semibold">
                  {section.section_title}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-gray-100">
                  {section.key_points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {section.definitions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-400 mb-1">
                      Key Definitions
                    </p>
                    <ul className="space-y-1 text-gray-200">
                      {section.definitions.map((d) => (
                        <li key={d.term}>
                          <span className="font-semibold">{d.term}:</span>{" "}
                          {d.definition}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {notes.length === 0 && (
              <p className="text-xs text-gray-500 italic">
                Upload an audio recording or slide deck and click{" "}
                <span className="font-semibold">Generate Study Materials</span>{" "}
                to see structured notes here.
              </p>
            )}
          </div>
        </section>

        <section className="bg-surface rounded-lg border border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
            <div className="flex gap-2 text-xs">
              <button
                className={classNames(
                  "px-3 py-1 rounded-full",
                  activeTab === "flashcards"
                    ? "bg-accent text-white"
                    : "bg-background text-gray-400"
                )}
                onClick={() => setActiveTab("flashcards")}
              >
                Flashcards
              </button>
              <button
                className={classNames(
                  "px-3 py-1 rounded-full",
                  activeTab === "quiz"
                    ? "bg-accent text-white"
                    : "bg-background text-gray-400"
                )}
                onClick={() => setActiveTab("quiz")}
              >
                Quiz
              </button>
              <button
                className={classNames(
                  "px-3 py-1 rounded-full",
                  activeTab === "key-terms"
                    ? "bg-accent text-white"
                    : "bg-background text-gray-400"
                )}
                onClick={() => setActiveTab("key-terms")}
              >
                Key Terms
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-4 py-3 text-sm">
            {error && (
              <p className="text-xs text-red-400 mb-2">{error}</p>
            )}
            {activeTab === "flashcards" && (
              <div className="space-y-3">
                {flashcards.map((card) => (
                  <div
                    key={card.id}
                    className="border border-gray-700 rounded-md p-3 bg-background/60"
                  >
                    <p className="font-semibold mb-1">{card.question}</p>
                    <p className="text-gray-300 text-sm">{card.answer}</p>
                  </div>
                ))}
                {flashcards.length === 0 && (
                  <p className="text-xs text-gray-500 italic">
                    Flashcards will be generated as the lecture progresses.
                  </p>
                )}
              </div>
            )}
            {activeTab === "quiz" && (
              <div className="space-y-3">
                {quiz.map((q, idx) => (
                  <div
                    key={q.id}
                    className="border border-gray-700 rounded-md p-3 bg-background/60"
                  >
                    <p className="font-semibold mb-1">
                      {idx + 1}. {q.question}
                    </p>
                    {q.options && (
                      <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                        {q.options.map((opt) => (
                          <li key={opt}>{opt}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Correct: {q.correctAnswer}
                    </p>
                  </div>
                ))}
                {quiz.length === 0 && (
                  <p className="text-xs text-gray-500 italic">
                    A practice quiz will appear here near the end of the lecture.
                  </p>
                )}
              </div>
            )}
            {activeTab === "key-terms" && (
              <div className="space-y-2 text-sm">
                {notes.flatMap((section) =>
                  section.definitions.map((d) => (
                    <div key={`${section.section_title}-${d.term}`}>
                      <span className="font-semibold text-accent">
                        {d.term}
                      </span>
                      <span className="text-gray-100"> — {d.definition}</span>
                    </div>
                  ))
                )}
                {notes.every((s) => s.definitions.length === 0) && (
                  <p className="text-xs text-gray-500 italic">
                    Key terms detected in the lecture will appear here.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-gray-800 flex gap-2">
            <button
              onClick={() => handleDownload("markdown")}
              className="flex-1 text-xs border border-gray-700 rounded px-3 py-2 hover:border-accent transition-colors"
            >
              Download Notes (Markdown)
            </button>
            <button
              onClick={() => handleDownload("json")}
              className="flex-1 text-xs border border-gray-700 rounded px-3 py-2 hover:border-accent transition-colors"
            >
              Export Study Pack (JSON)
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

