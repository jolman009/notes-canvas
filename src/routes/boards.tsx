import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { BoardCardSkeleton } from "@/components/Skeleton";
import {
	type AuthSession,
	clearStoredSession,
	getStoredSession,
	isSessionValid,
} from "@/lib/auth-session";
import { roleBadgeClassName } from "@/lib/notes";

type BoardSummary = {
	id: string;
	title: string;
	role: "owner" | "editor" | "viewer";
	ownerUserId: string;
	createdAt: string;
	updatedAt: string;
};

const listBoardsServer = createServerFn({ method: "POST" })
	.inputValidator((input: { userId: string; accessToken: string }) => ({
		userId: String(input.userId || "").trim(),
		accessToken: String(input.accessToken || ""),
	}))
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const, boards: [] as BoardSummary[] };
		}
		const store = await import("@/server/board-store");
		const boards = await store.listBoards(data.accessToken, verifiedUser.id);
		return { ok: true as const, boards };
	});

const createBoardServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { userId: string; accessToken: string; title: string }) => ({
			userId: String(input.userId || "").trim(),
			accessToken: String(input.accessToken || ""),
			title: String(input.title || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const auth = await import("@/server/supabase-auth");
		const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken);
		if (!verifiedUser || verifiedUser.id !== data.userId) {
			return { ok: false as const, boardId: "" };
		}
		const store = await import("@/server/board-store");
		const boardId = await store.createBoard(
			data.accessToken,
			verifiedUser.id,
			data.title,
		);
		return { ok: true as const, boardId };
	});

export const Route = createFileRoute("/boards")({
	component: BoardsPage,
});

function BoardsPage() {
	const navigate = useNavigate();
	const [session, setSession] = useState<AuthSession | null>(null);
	const [boards, setBoards] = useState<BoardSummary[]>([]);
	const [title, setTitle] = useState("");
	const [loading, setLoading] = useState(true);
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState("");

	const loadBoards = async (current: AuthSession) => {
		setLoading(true);
		setError("");
		const result = await listBoardsServer({
			data: {
				userId: current.user.id,
				accessToken: current.accessToken,
			},
		});
		if (!result.ok) {
			setBoards([]);
			setError("Failed to load boards. Please try again.");
			setLoading(false);
			return;
		}
		setBoards(result.boards);
		setLoading(false);
	};

	useEffect(() => {
		const current = getStoredSession();
		if (!isSessionValid(current)) {
			clearStoredSession();
			void navigate({ to: "/login" });
			return;
		}
		setSession(current);
		void loadBoards(current);
	}, [navigate]);

	const onCreateBoard = async () => {
		if (!session) {
			return;
		}
		setIsCreating(true);
		setError("");
		try {
			const result = await createBoardServer({
				data: {
					userId: session.user.id,
					accessToken: session.accessToken,
					title,
				},
			});
			if (!result.ok) {
				setError("Could not create board.");
				return;
			}
			await navigate({
				to: "/board/$boardId",
				params: { boardId: result.boardId },
			});
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<main className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 p-4 md:p-6">
			<section className="max-w-5xl mx-auto flex flex-col gap-4">
				<div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
					<div className="flex items-center justify-between gap-3">
						<h1 className="text-2xl font-semibold">My Boards</h1>
						<button
							type="button"
							onClick={() => {
								clearStoredSession();
								void navigate({ to: "/login" });
							}}
							className="inline-flex items-center rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
						>
							Log out
						</button>
					</div>
					<div className="flex gap-2">
						<input
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="New board title"
							className="flex-1 h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 outline-none focus:border-slate-500"
						/>
						<button
							type="button"
							onClick={() => void onCreateBoard()}
							disabled={isCreating}
							className="inline-flex items-center gap-2 px-4 rounded-lg bg-amber-400 text-slate-900 font-semibold disabled:opacity-60"
						>
							<Plus className="w-4 h-4" />
							Create
						</button>
					</div>
					{error ? <p className="text-sm text-rose-300">{error}</p> : null}
				</div>

				{loading ? (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<BoardCardSkeleton />
						<BoardCardSkeleton />
						<BoardCardSkeleton />
						<BoardCardSkeleton />
					</div>
				) : error ? (
					<div className="rounded-xl border border-rose-700/70 bg-rose-950/20 p-6">
						<p className="text-sm text-rose-300">{error}</p>
						<button
							type="button"
							onClick={() => {
								if (session) {
									void loadBoards(session);
								}
							}}
							disabled={!session}
							className="mt-3 inline-flex items-center rounded-lg border border-rose-600/70 px-3 py-2 text-sm text-rose-200 hover:bg-rose-950/40 disabled:opacity-60"
						>
							Retry
						</button>
					</div>
				) : boards.length === 0 ? (
					<div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
						<p className="text-sm text-slate-300">No boards yet.</p>
						<p className="text-xs text-slate-500 mt-1">
							Create your first board above to start collaborating.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{boards.map((board) => (
							<button
								key={board.id}
								type="button"
								onClick={() =>
									void navigate({
										to: "/board/$boardId",
										params: { boardId: board.id },
									})
								}
								className="text-left bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors"
							>
								<div className="flex items-center justify-between gap-2">
									<p className="text-lg font-semibold truncate">
										{board.title}
									</p>
									<span
										className={`inline-flex h-6 shrink-0 items-center rounded px-2 text-xs font-medium ${roleBadgeClassName(
											board.role,
										)}`}
									>
										{board.role}
									</span>
								</div>
								<p className="text-xs text-slate-500 mt-1">
									Updated {formatRelativeTime(board.updatedAt)}
								</p>
							</button>
						))}
					</div>
				)}
			</section>
		</main>
	);
}

function formatRelativeTime(dateString: string) {
	const now = Date.now();
	const then = new Date(dateString).getTime();
	const diffMs = now - then;
	const diffSec = Math.floor(diffMs / 1000);
	if (diffSec < 60) return "just now";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDays = Math.floor(diffHr / 24);
	if (diffDays < 30) return `${diffDays}d ago`;
	return new Date(dateString).toLocaleDateString();
}
