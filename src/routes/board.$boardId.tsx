import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BoardCanvas from "@/components/BoardCanvas";
import BoardHeaderActions from "@/components/BoardHeaderActions";
import BoardSettingsDrawer from "@/components/BoardSettingsDrawer";
import { BoardPageSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
	type AuthSession,
	clearStoredSession,
	getStoredSession,
	isSessionValid,
} from "@/lib/auth-session";
import { isSelfUpdate, shouldApplyIncomingState } from "@/lib/collab";
import { type Note, sanitizeNotes, seedNotes } from "@/lib/notes";

type BoardAccess = {
	role: "owner" | "editor" | "viewer";
	canEdit: boolean;
	isOwner: boolean;
};

type BoardInviteSummary = {
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

type BoardDetails = {
	id: string;
	title: string;
	ownerUserId: string;
	createdAt: string;
	updatedAt: string;
};

type BoardMemberSummary = {
	userId: string;
	role: "owner" | "editor" | "viewer";
	createdAt: string;
};

const PRESENCE_HEARTBEAT_MS = 20_000;
const PRESENCE_STALE_MS = 60_000;

const loadBoardNotesServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { userId: string; accessToken: string; boardId: string }) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return {
				ok: false as const,
				notes: seedNotes,
				revision: 0,
				updatedBy: null as string | null,
				updatedAt: null as string | null,
			};
		}
		try {
			const store = await import("@/server/board-store");
			const snapshot = await store.getBoardSnapshot(
				data.accessToken,
				data.boardId,
			);
			return { ok: true as const, ...snapshot };
		} catch {
			return {
				ok: false as const,
				notes: seedNotes,
				revision: 0,
				updatedBy: null as string | null,
				updatedAt: null as string | null,
			};
		}
	});

const saveBoardNotesServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			userId: string;
			accessToken: string;
			boardId: string;
			expectedRevision: number;
			notes: Note[];
		}) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
			expectedRevision:
				typeof input.expectedRevision === "number"
					? Math.max(0, Math.floor(input.expectedRevision))
					: 0,
			notes: sanitizeNotes(input.notes),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return {
				ok: false as const,
				updatedAt: Date.now(),
				message: "Invalid session.",
				code: "auth" as const,
				revision: data.expectedRevision,
			};
		}
		try {
			const store = await import("@/server/board-store");
			const saved = await store.saveBoardNotes(
				data.accessToken,
				data.boardId,
				verifiedUser.id,
				data.notes,
				data.expectedRevision,
			);
			return {
				ok: true as const,
				updatedAt: Date.now(),
				message: "",
				code: "ok" as const,
				revision: saved.revision,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			if (message.includes("REVISION_CONFLICT")) {
				return {
					ok: false as const,
					updatedAt: Date.now(),
					message:
						"This board changed in another session. Reloaded latest version.",
					code: "conflict" as const,
					revision: data.expectedRevision,
				};
			}
			return {
				ok: false as const,
				updatedAt: Date.now(),
				message: "You do not have access to update this board.",
				code: "access" as const,
				revision: data.expectedRevision,
			};
		}
	});

const createInviteServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			userId: string;
			accessToken: string;
			boardId: string;
			role: "editor" | "viewer";
			mode: "one_time" | "reusable";
		}) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
			role: input.role === "viewer" ? "viewer" : "editor",
			mode: input.mode === "reusable" ? "reusable" : "one_time",
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return {
				ok: false as const,
				inviteToken: "",
				message: "Invalid session.",
			};
		}
		try {
			const store = await import("@/server/board-store");
			const expiresAt = new Date(
				Date.now() + 7 * 24 * 60 * 60 * 1000,
			).toISOString();
			const inviteToken = await store.createInvite(
				data.accessToken,
				data.boardId,
				data.role,
				expiresAt,
				verifiedUser.id,
				data.mode === "reusable",
			);
			return { ok: true as const, inviteToken, message: "" };
		} catch (error) {
			const rawMessage = error instanceof Error ? error.message : "";
			if (rawMessage.includes("RATE_LIMITED")) {
				const waitSeconds = Number(rawMessage.split(":")[1] || "60");
				return {
					ok: false as const,
					inviteToken: "",
					message: `Invite rate limit reached. Try again in ${Math.max(1, Math.floor(waitSeconds))}s.`,
				};
			}
			return {
				ok: false as const,
				inviteToken: "",
				message: rawMessage || "Failed to create invite.",
			};
		}
	});

const loadBoardAccessServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { userId: string; accessToken: string; boardId: string }) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return {
				ok: false as const,
				access: {
					role: "viewer",
					canEdit: false,
					isOwner: false,
				} as BoardAccess,
			};
		}
		try {
			const store = await import("@/server/board-store");
			const access = await store.getBoardAccess(
				data.accessToken,
				data.boardId,
				verifiedUser.id,
			);
			return { ok: true as const, access };
		} catch {
			return {
				ok: false as const,
				access: {
					role: "viewer",
					canEdit: false,
					isOwner: false,
				} as BoardAccess,
			};
		}
	});

const listInvitesServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { userId: string; accessToken: string; boardId: string }) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const, invites: [] as BoardInviteSummary[] };
		}
		try {
			const store = await import("@/server/board-store");
			const invites = await store.listInvites(data.accessToken, data.boardId);
			return { ok: true as const, invites };
		} catch {
			return { ok: false as const, invites: [] as BoardInviteSummary[] };
		}
	});

const revokeInviteServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			userId: string;
			accessToken: string;
			boardId: string;
			inviteId: string;
		}) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
			inviteId: String(input.inviteId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const };
		}
		try {
			const store = await import("@/server/board-store");
			await store.revokeInvite(data.accessToken, data.boardId, data.inviteId);
			return { ok: true as const };
		} catch {
			return { ok: false as const };
		}
	});

const cleanupInvitesServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { userId: string; accessToken: string; boardId: string }) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const, removed: 0 };
		}
		try {
			const store = await import("@/server/board-store");
			const removed = await store.cleanupInvites(
				data.accessToken,
				data.boardId,
			);
			return { ok: true as const, removed };
		} catch {
			return { ok: false as const, removed: 0 };
		}
	});

const loadBoardDetailsServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { userId: string; accessToken: string; boardId: string }) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const, details: null as BoardDetails | null };
		}
		try {
			const store = await import("@/server/board-store");
			const details = await store.getBoardDetails(
				data.accessToken,
				data.boardId,
			);
			return { ok: true as const, details };
		} catch {
			return { ok: false as const, details: null as BoardDetails | null };
		}
	});

const listBoardMembersServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { userId: string; accessToken: string; boardId: string }) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const, members: [] as BoardMemberSummary[] };
		}
		try {
			const store = await import("@/server/board-store");
			const members = await store.listBoardMembers(
				data.accessToken,
				data.boardId,
			);
			return { ok: true as const, members };
		} catch {
			return { ok: false as const, members: [] as BoardMemberSummary[] };
		}
	});

const renameBoardServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			userId: string;
			accessToken: string;
			boardId: string;
			title: string;
		}) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
			title: String(input.title || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const, message: "Invalid session." };
		}
		try {
			const store = await import("@/server/board-store");
			await store.renameBoard(data.accessToken, data.boardId, data.title);
			return { ok: true as const, message: "" };
		} catch (error) {
			return {
				ok: false as const,
				message:
					error instanceof Error ? error.message : "Board rename failed.",
			};
		}
	});

const updateMemberRoleServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			userId: string;
			accessToken: string;
			boardId: string;
			memberUserId: string;
			role: "editor" | "viewer";
		}) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
			memberUserId: String(input.memberUserId || "").trim(),
			role: input.role === "viewer" ? "viewer" : "editor",
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const };
		}
		try {
			const store = await import("@/server/board-store");
			await store.updateBoardMemberRole(
				data.accessToken,
				data.boardId,
				data.memberUserId,
				data.role,
			);
			return { ok: true as const };
		} catch {
			return { ok: false as const };
		}
	});

const removeBoardMemberServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			userId: string;
			accessToken: string;
			boardId: string;
			memberUserId: string;
		}) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
			memberUserId: String(input.memberUserId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const };
		}
		try {
			const store = await import("@/server/board-store");
			await store.removeBoardMember(
				data.accessToken,
				data.boardId,
				data.memberUserId,
			);
			return { ok: true as const };
		} catch {
			return { ok: false as const };
		}
	});

const leaveBoardServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { userId: string; accessToken: string; boardId: string }) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const };
		}
		try {
			const store = await import("@/server/board-store");
			await store.leaveBoard(data.accessToken, data.boardId, verifiedUser.id);
			return { ok: true as const };
		} catch {
			return { ok: false as const };
		}
	});

const deleteBoardServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { userId: string; accessToken: string; boardId: string }) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const };
		}
		try {
			const store = await import("@/server/board-store");
			await store.deleteBoard(data.accessToken, data.boardId);
			return { ok: true as const };
		} catch {
			return { ok: false as const };
		}
	});

const transferOwnershipServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			userId: string;
			accessToken: string;
			boardId: string;
			newOwnerUserId: string;
		}) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			boardId: String(input.boardId || "").trim(),
			newOwnerUserId: String(input.newOwnerUserId || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const, message: "Invalid session." };
		}
		try {
			const store = await import("@/server/board-store");
			await store.transferBoardOwnership(
				data.accessToken,
				data.boardId,
				data.newOwnerUserId,
			);
			return { ok: true as const, message: "" };
		} catch (error) {
			return {
				ok: false as const,
				message:
					error instanceof Error ? error.message : "Ownership transfer failed.",
			};
		}
	});

export const Route = createFileRoute("/board/$boardId")({
	loader: () => seedNotes,
	component: BoardRoute,
});

function BoardRoute() {
	const navigate = useNavigate();
	const { boardId } = Route.useParams();
	const initialNotes = Route.useLoaderData();
	const { addToast } = useToast();
	const [session, setSession] = useState<AuthSession | null>(null);
	const [notes, setNotes] = useState<Note[]>(initialNotes);
	const [boardAccess, setBoardAccess] = useState<BoardAccess>({
		role: "viewer",
		canEdit: false,
		isOwner: false,
	});
	const [boardDetails, setBoardDetails] = useState<BoardDetails | null>(null);
	const [boardTitleDraft, setBoardTitleDraft] = useState("");
	const [boardMembers, setBoardMembers] = useState<BoardMemberSummary[]>([]);
	const [activeInvites, setActiveInvites] = useState<BoardInviteSummary[]>([]);
	const [isCheckingAuth, setIsCheckingAuth] = useState(true);
	const [syncState, setSyncState] = useState<
		"idle" | "saving" | "saved" | "error"
	>("idle");
	const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
	const [inviteMode, setInviteMode] = useState<"one_time" | "reusable">(
		"one_time",
	);
	const [inviteLink, setInviteLink] = useState("");
	const [inviteMessage, setInviteMessage] = useState("");
	const [presenceUsers, setPresenceUsers] = useState<
		Array<{ id: string; label: string }>
	>([]);
	const [syncFailureCount, setSyncFailureCount] = useState(0);
	const [conflictCount, setConflictCount] = useState(0);
	const [pendingConflictNotes, setPendingConflictNotes] = useState<
		Note[] | null
	>(null);
	const [isCreatingInvite, setIsCreatingInvite] = useState(false);
	const [isCleaningInvites, setIsCleaningInvites] = useState(false);
	const [isRenamingBoard, setIsRenamingBoard] = useState(false);
	const [isDeletingBoard, setIsDeletingBoard] = useState(false);
	const [isLeavingBoard, setIsLeavingBoard] = useState(false);
	const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);
	const [memberActionUserId, setMemberActionUserId] = useState("");
	const [boardMessage, setBoardMessage] = useState("");
	const [loadError, setLoadError] = useState("");
	const [isBoardBootstrapping, setIsBoardBootstrapping] = useState(true);
	const [boardRevision, setBoardRevision] = useState(0);
	const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
	const [realtimeStatus, setRealtimeStatus] = useState<
		"unconfigured" | "connecting" | "connected" | "error"
	>("unconfigured");
	const [settingsOpen, setSettingsOpen] = useState(false);
	const hasInitializedRef = useRef(false);
	const suppressNextSaveRef = useRef(false);
	const revisionRef = useRef(0);
	const lastSyncedNotesRef = useRef<Note[]>(initialNotes);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const realtimeClientRef = useRef<SupabaseClient | null>(null);
	const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
	const pendingSaveNotesRef = useRef<Note[] | null>(null);
	const saveInFlightRef = useRef(false);
	const queuedSaveNotesRef = useRef<Note[] | null>(null);
	const presenceLastSeenRef = useRef<
		Map<string, { label: string; lastSeenAt: number }>
	>(new Map());
	const realtimeSubscriptionVersionRef = useRef(0);
	const retryKeepMineRef = useRef<() => void>(() => {});
	const keepLatestBoardRef = useRef<() => void>(() => {});

	const cacheKey = useMemo(
		() => (session ? `canvas-board:${session.user.id}:${boardId}` : ""),
		[boardId, session],
	);

	useEffect(() => {
		const current = getStoredSession();
		if (!isSessionValid(current)) {
			clearStoredSession();
			void navigate({ to: "/login" });
			return;
		}
		setSession(current);
		setIsCheckingAuth(false);
	}, [navigate]);

	const realtimeConfig = useMemo(() => {
		const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
		const url =
			import.meta.env.VITE_SUPABASE_URL ||
			(projectId ? `https://${projectId}.supabase.co` : "");
		const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
		return {
			url,
			anonKey,
			enabled: Boolean(url && anonKey),
		};
	}, []);

	const reloadLatestSnapshot = useCallback(
		async (showCollaboratorNotice: boolean) => {
			if (!session) {
				return;
			}
			const latest = await loadBoardNotesServer({
				data: {
					userId: session.user.id,
					accessToken: session.accessToken,
					boardId,
				},
			});
			if (
				!latest.ok ||
				!shouldApplyIncomingState(revisionRef.current, latest.revision)
			) {
				return;
			}
			revisionRef.current = latest.revision;
			setBoardRevision(latest.revision);
			lastSyncedNotesRef.current = latest.notes;
			if (
				showCollaboratorNotice &&
				!isSelfUpdate(latest.updatedBy, session.user.id)
			) {
				addToast(
					"info",
					"Board updated by a collaborator. Latest changes were loaded.",
				);
			}
			suppressNextSaveRef.current = true;
			setNotes(latest.notes);
			setSyncState("saved");
			setLastSyncAt(new Date());
		},
		[boardId, session, addToast],
	);

	const refreshBoardMeta = useCallback(async () => {
		if (!session) {
			return;
		}
		const accessResult = await loadBoardAccessServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
			},
		});
		if (accessResult.ok) {
			setBoardAccess(accessResult.access);
		}

		const detailsResult = await loadBoardDetailsServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
			},
		});
		if (detailsResult.ok && detailsResult.details) {
			setBoardDetails(detailsResult.details);
			setBoardTitleDraft(detailsResult.details.title);
		}

		const membersResult = await listBoardMembersServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
			},
		});
		if (membersResult.ok) {
			setBoardMembers(membersResult.members);
		}

		if (accessResult.ok && accessResult.access.isOwner) {
			const invitesResult = await listInvitesServer({
				data: {
					userId: session.user.id,
					accessToken: session.accessToken,
					boardId,
				},
			});
			if (invitesResult.ok) {
				setActiveInvites(invitesResult.invites);
			}
		} else {
			setActiveInvites([]);
		}
	}, [boardId, session]);

	const getSaveDebounceMs = useCallback((draftNotes: Note[]) => {
		const noteCount = draftNotes.length;
		const hasImagePayload = draftNotes.some(
			(note) => note.imageDataUrl.length > 0,
		);
		if (hasImagePayload || noteCount >= 30) {
			return 900;
		}
		if (noteCount >= 15) {
			return 700;
		}
		return 450;
	}, []);

	const drainSaveQueue = useCallback(async () => {
		if (!session || saveInFlightRef.current) {
			return;
		}
		const notesToSave = queuedSaveNotesRef.current;
		if (!notesToSave) {
			return;
		}

		queuedSaveNotesRef.current = null;
		saveInFlightRef.current = true;
		pendingSaveNotesRef.current = notesToSave;

		try {
			const result = await saveBoardNotesServer({
				data: {
					userId: session.user.id,
					accessToken: session.accessToken,
					boardId,
					expectedRevision: revisionRef.current,
					notes: notesToSave,
				},
			});

			if (result.ok) {
				setSyncState("saved");
				setBoardRevision(result.revision);
				revisionRef.current = result.revision;
				lastSyncedNotesRef.current = notesToSave;
				setLastSyncAt(new Date());
			} else if (result.code === "conflict") {
				setConflictCount((count) => count + 1);
				setPendingConflictNotes(notesToSave);
				addToast(
					"conflict",
					"Save conflict detected. Choose whether to keep your draft or the latest board.",
					[
						{ label: "Keep mine", onClick: () => retryKeepMineRef.current() },
						{
							label: "Keep latest",
							onClick: () => keepLatestBoardRef.current(),
						},
					],
				);
				await reloadLatestSnapshot(false);
			} else {
				addToast(
					"error",
					result.message || "Save failed. Your local draft was rolled back.",
				);
				setSyncFailureCount((count) => count + 1);
				suppressNextSaveRef.current = true;
				setNotes(lastSyncedNotesRef.current);
				setSyncState("error");
			}
		} finally {
			saveInFlightRef.current = false;
		}

		if (queuedSaveNotesRef.current) {
			setSyncState("saving");
			void drainSaveQueue();
		}
	}, [boardId, reloadLatestSnapshot, session, addToast]);

	useEffect(() => {
		if (!session || typeof window === "undefined") {
			return;
		}
		hasInitializedRef.current = false;
		setLoadError("");
		setIsBoardBootstrapping(true);
		const cached = window.localStorage.getItem(cacheKey);
		if (cached) {
			try {
				const parsed = JSON.parse(cached) as unknown;
				const sanitized = sanitizeNotes(parsed);
				if (sanitized.length > 0) {
					setNotes(sanitized);
				}
			} catch {
				// Ignore local cache parse errors.
			}
		}
		void (async () => {
			const result = await loadBoardNotesServer({
				data: {
					userId: session.user.id,
					accessToken: session.accessToken,
					boardId,
				},
			});
			if (result.ok) {
				suppressNextSaveRef.current = true;
				setNotes(result.notes);
				setBoardRevision(result.revision);
				revisionRef.current = result.revision;
				lastSyncedNotesRef.current = result.notes;
				setLastSyncAt(new Date());
				await refreshBoardMeta();
			} else {
				setLoadError("You do not have access to this board.");
			}
			hasInitializedRef.current = true;
			setIsBoardBootstrapping(false);
		})();
	}, [session, boardId, cacheKey, refreshBoardMeta]);

	useEffect(() => {
		if (!session || typeof window === "undefined") {
			return;
		}
		window.localStorage.setItem(cacheKey, JSON.stringify(notes));
	}, [cacheKey, notes, session]);

	useEffect(() => {
		if (!session || !hasInitializedRef.current) {
			return;
		}
		if (suppressNextSaveRef.current) {
			suppressNextSaveRef.current = false;
			return;
		}
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		if (!boardAccess.canEdit) {
			suppressNextSaveRef.current = true;
			setNotes(lastSyncedNotesRef.current);
			addToast("error", "You have viewer access. Changes are read-only.");
			setSyncState("error");
			setSyncFailureCount((count) => count + 1);
			return;
		}

		queuedSaveNotesRef.current = notes;
		const debounceMs = getSaveDebounceMs(notes);
		setSyncState("saving");
		saveTimerRef.current = setTimeout(() => {
			void drainSaveQueue();
		}, debounceMs);
		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}
		};
	}, [
		boardAccess.canEdit,
		drainSaveQueue,
		getSaveDebounceMs,
		notes,
		session,
		addToast,
	]);

	useEffect(() => {
		if (!session || !hasInitializedRef.current) {
			return;
		}
		const timer = setInterval(
			() => {
				void reloadLatestSnapshot(true);
			},
			realtimeStatus === "connected" ? 15000 : 2500,
		);
		return () => clearInterval(timer);
	}, [session, reloadLatestSnapshot, realtimeStatus]);

	useEffect(() => {
		if (!session) {
			return;
		}
		const onOnline = () => {
			addToast("info", "Network reconnected. Syncing latest board state...");
			void reloadLatestSnapshot(true);
		};
		const onOffline = () => {
			setRealtimeStatus("error");
			addToast(
				"warning",
				"You are offline. Edits will sync when the connection is restored.",
			);
		};
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOffline);
		return () => {
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
		};
	}, [session, reloadLatestSnapshot, addToast]);

	useEffect(() => {
		if (!session || !hasInitializedRef.current) {
			return;
		}
		if (!realtimeConfig.enabled) {
			setRealtimeStatus("unconfigured");
			return;
		}

		let cancelled = false;
		const subscriptionVersion = ++realtimeSubscriptionVersionRef.current;
		let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
		let stalePruneTimer: ReturnType<typeof setInterval> | null = null;
		setRealtimeStatus("connecting");

		const teardownRealtime = () => {
			const client = realtimeClientRef.current;
			const channel = realtimeChannelRef.current;
			realtimeChannelRef.current = null;
			realtimeClientRef.current = null;
			if (client && channel) {
				void client.removeChannel(channel);
			}
			if (client) {
				void client.realtime.disconnect();
			}
		};

		teardownRealtime();
		presenceLastSeenRef.current.clear();
		setPresenceUsers([]);

		void (async () => {
			try {
				const { createClient } = await import("@supabase/supabase-js");
				if (cancelled) {
					return;
				}

				const client = createClient(
					realtimeConfig.url,
					realtimeConfig.anonKey,
					{
						auth: {
							persistSession: false,
							autoRefreshToken: false,
						},
					},
				);
				await client.realtime.setAuth(session.accessToken);

				const channel = client
					.channel(`board-state:${boardId}`)
					.on(
						"postgres_changes",
						{
							event: "*",
							schema: "public",
							table: "board_state",
							filter: `board_id=eq.${boardId}`,
						},
						() => {
							void reloadLatestSnapshot(true);
						},
					)
					.on("presence", { event: "sync" }, () => {
						const state = channel.presenceState<{
							id: string;
							label: string;
							seenAt?: number;
						}>();
						const users = Object.values(state)
							.flat()
							.map((entry) => ({
								id: entry.id,
								label: entry.label,
								seenAt:
									typeof entry.seenAt === "number" &&
									Number.isFinite(entry.seenAt)
										? entry.seenAt
										: Date.now(),
							}))
							.filter((entry) => entry.id);
						const deduped = Array.from(
							new Map(users.map((entry) => [entry.id, entry])).values(),
						);
						for (const user of deduped) {
							const current = presenceLastSeenRef.current.get(user.id);
							if (!current || user.seenAt >= current.lastSeenAt) {
								presenceLastSeenRef.current.set(user.id, {
									label: user.label,
									lastSeenAt: user.seenAt,
								});
							}
						}

						const now = Date.now();
						const nextPresence: Array<{ id: string; label: string }> = [];
						for (const [id, value] of presenceLastSeenRef.current.entries()) {
							if (
								now - value.lastSeenAt <= PRESENCE_STALE_MS ||
								id === session.user.id
							) {
								nextPresence.push({ id, label: value.label });
							} else {
								presenceLastSeenRef.current.delete(id);
							}
						}
						setPresenceUsers(nextPresence);
					})
					.subscribe((status) => {
						if (
							cancelled ||
							subscriptionVersion !== realtimeSubscriptionVersionRef.current
						) {
							return;
						}
						if (status === "SUBSCRIBED") {
							setRealtimeStatus("connected");
							const now = Date.now();
							presenceLastSeenRef.current.set(session.user.id, {
								label: session.user.name || session.user.email,
								lastSeenAt: now,
							});
							void channel.track({
								id: session.user.id,
								label: session.user.name || session.user.email,
								seenAt: now,
							});
							return;
						}
						if (
							status === "CHANNEL_ERROR" ||
							status === "TIMED_OUT" ||
							status === "CLOSED"
						) {
							setRealtimeStatus("error");
							addToast(
								"info",
								"Realtime connection interrupted. Retrying automatically...",
							);
						}
					});

				heartbeatTimer = window.setInterval(() => {
					if (cancelled) {
						return;
					}
					const now = Date.now();
					void channel.track({
						id: session.user.id,
						label: session.user.name || session.user.email,
						seenAt: now,
					});
				}, PRESENCE_HEARTBEAT_MS);

				stalePruneTimer = window.setInterval(() => {
					if (cancelled) {
						return;
					}
					const now = Date.now();
					const nextPresence: Array<{ id: string; label: string }> = [];
					for (const [id, value] of presenceLastSeenRef.current.entries()) {
						if (
							now - value.lastSeenAt <= PRESENCE_STALE_MS ||
							id === session.user.id
						) {
							nextPresence.push({ id, label: value.label });
						} else {
							presenceLastSeenRef.current.delete(id);
						}
					}
					setPresenceUsers(nextPresence);
				}, 10_000);

				realtimeClientRef.current = client;
				realtimeChannelRef.current = channel;
			} catch {
				if (!cancelled) {
					setRealtimeStatus("error");
				}
			}
		})();

		return () => {
			cancelled = true;
			if (heartbeatTimer) {
				clearInterval(heartbeatTimer);
			}
			if (stalePruneTimer) {
				clearInterval(stalePruneTimer);
			}
			presenceLastSeenRef.current.clear();
			setPresenceUsers([]);
			if (subscriptionVersion === realtimeSubscriptionVersionRef.current) {
				teardownRealtime();
			}
		};
	}, [boardId, session, reloadLatestSnapshot, realtimeConfig, addToast]);

	const refreshMembers = useCallback(async () => {
		if (!session) {
			return;
		}
		const membersResult = await listBoardMembersServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
			},
		});
		if (membersResult.ok) {
			setBoardMembers(membersResult.members);
		}
	}, [boardId, session]);

	const renameBoard = async () => {
		if (!session || !boardAccess.isOwner) {
			return;
		}
		const nextTitle = boardTitleDraft.trim();
		if (!nextTitle) {
			setBoardMessage("Board title cannot be empty.");
			return;
		}
		setIsRenamingBoard(true);
		setBoardMessage("");
		const result = await renameBoardServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
				title: nextTitle,
			},
		});
		setIsRenamingBoard(false);
		if (!result.ok) {
			setBoardMessage(result.message || "Could not rename board.");
			return;
		}
		setBoardDetails((current) =>
			current
				? {
						...current,
						title: nextTitle,
					}
				: current,
		);
		setBoardMessage("Board title updated.");
	};

	const updateMemberRole = async (
		memberUserId: string,
		nextRole: "editor" | "viewer",
	) => {
		if (!session || !boardAccess.isOwner) {
			return;
		}
		setMemberActionUserId(memberUserId);
		setBoardMessage("");
		const result = await updateMemberRoleServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
				memberUserId,
				role: nextRole,
			},
		});
		setMemberActionUserId("");
		if (!result.ok) {
			setBoardMessage("Could not update member role.");
			return;
		}
		setBoardMembers((current) =>
			current.map((member) =>
				member.userId === memberUserId
					? {
							...member,
							role: nextRole,
						}
					: member,
			),
		);
		setBoardMessage("Member role updated.");
	};

	const removeMember = async (memberUserId: string) => {
		if (!session || !boardAccess.isOwner) {
			return;
		}
		setMemberActionUserId(memberUserId);
		setBoardMessage("");
		const result = await removeBoardMemberServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
				memberUserId,
			},
		});
		setMemberActionUserId("");
		if (!result.ok) {
			setBoardMessage("Could not remove member.");
			return;
		}
		setBoardMembers((current) =>
			current.filter((member) => member.userId !== memberUserId),
		);
		setBoardMessage("Member removed.");
	};

	const transferOwnership = async (memberUserId: string) => {
		if (!session || !boardAccess.isOwner) {
			return;
		}
		setIsTransferringOwnership(true);
		setMemberActionUserId(memberUserId);
		setBoardMessage("");
		const result = await transferOwnershipServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
				newOwnerUserId: memberUserId,
			},
		});
		setIsTransferringOwnership(false);
		setMemberActionUserId("");
		if (!result.ok) {
			setBoardMessage(result.message || "Ownership transfer failed.");
			return;
		}
		await refreshBoardMeta();
		setBoardMessage("Ownership transferred successfully.");
	};

	const leaveBoard = async () => {
		if (!session || boardAccess.isOwner) {
			return;
		}
		setIsLeavingBoard(true);
		setBoardMessage("");
		const result = await leaveBoardServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
			},
		});
		setIsLeavingBoard(false);
		if (!result.ok) {
			setBoardMessage("Could not leave board.");
			return;
		}
		await navigate({ to: "/boards" });
	};

	const deleteBoard = async () => {
		if (!session || !boardAccess.isOwner) {
			return;
		}
		setIsDeletingBoard(true);
		setBoardMessage("");
		const result = await deleteBoardServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
			},
		});
		setIsDeletingBoard(false);
		if (!result.ok) {
			setBoardMessage("Could not delete board.");
			return;
		}
		await navigate({ to: "/boards" });
	};

	const createInvite = async () => {
		if (!session) {
			return;
		}
		setIsCreatingInvite(true);
		setInviteMessage("Creating invite...");
		setInviteLink("");
		try {
			const result = await createInviteServer({
				data: {
					userId: session.user.id,
					accessToken: session.accessToken,
					boardId,
					role: inviteRole,
					mode: inviteMode,
				},
			});
			if (!result.ok) {
				const rawMessage = result.message || "Failed to create invite.";
				if (
					rawMessage.toLowerCase().includes("row-level security") ||
					rawMessage.toLowerCase().includes("permission")
				) {
					setInviteMessage("Invite creation is owner-only for this board.");
				} else {
					setInviteMessage(rawMessage);
				}
				return;
			}
			const baseUrl =
				typeof window !== "undefined" ? window.location.origin : "";
			const url = `${baseUrl}/invite/${result.inviteToken}`;
			setInviteLink(url);
			setInviteMessage(
				inviteMode === "reusable"
					? "Reusable invite created. Link copied to clipboard."
					: "One-time invite created. Link copied to clipboard.",
			);
			if (boardAccess.isOwner) {
				const invitesResult = await listInvitesServer({
					data: {
						userId: session.user.id,
						accessToken: session.accessToken,
						boardId,
					},
				});
				if (invitesResult.ok) {
					setActiveInvites(invitesResult.invites);
				}
			}
			await refreshMembers();
			if (typeof navigator !== "undefined" && navigator.clipboard) {
				await navigator.clipboard.writeText(url).catch(() => {
					setInviteMessage("Invite created. Copy the link manually below.");
				});
			}
		} catch (error) {
			const rawMessage =
				error instanceof Error ? error.message : "Failed to create invite.";
			if (
				rawMessage.toLowerCase().includes("row-level security") ||
				rawMessage.toLowerCase().includes("permission")
			) {
				setInviteMessage("Invite creation is owner-only for this board.");
			} else {
				setInviteMessage(rawMessage);
			}
		} finally {
			setIsCreatingInvite(false);
		}
	};

	const retryKeepMine = async () => {
		if (!session || !pendingConflictNotes || !boardAccess.canEdit) {
			return;
		}
		addToast("info", "Re-applying your draft...");
		setSyncState("saving");
		const result = await saveBoardNotesServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
				expectedRevision: revisionRef.current,
				notes: pendingConflictNotes,
			},
		});
		if (result.ok) {
			suppressNextSaveRef.current = true;
			setNotes(pendingConflictNotes);
			lastSyncedNotesRef.current = pendingConflictNotes;
			setBoardRevision(result.revision);
			revisionRef.current = result.revision;
			setPendingConflictNotes(null);
			addToast("success", "Your draft was restored and saved.");
			setSyncState("saved");
			return;
		}
		setSyncFailureCount((count) => count + 1);
		addToast(
			"error",
			"Could not re-apply your draft. Latest board remains loaded.",
		);
		setSyncState("error");
	};

	const keepLatestBoard = () => {
		setPendingConflictNotes(null);
		addToast("info", "Keeping the latest board version.");
	};

	// Keep refs in sync for toast action callbacks
	retryKeepMineRef.current = () => void retryKeepMine();
	keepLatestBoardRef.current = keepLatestBoard;

	const revokeInvite = async (inviteId: string) => {
		if (!session || !boardAccess.isOwner) {
			return;
		}
		const result = await revokeInviteServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
				inviteId,
			},
		});
		if (!result.ok) {
			setInviteMessage("Could not revoke invite.");
			return;
		}
		setActiveInvites((current) =>
			current.filter((invite) => invite.id !== inviteId),
		);
		setInviteMessage("Invite revoked.");
	};

	const cleanupInvites = async () => {
		if (!session || !boardAccess.isOwner) {
			return;
		}
		setIsCleaningInvites(true);
		const result = await cleanupInvitesServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
			},
		});
		setIsCleaningInvites(false);
		if (!result.ok) {
			setInviteMessage("Could not clean invites.");
			return;
		}
		const invitesResult = await listInvitesServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
			},
		});
		if (invitesResult.ok) {
			setActiveInvites(invitesResult.invites);
		}
		setInviteMessage(`Invite cleanup complete (${result.removed} removed).`);
	};

	const retryBoardBootstrap = async () => {
		if (!session) {
			return;
		}
		setLoadError("");
		setIsBoardBootstrapping(true);
		const result = await loadBoardNotesServer({
			data: {
				userId: session.user.id,
				accessToken: session.accessToken,
				boardId,
			},
		});
		if (result.ok) {
			suppressNextSaveRef.current = true;
			setNotes(result.notes);
			setBoardRevision(result.revision);
			revisionRef.current = result.revision;
			lastSyncedNotesRef.current = result.notes;
			setLastSyncAt(new Date());
			await refreshBoardMeta();
			hasInitializedRef.current = true;
			setIsBoardBootstrapping(false);
			return;
		}
		setLoadError("You do not have access to this board.");
		setIsBoardBootstrapping(false);
	};

	if (isCheckingAuth || isBoardBootstrapping) {
		return <BoardPageSkeleton />;
	}

	if (loadError) {
		return (
			<main className="h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center">
				<div className="w-full max-w-md rounded-xl border border-rose-700/70 bg-rose-950/20 p-6">
					<p className="text-sm text-rose-300">{loadError}</p>
					<div className="mt-4 flex items-center gap-3">
						<button
							type="button"
							onClick={() => void navigate({ to: "/boards" })}
							className="inline-flex items-center rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
						>
							Back to boards
						</button>
						<button
							type="button"
							onClick={() => void retryBoardBootstrap()}
							className="inline-flex items-center rounded-lg border border-rose-600/70 px-3 py-2 text-sm text-rose-200 hover:bg-rose-950/40"
						>
							Retry
						</button>
					</div>
				</div>
			</main>
		);
	}

	return (
		<div>
			<BoardCanvas
				notes={notes}
				onNotesChange={setNotes}
				syncState={syncState}
				title={boardDetails?.title || `Board ${boardId.slice(0, 8)}`}
				rightActions={
					<BoardHeaderActions
						realtimeStatus={realtimeStatus}
						presenceCount={presenceUsers.length}
						onSettingsOpen={() => setSettingsOpen(true)}
						onLogout={() => {
							setSession(null);
							clearStoredSession();
							void navigate({ to: "/login" });
						}}
					/>
				}
			/>
			<BoardSettingsDrawer
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				boardId={boardId}
				boardTitle={boardDetails?.title || boardTitleDraft || boardId}
				boardTitleDraft={boardTitleDraft}
				onBoardTitleDraftChange={setBoardTitleDraft}
				isOwner={boardAccess.isOwner}
				canEdit={boardAccess.canEdit}
				role={boardAccess.role}
				members={boardMembers}
				currentUserId={session?.user.id || ""}
				onRenameBoard={() => void renameBoard()}
				isRenamingBoard={isRenamingBoard}
				onDeleteBoard={() => void deleteBoard()}
				isDeletingBoard={isDeletingBoard}
				onLeaveBoard={() => void leaveBoard()}
				isLeavingBoard={isLeavingBoard}
				onUpdateMemberRole={(userId, role) =>
					void updateMemberRole(userId, role)
				}
				onRemoveMember={(userId) => void removeMember(userId)}
				onTransferOwnership={(userId) => void transferOwnership(userId)}
				memberActionUserId={memberActionUserId}
				isTransferringOwnership={isTransferringOwnership}
				activeInvites={activeInvites}
				inviteRole={inviteRole}
				onInviteRoleChange={setInviteRole}
				inviteMode={inviteMode}
				onInviteModeChange={setInviteMode}
				onCreateInvite={() => void createInvite()}
				isCreatingInvite={isCreatingInvite}
				onRevokeInvite={(id) => void revokeInvite(id)}
				onCleanupInvites={() => void cleanupInvites()}
				isCleaningInvites={isCleaningInvites}
				inviteLink={inviteLink}
				inviteMessage={inviteMessage}
				boardMessage={boardMessage}
				presenceUsers={presenceUsers}
				boardRevision={boardRevision}
				lastSyncAt={lastSyncAt}
				conflictCount={conflictCount}
				syncFailureCount={syncFailureCount}
				realtimeStatus={realtimeStatus}
			/>
		</div>
	);
}
