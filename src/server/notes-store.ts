import type { Note } from "@/lib/notes";
import { sanitizeNotes, seedNotes } from "@/lib/notes";

const SQLITE_PATH = process.env.SQLITE_PATH || ".data/notes.db";
const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID;
const SUPABASE_URL =
	process.env.SUPABASE_URL ||
	(SUPABASE_PROJECT_ID ? `https://${SUPABASE_PROJECT_ID}.supabase.co` : "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "app_state";

type PostgresPoolLike = {
	query: (
		text: string,
		params?: unknown[],
	) => Promise<{ rows: Array<{ notes: unknown }> }>;
};

let sqliteDb: null | {
	exec: (sql: string) => void;
	prepare: (sql: string) => {
		get: (...args: unknown[]) => { notes?: string } | undefined;
		run: (...args: unknown[]) => void;
	};
} = null;

let pgPool: PostgresPoolLike | null = null;

export async function loadNotesFromStore(ownerId: string): Promise<Note[]> {
	const raw = await readRawNotes(ownerId);
	const sanitized = sanitizeNotes(raw);
	return sanitized.length > 0 ? sanitized : seedNotes;
}

export async function saveNotesToStore(ownerId: string, notes: Note[]) {
	const cleaned = sanitizeNotes(notes);
	await writeRawNotes(ownerId, cleaned);
}

async function readRawNotes(ownerId: string) {
	const scopedId = toScopedBoardId(ownerId);
	const backend = resolveBackend();
	if (backend === "supabase") {
		return await readSupabaseNotes(scopedId);
	}

	if (backend === "postgres") {
		const pool = await getPostgresPool();
		const result = await pool.query(
			"SELECT notes FROM app_state WHERE id = $1",
			[scopedId],
		);
		return result.rows[0]?.notes ?? seedNotes;
	}

	const db = await getSqliteDb();
	const row = db
		.prepare("SELECT notes FROM app_state WHERE id = ?")
		.get(scopedId) as { notes?: string } | undefined;
	if (!row?.notes) {
		return seedNotes;
	}
	try {
		return JSON.parse(row.notes) as unknown;
	} catch {
		return seedNotes;
	}
}

async function writeRawNotes(ownerId: string, notes: Note[]) {
	const scopedId = toScopedBoardId(ownerId);
	const backend = resolveBackend();
	if (backend === "supabase") {
		await writeSupabaseNotes(scopedId, notes);
		return;
	}

	if (backend === "postgres") {
		const pool = await getPostgresPool();
		await pool.query(
			`INSERT INTO app_state (id, notes, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET notes = EXCLUDED.notes, updated_at = NOW()`,
			[scopedId, JSON.stringify(notes)],
		);
		return;
	}

	const db = await getSqliteDb();
	db.prepare(
		`INSERT INTO app_state (id, notes, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(id)
     DO UPDATE SET notes = excluded.notes, updated_at = datetime('now')`,
	).run(scopedId, JSON.stringify(notes));
}

function resolveBackend() {
	if (SUPABASE_URL && SUPABASE_ANON_KEY) {
		return "supabase" as const;
	}
	if (process.env.DATABASE_URL) {
		return "postgres" as const;
	}
	return "sqlite" as const;
}

async function readSupabaseNotes(scopedId: string) {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
		return seedNotes;
	}

	const endpoint = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(
		scopedId,
	)}&select=notes&limit=1`;
	const response = await fetch(endpoint, {
		method: "GET",
		headers: {
			apikey: SUPABASE_ANON_KEY,
			Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
		},
	});
	if (!response.ok) {
		throw new Error(`Supabase read failed with status ${response.status}`);
	}
	const rows = (await response.json()) as Array<{ notes?: unknown }>;
	return rows[0]?.notes ?? seedNotes;
}

async function writeSupabaseNotes(scopedId: string, notes: Note[]) {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
		throw new Error("Supabase is not configured.");
	}

	const endpoint = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;
	const payload = [
		{
			id: scopedId,
			notes,
			updated_at: new Date().toISOString(),
		},
	];
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			apikey: SUPABASE_ANON_KEY,
			Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
			"Content-Type": "application/json",
			Prefer: "resolution=merge-duplicates",
		},
		body: JSON.stringify(payload),
	});
	if (!response.ok) {
		throw new Error(`Supabase write failed with status ${response.status}`);
	}
}

function toScopedBoardId(ownerId: string) {
	const cleaned = String(ownerId || "").trim();
	if (!cleaned) {
		throw new Error("Owner ID is required for note persistence.");
	}
	return `user:${cleaned}`;
}

async function getSqliteDb() {
	if (sqliteDb) {
		return sqliteDb;
	}

	const sqlite = await import("node:sqlite");
	const path = await import("node:path");
	const fs = await import("node:fs/promises");

	const resolvedPath = path.resolve(process.cwd(), SQLITE_PATH);
	await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

	const db = new sqlite.DatabaseSync(resolvedPath);
	db.exec(
		`CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      notes TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
	);
	sqliteDb = db;
	return db;
}

async function getPostgresPool() {
	if (pgPool) {
		return pgPool;
	}

	let pgModule: {
		Pool: new (config: { connectionString: string }) => PostgresPoolLike;
	};
	try {
		const pgImportPath = "pg";
		pgModule = (await import(/* @vite-ignore */ pgImportPath)) as {
			Pool: new (config: { connectionString: string }) => PostgresPoolLike;
		};
	} catch {
		throw new Error(
			'DATABASE_URL is set but "pg" is not installed. Add pg to dependencies to use Postgres.',
		);
	}

	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error("DATABASE_URL is missing.");
	}

	const pool = new pgModule.Pool({ connectionString });
	await pool.query(
		`CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      notes JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
	);
	pgPool = pool;
	return pool;
}
