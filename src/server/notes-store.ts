import type { Note } from '@/lib/notes'
import { sanitizeNotes, seedNotes } from '@/lib/notes'

const SQLITE_PATH = process.env.SQLITE_PATH || '.data/notes.db'

type PostgresPoolLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ notes: unknown }> }>
}

let sqliteDb: null | {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    get: (...args: unknown[]) => { notes?: string } | undefined
    run: (...args: unknown[]) => void
  }
} = null

let pgPool: PostgresPoolLike | null = null

export async function loadNotesFromStore(): Promise<Note[]> {
  const raw = await readRawNotes()
  const sanitized = sanitizeNotes(raw)
  return sanitized.length > 0 ? sanitized : seedNotes
}

export async function saveNotesToStore(notes: Note[]) {
  const cleaned = sanitizeNotes(notes)
  await writeRawNotes(cleaned)
}

async function readRawNotes() {
  const backend = process.env.DATABASE_URL ? 'postgres' : 'sqlite'
  if (backend === 'postgres') {
    const pool = await getPostgresPool()
    const result = await pool.query('SELECT notes FROM app_state WHERE id = $1', ['main'])
    return result.rows[0]?.notes ?? seedNotes
  }

  const db = await getSqliteDb()
  const row = db
    .prepare('SELECT notes FROM app_state WHERE id = ?')
    .get('main') as { notes?: string } | undefined
  if (!row?.notes) {
    return seedNotes
  }
  try {
    return JSON.parse(row.notes) as unknown
  } catch {
    return seedNotes
  }
}

async function writeRawNotes(notes: Note[]) {
  const backend = process.env.DATABASE_URL ? 'postgres' : 'sqlite'
  if (backend === 'postgres') {
    const pool = await getPostgresPool()
    await pool.query(
      `INSERT INTO app_state (id, notes, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET notes = EXCLUDED.notes, updated_at = NOW()`,
      ['main', JSON.stringify(notes)]
    )
    return
  }

  const db = await getSqliteDb()
  db.prepare(
    `INSERT INTO app_state (id, notes, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(id)
     DO UPDATE SET notes = excluded.notes, updated_at = datetime('now')`
  ).run('main', JSON.stringify(notes))
}

async function getSqliteDb() {
  if (sqliteDb) {
    return sqliteDb
  }

  const sqlite = await import('node:sqlite')
  const path = await import('node:path')
  const fs = await import('node:fs/promises')

  const resolvedPath = path.resolve(process.cwd(), SQLITE_PATH)
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true })

  const db = new sqlite.DatabaseSync(resolvedPath)
  db.exec(
    `CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      notes TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  )
  sqliteDb = db
  return db
}

async function getPostgresPool() {
  if (pgPool) {
    return pgPool
  }

  let pgModule: { Pool: new (config: { connectionString: string }) => PostgresPoolLike }
  try {
    const pgImportPath = 'pg'
    pgModule = (await import(/* @vite-ignore */ pgImportPath)) as {
      Pool: new (config: { connectionString: string }) => PostgresPoolLike
    }
  } catch {
    throw new Error(
      'DATABASE_URL is set but "pg" is not installed. Add pg to dependencies to use Postgres.'
    )
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing.')
  }

  const pool = new pgModule.Pool({ connectionString })
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      notes JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  )
  pgPool = pool
  return pool
}
