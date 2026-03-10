\"use client\";

import { useEffect, useRef, useState } from "react";
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

type SocketEvent =
  | { type: "transcript"; payload: { timestamp: string; text: string } }
  | { type: "notes"; payload: NotesSection }
  | { type: "flashcards"; payload: Flashcard[] }
  | { type: "quiz"; payload: QuizQuestion[] };

export const RecordingDashboard = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [lectureTitle, setLectureTitle] = useState("Untitled Lecture");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<
    { timestamp: string; text: string }[]
  >([]);
  const [notes, setNotes] = useState<NotesSection[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<"flashcards" | "quiz" | "key-terms">("flashcards");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  useEffect(() => {
    const socketUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws/lecture";
    const ws = new WebSocket(socketUrl);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data: SocketEvent = JSON.parse(event.data);
        if (data.type === "transcript") {
          setLiveTranscript((prev) => [...prev, data.payload]);
        } else if (data.type === "notes") {
          setNotes((prev) => [...prev, data.payload]);
        } else if (data.type === "flashcards") {
          setFlashcards(data.payload);
        } else if (data.type === "quiz") {
          setQuiz(data.payload);
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Your browser does not support audio recording.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
        void sendAudioChunk(event.data);
      }
    };

    mediaRecorder.start(5000); // request data every 5 seconds
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "end_lecture" }));
    }
  };

  const sendAudioChunk = async (chunk: Blob) => {
    const formData = new FormData();
    formData.append("audio", chunk, "chunk.webm");
    formData.append("lectureTitle", lectureTitle);

    try {
      await fetch(
        process.env.NEXT_PUBLIC_BACKEND_URL ||
          "http://localhost:4000/api/audio-chunk",
        {
          method: "POST",
          body: formData
        }
      );
    } catch {
      // network error, ignore for now
    }
  };

  const formatTime = (seconds: number) => {
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
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
          />
          <span className="text-sm text-gray-400">
            Timer: <span className="font-mono">{formatTime(elapsed)}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={classNames(
              "px-4 py-2 rounded text-sm font-medium transition-colors",
              isRecording
                ? "bg-red-600 hover:bg-red-500"
                : "bg-accent hover:bg-indigo-500"
            )}
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)] gap-4 p-4 overflow-hidden">
        <section className="bg-surface rounded-lg border border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">
              Live Transcript
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
                Transcript will appear here as the lecture is processed.
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
                AI-generated notes will appear here in real time.
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

