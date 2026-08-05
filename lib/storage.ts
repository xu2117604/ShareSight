import { env } from "cloudflare:workers";

export type StoredFile = {
  id: number;
  objectKey: string;
  title: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  category: "journal" | "presentation" | "document";
  folder: string;
  notes: string;
  uploaderPhone: string;
  uploaderName: string;
  uploadedAt: string;
};

type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
};

export function getBindings() {
  const bindings = env as unknown as Partial<Bindings>;
  if (!bindings.DB || !bindings.FILES) throw new Error("资料存储尚未连接");
  return bindings as Bindings;
}

export async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      object_key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      category TEXT NOT NULL,
      folder TEXT NOT NULL DEFAULT '0',
      notes TEXT NOT NULL DEFAULT '',
      uploader_phone TEXT NOT NULL,
      uploader_name TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS schedule_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by_phone TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS files_uploaded_at_idx ON files(uploaded_at DESC)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS folders_parent_name_idx ON folders(parent_id, name)"),
    db.prepare("CREATE INDEX IF NOT EXISTS folders_parent_idx ON folders(parent_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS schedule_notes_date_idx ON schedule_notes(note_date, created_at)"),
  ]);
  const columns = await db.prepare("PRAGMA table_info(files)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "folder")) {
    await db.prepare("ALTER TABLE files ADD COLUMN folder TEXT NOT NULL DEFAULT '0'").run();
  }
  await db.prepare(
    "UPDATE files SET folder = '0' WHERE folder IN ('work-log', 'information', 'meeting-materials', 'metagenomics', 'metabarcoding', 'study-notes')",
  ).run();
}
