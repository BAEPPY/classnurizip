import { mkdirSync } from 'node:fs';

const schema = `
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      class_key TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      sequence BIGSERIAL UNIQUE,
      author TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('daily', 'question', 'book', 'proud')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      sequence BIGSERIAL UNIQUE,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id, sequence);
    CREATE INDEX IF NOT EXISTS posts_created ON posts(sequence DESC);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      identity_hash TEXT UNIQUE,
      created_at TEXT NOT NULL
    );
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS student_id TEXT;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS student_id TEXT;
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS student_id TEXT;
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE;
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS normalized_content TEXT;
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS mission_eligible BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE UNIQUE INDEX IF NOT EXISTS comments_student_content ON comments(student_id, normalized_content)
      WHERE student_id IS NOT NULL AND normalized_content IS NOT NULL;
    CREATE INDEX IF NOT EXISTS comments_mission ON comments(student_id, mission_eligible);
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      PRIMARY KEY (post_id, student_id)
    );
`;

export async function openDatabase({ dataDir, databaseUrl }) {
  if (databaseUrl) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(databaseUrl);
    // Local development and Neon use the same PostgreSQL schema and parameterized SQL.
    for (const statement of schema.split(';').filter((part) => part.trim()))
      await sql.query(statement);
    return {
      query: (statement, params = []) => sql.query(statement, params),
      close: async () => {},
    };
  }
  if (process.env.VERCEL)
    throw new Error('DATABASE_URL is required on Vercel. Local storage is not persistent there.');
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new PGlite(dataDir);
  await db.waitReady;
  await db.exec(schema);
  return {
    query: async (statement, params = []) => (await db.query(statement, params)).rows,
    close: () => db.close(),
  };
}
