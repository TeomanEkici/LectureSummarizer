CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

-- Seed default user (id=1) so lectures can be created without auth
INSERT INTO users (id, email, password_hash) VALUES (1, 'default@local', '')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS lectures (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTERVAL
);

CREATE TABLE IF NOT EXISTS transcript_chunks (
  id SERIAL PRIMARY KEY,
  lecture_id INTEGER NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generated_notes (
  id SERIAL PRIMARY KEY,
  lecture_id INTEGER NOT NULL UNIQUE REFERENCES lectures(id) ON DELETE CASCADE,
  summary TEXT,
  key_points JSONB,
  flashcards JSONB,
  quiz_questions JSONB
);
