import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function getTursoClient(): Client {
  if (client) return client;

  const url = import.meta.env.VITE_TURSO_DATABASE_URL;
  const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "VITE_TURSO_DATABASE_URL not set. Run `turso auth login` then `turso db create brain` to get started.",
    );
  }

  client = createClient({
    url,
    authToken,
  });

  return client;
}

// Initialize the database schema
export async function initDatabase(): Promise<void> {
  const db = getTursoClient();

  // Documents table (the knowledge layer filesystem)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Version history (commits)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    )
  `);

  // Transcripts table (meeting recordings)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      segments TEXT NOT NULL,
      meeting_platform TEXT,
      participants TEXT,
      duration_seconds INTEGER,
      recorded_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  console.log("Turso database initialized");
}

// Document operations
export type TursoDocument = {
  id: string;
  path: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
};

export async function getAllDocuments(): Promise<TursoDocument[]> {
  const db = getTursoClient();
  const result = await db.execute("SELECT * FROM documents ORDER BY title");
  return result.rows as unknown as TursoDocument[];
}

export async function getDocument(id: string): Promise<TursoDocument | null> {
  const db = getTursoClient();
  const result = await db.execute({
    sql: "SELECT * FROM documents WHERE id = ?",
    args: [id],
  });
  return (result.rows[0] as unknown as TursoDocument) || null;
}

export async function createDocument(
  id: string,
  path: string,
  title: string,
  content: string,
): Promise<TursoDocument> {
  const db = getTursoClient();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO documents (id, path, title, content, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, path, title, content, now, now],
  });

  return { id, path, title, content, created_at: now, updated_at: now };
}

export async function updateDocument(
  id: string,
  content: string,
): Promise<void> {
  const db = getTursoClient();
  const now = Date.now();

  // Save current version before updating
  const current = await getDocument(id);
  if (current) {
    await db.execute({
      sql: `INSERT INTO document_versions (id, document_id, content, created_at)
            VALUES (?, ?, ?, ?)`,
      args: [`ver-${now}`, id, current.content, now],
    });
  }

  await db.execute({
    sql: "UPDATE documents SET content = ?, updated_at = ? WHERE id = ?",
    args: [content, now, id],
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const db = getTursoClient();
  // Delete versions first (foreign key constraint)
  await db.execute({
    sql: "DELETE FROM document_versions WHERE document_id = ?",
    args: [id],
  });
  await db.execute({
    sql: "DELETE FROM documents WHERE id = ?",
    args: [id],
  });
}

export async function updateDocumentMetadata(
  id: string,
  updates: { title?: string; path?: string },
): Promise<void> {
  const db = getTursoClient();
  const now = Date.now();
  const fields: string[] = [];
  const args: (string | number)[] = [];

  if (updates.title) {
    fields.push("title = ?");
    args.push(updates.title);
  }

  if (updates.path) {
    fields.push("path = ?");
    args.push(updates.path);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  args.push(now);

  args.push(id);

  await db.execute({
    sql: `UPDATE documents SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
}

// Transcript operations
export type TranscriptSegment = {
  start: number;
  end: number;
  speaker: string;
  text: string;
};

export type TursoTranscript = {
  id: string;
  title: string;
  content: string;
  segments: TranscriptSegment[];
  meeting_platform: string | null;
  participants: string[];
  duration_seconds: number | null;
  recorded_at: number;
  created_at: number;
};

type RawTranscript = {
  id: string;
  title: string;
  content: string;
  segments: string;
  meeting_platform: string | null;
  participants: string | null;
  duration_seconds: number | null;
  recorded_at: number;
  created_at: number;
};

function parseTranscript(raw: RawTranscript): TursoTranscript {
  return {
    ...raw,
    segments: JSON.parse(raw.segments) as TranscriptSegment[],
    participants: raw.participants ? JSON.parse(raw.participants) : [],
  };
}

export async function getAllTranscripts(): Promise<TursoTranscript[]> {
  const db = getTursoClient();
  const result = await db.execute(
    "SELECT * FROM transcripts ORDER BY recorded_at DESC",
  );
  return (result.rows as unknown as RawTranscript[]).map(parseTranscript);
}

export async function getTranscript(
  id: string,
): Promise<TursoTranscript | null> {
  const db = getTursoClient();
  const result = await db.execute({
    sql: "SELECT * FROM transcripts WHERE id = ?",
    args: [id],
  });
  const raw = result.rows[0] as unknown as RawTranscript;
  return raw ? parseTranscript(raw) : null;
}

export async function createTranscript(
  id: string,
  title: string,
  content: string,
  segments: TranscriptSegment[],
  meetingPlatform: string | null,
  participants: string[],
  durationSeconds: number | null,
  recordedAt: number,
): Promise<TursoTranscript> {
  const db = getTursoClient();
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO transcripts (id, title, content, segments, meeting_platform, participants, duration_seconds, recorded_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      title,
      content,
      JSON.stringify(segments),
      meetingPlatform,
      JSON.stringify(participants),
      durationSeconds,
      recordedAt,
      now,
    ],
  });

  return {
    id,
    title,
    content,
    segments,
    meeting_platform: meetingPlatform,
    participants,
    duration_seconds: durationSeconds,
    recorded_at: recordedAt,
    created_at: now,
  };
}

export async function deleteTranscript(id: string): Promise<void> {
  const db = getTursoClient();
  await db.execute({
    sql: "DELETE FROM transcripts WHERE id = ?",
    args: [id],
  });
}
