import type { Note } from "@/lib/notes";
import { sanitizeNotes, seedNotes } from "@/lib/notes";
import {
	enforceAcceptInviteRateLimit,
	enforceCreateInviteRateLimit,
} from "./invite-rate-limit";

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID;
const SUPABASE_URL =
	process.env.SUPABASE_URL ||
	(SUPABASE_PROJECT_ID ? `https://${SUPABASE_PROJECT_ID}.supabase.co` : "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

type BoardSummary = {
	id: string;
	title: string;
	role: "owner" | "editor" | "viewer";
	ownerUserId: string;
	createdAt: string;
	updatedAt: string;
};

export type BoardDetails = {
	id: string;
	title: string;
	ownerUserId: string;
	createdAt: string;
	updatedAt: string;
};

export type BoardMemberSummary = {
	userId: string;
	role: "owner" | "editor" | "viewer";
	createdAt: string;
};

export type BoardOwnershipTransferResult = {
	boardId: string;
	newOwnerUserId: string;
};

export type InviteAcceptResult = {
	boardId: string;
	status: "joined" | "already_member";
};

export type BoardAccess = {
	role: "owner" | "editor" | "viewer";
	canEdit: boolean;
	isOwner: boolean;
};

export type BoardInviteSummary = {
	id: string;
	token: string;
	role: "editor" | "viewer";
	isReusable: boolean;
	acceptedCount: number;
	lastAcceptedBy: string | null;
	lastAcceptedAt: string | null;
	expiresAt: string;
	revokedAt: string | null;
	createdAt: string;
};

export type BoardSnapshot = {
	notes: Note[];
	revision: number;
	updatedBy: string | null;
	updatedAt: string | null;
};

export async function listBoards(accessToken: string, userId: string) {
	const rows = await restFetch<
		Array<{
			role: string;
			boards: null | {
				id: string;
				title: string;
				owner_user_id: string;
				created_at: string;
				updated_at: string;
			};
		}>
	>(
		`/rest/v1/board_members?user_id=eq.${encodeURIComponent(
			userId,
		)}&select=role,boards!inner(id,title,owner_user_id,created_at,updated_at)&order=created_at.desc`,
		{
			method: "GET",
			accessToken,
		},
	);

	return rows
		.filter((row) => row.boards !== null)
		.map((row) => ({
			id: row.boards!.id,
			title: row.boards!.title,
			role: normalizeRole(row.role),
			ownerUserId: row.boards!.owner_user_id,
			createdAt: row.boards!.created_at,
			updatedAt: row.boards!.updated_at,
		})) as BoardSummary[];
}

export async function getBoardDetails(
	accessToken: string,
	boardId: string,
): Promise<BoardDetails> {
	const rows = await restFetch<
		Array<{
			id: string;
			title: string;
			owner_user_id: string;
			created_at: string;
			updated_at: string;
		}>
	>(
		`/rest/v1/boards?id=eq.${encodeURIComponent(
			boardId,
		)}&select=id,title,owner_user_id,created_at,updated_at&limit=1`,
		{
			method: "GET",
			accessToken,
		},
	);
	const board = rows[0];
	if (!board) {
		throw new Error("Board not found.");
	}
	return {
		id: board.id,
		title: board.title,
		ownerUserId: board.owner_user_id,
		createdAt: board.created_at,
		updatedAt: board.updated_at,
	};
}

export async function getBoardAccess(
	accessToken: string,
	boardId: string,
	userId: string,
): Promise<BoardAccess> {
	const rows = await restFetch<Array<{ role: string }>>(
		`/rest/v1/board_members?board_id=eq.${encodeURIComponent(
			boardId,
		)}&user_id=eq.${encodeURIComponent(userId)}&select=role&limit=1`,
		{
			method: "GET",
			accessToken,
		},
	);
	const role = normalizeRole(rows[0]?.role || "viewer");
	return {
		role,
		canEdit: role === "owner" || role === "editor",
		isOwner: role === "owner",
	};
}

export async function listBoardMembers(
	accessToken: string,
	boardId: string,
): Promise<BoardMemberSummary[]> {
	const rows = await restFetch<
		Array<{ user_id: string; role: string; created_at: string }>
	>(
		`/rest/v1/board_members?board_id=eq.${encodeURIComponent(
			boardId,
		)}&select=user_id,role,created_at&order=created_at.asc`,
		{
			method: "GET",
			accessToken,
		},
	);
	return rows.map((row) => ({
		userId: row.user_id,
		role: normalizeRole(row.role),
		createdAt: row.created_at,
	}));
}

export async function createBoard(
	accessToken: string,
	ownerUserId: string,
	title: string,
) {
	const rows = await restFetch<Array<{ id: string }>>(
		"/rest/v1/boards?select=id",
		{
			method: "POST",
			accessToken,
			body: [
				{
					title: title.trim() || "Untitled Board",
					owner_user_id: ownerUserId,
				},
			],
			prefer: "return=representation",
		},
	);

	const boardId = rows[0]?.id;
	if (!boardId) {
		throw new Error("Board creation failed.");
	}
	return boardId;
}

export async function renameBoard(
	accessToken: string,
	boardId: string,
	title: string,
) {
	const rows = await restFetch<Array<{ id: string; title: string }>>(
		`/rest/v1/boards?id=eq.${encodeURIComponent(boardId)}&select=id,title`,
		{
			method: "PATCH",
			accessToken,
			body: {
				title: title.trim() || "Untitled Board",
			},
			prefer: "return=representation",
		},
	);
	if (!rows[0]) {
		throw new Error("Board rename failed.");
	}
}

export async function deleteBoard(accessToken: string, boardId: string) {
	await restFetch<Array<{ id: string }>>(
		`/rest/v1/boards?id=eq.${encodeURIComponent(boardId)}&select=id`,
		{
			method: "DELETE",
			accessToken,
		},
	);
}

export async function getBoardNotes(accessToken: string, boardId: string) {
	const snapshot = await getBoardSnapshot(accessToken, boardId);
	return snapshot.notes;
}

export async function getBoardSnapshot(
	accessToken: string,
	boardId: string,
): Promise<BoardSnapshot> {
	const rows = await restFetch<Array<{ notes: unknown }>>(
		`/rest/v1/board_state?board_id=eq.${encodeURIComponent(
			boardId,
		)}&select=notes,revision,updated_by,updated_at&limit=1`,
		{
			method: "GET",
			accessToken,
		},
	);
	const row = rows[0] as
		| {
				notes: unknown;
				revision?: number;
				updated_by?: string | null;
				updated_at?: string | null;
		  }
		| undefined;
	const sanitized = sanitizeNotes(row?.notes);
	return {
		notes: sanitized.length > 0 ? sanitized : seedNotes,
		revision: typeof row?.revision === "number" ? Math.max(0, row.revision) : 0,
		updatedBy: typeof row?.updated_by === "string" ? row.updated_by : null,
		updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
	};
}

export async function saveBoardNotes(
	accessToken: string,
	boardId: string,
	userId: string,
	notes: Note[],
	expectedRevision: number,
) {
	const cleaned = sanitizeNotes(notes);
	const safeRevision = Math.max(0, Math.floor(expectedRevision));
	const nextRevision = safeRevision + 1;
	const updated = await restFetch<Array<{ revision: number }>>(
		`/rest/v1/board_state?board_id=eq.${encodeURIComponent(
			boardId,
		)}&revision=eq.${encodeURIComponent(String(safeRevision))}&select=revision`,
		{
			method: "PATCH",
			accessToken,
			body: {
				notes: cleaned,
				revision: nextRevision,
				updated_by: userId,
			},
			prefer: "return=representation",
		},
	);

	if (!updated[0]) {
		console.info("[board.save.conflict]", {
			boardId,
			userId,
			expectedRevision: safeRevision,
		});
		throw new Error("REVISION_CONFLICT");
	}

	console.info("[board.save.success]", {
		boardId,
		userId,
		revision: nextRevision,
	});
	return {
		revision: nextRevision,
		updatedBy: userId,
	};
}

export async function forceReplaceBoardNotes(
	accessToken: string,
	boardId: string,
	userId: string,
	notes: Note[],
) {
	const cleaned = sanitizeNotes(notes);
	const current = await getBoardSnapshot(accessToken, boardId);
	const nextRevision = current.revision + 1;
	await restFetch<Array<{ board_id: string }>>(
		`/rest/v1/board_state?board_id=eq.${encodeURIComponent(boardId)}&select=board_id`,
		{
			method: "PATCH",
			accessToken,
			body: {
				notes: cleaned,
				revision: nextRevision,
				updated_by: userId,
			},
			prefer: "return=representation",
		},
	);
}

export async function createInvite(
	accessToken: string,
	boardId: string,
	role: "editor" | "viewer",
	expiresAt: string,
	createdBy: string,
	isReusable: boolean,
) {
	enforceCreateInviteRateLimit(createdBy, boardId);
	const token = crypto.randomUUID();
	const rows = await restFetch<Array<{ token: string }>>(
		"/rest/v1/board_invites?select=token",
		{
			method: "POST",
			accessToken,
			body: [
				{
					token,
					board_id: boardId,
					role,
					expires_at: expiresAt,
					created_by: createdBy,
					is_reusable: isReusable,
				},
			],
			prefer: "return=representation",
		},
	);
	const inviteToken = rows[0]?.token;
	if (!inviteToken) {
		console.warn("[board.invite.create.failed]", { boardId, createdBy, role });
		throw new Error("Invite creation failed.");
	}
	console.info("[board.invite.create.success]", { boardId, createdBy, role });
	return inviteToken;
}

export async function listInvites(
	accessToken: string,
	boardId: string,
): Promise<BoardInviteSummary[]> {
	const rows = await restFetch<
		Array<{
			id: string;
			token: string;
			role: string;
			is_reusable: boolean | null;
			accepted_count: number | null;
			last_accepted_by: string | null;
			last_accepted_at: string | null;
			expires_at: string;
			revoked_at: string | null;
			created_at: string;
		}>
	>(
		`/rest/v1/board_invites?board_id=eq.${encodeURIComponent(
			boardId,
		)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(
			new Date().toISOString(),
		)}&select=id,token,role,is_reusable,accepted_count,last_accepted_by,last_accepted_at,expires_at,revoked_at,created_at&order=created_at.desc`,
		{
			method: "GET",
			accessToken,
		},
	);
	return rows.map((row) => ({
		id: row.id,
		token: row.token,
		role: row.role === "viewer" ? "viewer" : "editor",
		isReusable: Boolean(row.is_reusable),
		acceptedCount:
			typeof row.accepted_count === "number"
				? Math.max(0, row.accepted_count)
				: 0,
		lastAcceptedBy:
			typeof row.last_accepted_by === "string" ? row.last_accepted_by : null,
		lastAcceptedAt:
			typeof row.last_accepted_at === "string" ? row.last_accepted_at : null,
		expiresAt: row.expires_at,
		revokedAt: typeof row.revoked_at === "string" ? row.revoked_at : null,
		createdAt: row.created_at,
	}));
}

export async function revokeInvite(
	accessToken: string,
	boardId: string,
	inviteId: string,
) {
	await restFetch<Array<{ id: string }>>(
		`/rest/v1/board_invites?id=eq.${encodeURIComponent(inviteId)}&board_id=eq.${encodeURIComponent(
			boardId,
		)}&select=id`,
		{
			method: "PATCH",
			accessToken,
			body: {
				revoked_at: new Date().toISOString(),
			},
			prefer: "return=representation",
		},
	);
}

export async function cleanupInvites(
	accessToken: string,
	boardId: string,
): Promise<number> {
	const nowIso = new Date().toISOString();
	const expired = await restFetch<Array<{ id: string }>>(
		`/rest/v1/board_invites?board_id=eq.${encodeURIComponent(
			boardId,
		)}&expires_at=lte.${encodeURIComponent(nowIso)}&select=id`,
		{
			method: "DELETE",
			accessToken,
			prefer: "return=representation",
		},
	);
	const revoked = await restFetch<Array<{ id: string }>>(
		`/rest/v1/board_invites?board_id=eq.${encodeURIComponent(
			boardId,
		)}&revoked_at=not.is.null&select=id`,
		{
			method: "DELETE",
			accessToken,
			prefer: "return=representation",
		},
	);
	return expired.length + revoked.length;
}

export async function updateBoardMemberRole(
	accessToken: string,
	boardId: string,
	memberUserId: string,
	role: "editor" | "viewer",
) {
	const rows = await restFetch<Array<{ user_id: string }>>(
		`/rest/v1/board_members?board_id=eq.${encodeURIComponent(
			boardId,
		)}&user_id=eq.${encodeURIComponent(memberUserId)}&select=user_id`,
		{
			method: "PATCH",
			accessToken,
			body: {
				role,
			},
			prefer: "return=representation",
		},
	);
	if (!rows[0]) {
		throw new Error("Member role update failed.");
	}
}

export async function removeBoardMember(
	accessToken: string,
	boardId: string,
	memberUserId: string,
) {
	await restFetch<Array<{ user_id: string }>>(
		`/rest/v1/board_members?board_id=eq.${encodeURIComponent(
			boardId,
		)}&user_id=eq.${encodeURIComponent(memberUserId)}&select=user_id`,
		{
			method: "DELETE",
			accessToken,
		},
	);
}

export async function leaveBoard(
	accessToken: string,
	boardId: string,
	userId: string,
) {
	await removeBoardMember(accessToken, boardId, userId);
}

export async function transferBoardOwnership(
	accessToken: string,
	boardId: string,
	newOwnerUserId: string,
): Promise<BoardOwnershipTransferResult> {
	try {
		const rows = await restFetch<
			Array<{ board_id: string; new_owner_user_id: string }>
		>("/rest/v1/rpc/transfer_board_ownership", {
			method: "POST",
			accessToken,
			body: {
				target_board_id: boardId,
				new_owner_user_id: newOwnerUserId,
			},
		});
		const result = rows[0];
		if (!result?.board_id || !result.new_owner_user_id) {
			throw new Error("OWNERSHIP_TRANSFER_FAILED");
		}
		return {
			boardId: result.board_id,
			newOwnerUserId: result.new_owner_user_id,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "";
		if (
			message.includes(
				"Could not find the function public.transfer_board_ownership",
			)
		) {
			throw new Error(
				"Ownership transfer backend not installed. Run supabase/phase4_ownership_transfer.sql in Supabase SQL Editor.",
			);
		}
		if (message.includes("NEW_OWNER_MUST_BE_MEMBER")) {
			throw new Error("New owner must already be a board member.");
		}
		if (message.includes("ONLY_OWNER_CAN_TRANSFER")) {
			throw new Error("Only the current owner can transfer ownership.");
		}
		if (message.includes("NEW_OWNER_SAME")) {
			throw new Error("Selected user is already the owner.");
		}
		throw error instanceof Error
			? error
			: new Error("OWNERSHIP_TRANSFER_FAILED");
	}
}

export async function acceptInvite(
	accessToken: string,
	userId: string,
	token: string,
): Promise<InviteAcceptResult> {
	try {
		enforceAcceptInviteRateLimit(userId);
		const rows = await restFetch<Array<{ board_id: string; status: string }>>(
			"/rest/v1/rpc/accept_board_invite",
			{
				method: "POST",
				accessToken,
				body: {
					invite_token: token,
				},
			},
		);
		const result = rows[0];
		if (!result?.board_id) {
			throw new Error("INVITE_INVALID");
		}
		const status =
			result.status === "already_member" ? "already_member" : "joined";
		if (status === "already_member") {
			console.info("[board.invite.accept.already_member]", {
				userId,
				boardId: result.board_id,
			});
		} else {
			console.info("[board.invite.accept.joined]", {
				userId,
				boardId: result.board_id,
			});
		}
		return {
			boardId: result.board_id,
			status,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "";
		if (message.includes("INVITE_EXPIRED")) {
			console.warn("[board.invite.accept.expired]", { userId });
			throw new Error("INVITE_EXPIRED");
		}
		if (message.includes("INVITE_INVALID")) {
			console.warn("[board.invite.accept.invalid]", { userId, token });
			throw new Error("INVITE_INVALID");
		}
		if (message.includes("INVITE_USED")) {
			console.warn("[board.invite.accept.used]", { userId, token });
			throw new Error("INVITE_USED");
		}
		if (message.includes("INVITE_REVOKED")) {
			console.warn("[board.invite.accept.revoked]", { userId, token });
			throw new Error("INVITE_REVOKED");
		}
		if (message.includes("RATE_LIMITED")) {
			throw new Error("RATE_LIMITED");
		}
		if (
			message.includes("Could not find the function public.accept_board_invite")
		) {
			throw new Error(
				"Invite acceptance backend not installed. Run supabase/phase4_invite_lifecycle.sql in Supabase SQL Editor.",
			);
		}
		throw error instanceof Error ? error : new Error("INVITE_ACCEPT_FAILED");
	}
}

function normalizeRole(value: string): "owner" | "editor" | "viewer" {
	if (value === "owner" || value === "editor" || value === "viewer") {
		return value;
	}
	return "viewer";
}

async function restFetch<T>(
	path: string,
	options: {
		method: "GET" | "POST" | "PATCH" | "DELETE";
		accessToken: string;
		body?: unknown;
		prefer?: string;
	},
) {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
		throw new Error("Supabase is not configured.");
	}
	const response = await fetch(`${SUPABASE_URL}${path}`, {
		method: options.method,
		headers: {
			apikey: SUPABASE_ANON_KEY,
			Authorization: `Bearer ${options.accessToken}`,
			"Content-Type": "application/json",
			...(options.prefer ? { Prefer: options.prefer } : {}),
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
	if (!response.ok) {
		const errorBody = await response.text().catch(() => "");
		throw new Error(
			`Supabase request failed (${response.status}): ${errorBody || response.statusText}`,
		);
	}
	return (await response.json().catch(() => [])) as T;
}
