import type { Note } from "@/lib/notes";

export function hasRevisionAdvance(
	currentRevision: number,
	incomingRevision: number,
) {
	return incomingRevision > currentRevision;
}

export function isSelfUpdate(
	updatedBy: string | null | undefined,
	currentUserId: string,
) {
	return Boolean(updatedBy && updatedBy === currentUserId);
}

export function shouldApplyIncomingState(
	currentRevision: number,
	incomingRevision: number,
) {
	return hasRevisionAdvance(currentRevision, incomingRevision);
}

/**
 * Deterministic hash of a note's content fields for fast equality checks.
 * Excludes `id` since we compare notes by ID separately.
 */
export function computeNoteHash(note: Note): string {
	const parts = [
		note.title,
		note.body,
		note.tag,
		note.link,
		note.color,
		note.reactionEmoji,
		String(note.x),
		String(note.y),
		String(note.width),
		String(note.height),
		note.imageDataUrl,
		note.imageFit,
		String(note.imageNaturalWidth),
		String(note.imageNaturalHeight),
	];
	return parts.join("\0");
}

export type MergeResult = {
	merged: Note[];
	conflicts: Array<{ noteId: string; local: Note; remote: Note }>;
};

/**
 * Three-way note-level merge using a baseline (lastSyncedNotes).
 *
 * - Notes only in remote → add (new remote note)
 * - Notes only in local → keep (locally created, not yet saved)
 * - Notes in both: compare to baseline:
 *   - If local unchanged from baseline → take remote version
 *   - If remote unchanged from baseline → keep local version
 *   - If both changed → mark as conflict
 * - Notes only in baseline (deleted remotely or locally) → honor the deletion
 */
export function mergeRemoteNotes(
	localNotes: Note[],
	remoteNotes: Note[],
	lastSyncedNotes: Note[],
): MergeResult {
	const remoteMap = new Map(remoteNotes.map((n) => [n.id, n]));
	const baselineMap = new Map(lastSyncedNotes.map((n) => [n.id, n]));

	const merged: Note[] = [];
	const conflicts: MergeResult["conflicts"] = [];
	const seen = new Set<string>();

	// Process all notes present in local
	for (const localNote of localNotes) {
		seen.add(localNote.id);
		const remoteNote = remoteMap.get(localNote.id);
		const baselineNote = baselineMap.get(localNote.id);

		if (!remoteNote) {
			// Not in remote — was it deleted remotely or created locally?
			if (baselineNote) {
				// Was in baseline, deleted remotely → honor deletion
				continue;
			}
			// Not in baseline either → locally created, keep it
			merged.push(localNote);
			continue;
		}

		// Present in both local and remote
		const localHash = computeNoteHash(localNote);
		const remoteHash = computeNoteHash(remoteNote);

		if (localHash === remoteHash) {
			// Identical — take either
			merged.push(localNote);
			continue;
		}

		const baselineHash = baselineNote ? computeNoteHash(baselineNote) : null;

		if (baselineHash === null) {
			// New in both local and remote with same ID (unlikely) — take remote
			merged.push(remoteNote);
			continue;
		}

		const localChanged = localHash !== baselineHash;
		const remoteChanged = remoteHash !== baselineHash;

		if (!localChanged && remoteChanged) {
			// Only remote changed → take remote
			merged.push(remoteNote);
		} else if (localChanged && !remoteChanged) {
			// Only local changed → keep local (user actively edited)
			merged.push(localNote);
		} else {
			// Both changed → conflict; take remote but record it
			merged.push(remoteNote);
			conflicts.push({
				noteId: localNote.id,
				local: localNote,
				remote: remoteNote,
			});
		}
	}

	// Process notes only in remote (not seen from local)
	for (const remoteNote of remoteNotes) {
		if (seen.has(remoteNote.id)) continue;
		const baselineNote = baselineMap.get(remoteNote.id);
		if (baselineNote) {
			// Was in baseline and local doesn't have it → locally deleted
			continue;
		}
		// New remote note → add it
		merged.push(remoteNote);
	}

	return { merged, conflicts };
}

/**
 * Exponential backoff with jitter.
 * Returns milliseconds to wait before retry attempt.
 */
export function backoffMs(
	attempt: number,
	baseMs = 500,
	maxMs = 10000,
): number {
	const exponential = baseMs * 2 ** attempt;
	const jitter = Math.random() * baseMs;
	return Math.min(exponential + jitter, maxMs);
}

/**
 * Random delay for reconnection to prevent thundering herd.
 */
export function reconnectJitterMs(baseMs = 1000, maxMs = 5000): number {
	return baseMs + Math.random() * (maxMs - baseMs);
}
