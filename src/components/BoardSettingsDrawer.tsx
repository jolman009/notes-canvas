import { X } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { roleBadgeClassName } from "@/lib/notes";

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

type BoardMemberSummary = {
	userId: string;
	role: "owner" | "editor" | "viewer";
	createdAt: string;
};

type BoardSettingsDrawerProps = {
	open: boolean;
	onClose: () => void;
	boardId: string;
	boardTitle: string;
	boardTitleDraft: string;
	onBoardTitleDraftChange: (value: string) => void;
	isOwner: boolean;
	canEdit: boolean;
	role: "owner" | "editor" | "viewer";
	// Members
	members: BoardMemberSummary[];
	currentUserId: string;
	onRenameBoard: () => void;
	isRenamingBoard: boolean;
	onDeleteBoard: () => void;
	isDeletingBoard: boolean;
	onLeaveBoard: () => void;
	isLeavingBoard: boolean;
	onUpdateMemberRole: (userId: string, role: "editor" | "viewer") => void;
	onRemoveMember: (userId: string) => void;
	onTransferOwnership: (userId: string) => void;
	memberActionUserId: string;
	isTransferringOwnership: boolean;
	// Invites
	activeInvites: BoardInviteSummary[];
	inviteRole: "editor" | "viewer";
	onInviteRoleChange: (role: "editor" | "viewer") => void;
	inviteMode: "one_time" | "reusable";
	onInviteModeChange: (mode: "one_time" | "reusable") => void;
	onCreateInvite: () => void;
	isCreatingInvite: boolean;
	onRevokeInvite: (inviteId: string) => void;
	onCleanupInvites: () => void;
	isCleaningInvites: boolean;
	inviteLink: string;
	inviteMessage: string;
	boardMessage: string;
	// Sync stats
	presenceUsers: Array<{ id: string; label: string }>;
	boardRevision: number;
	lastSyncAt: Date | null;
	conflictCount: number;
	syncFailureCount: number;
	realtimeStatus: "unconfigured" | "connecting" | "connected" | "error";
};

export default function BoardSettingsDrawer({
	open,
	onClose,
	boardTitle,
	boardTitleDraft,
	onBoardTitleDraftChange,
	isOwner,
	role,
	members,
	currentUserId,
	onRenameBoard,
	isRenamingBoard,
	onDeleteBoard,
	isDeletingBoard,
	onLeaveBoard,
	isLeavingBoard,
	onUpdateMemberRole,
	onRemoveMember,
	onTransferOwnership,
	memberActionUserId,
	isTransferringOwnership,
	activeInvites,
	inviteRole,
	onInviteRoleChange,
	inviteMode,
	onInviteModeChange,
	onCreateInvite,
	isCreatingInvite,
	onRevokeInvite,
	onCleanupInvites,
	isCleaningInvites,
	inviteLink,
	inviteMessage,
	boardMessage,
	presenceUsers,
	boardRevision,
	lastSyncAt,
	conflictCount,
	syncFailureCount,
	realtimeStatus,
}: BoardSettingsDrawerProps) {
	const [confirmAction, setConfirmAction] = useState<
		| null
		| { type: "removeMember"; userId: string }
		| { type: "transferOwnership"; userId: string }
		| { type: "leaveBoard" }
		| { type: "deleteBoard" }
	>(null);

	if (!open) return null;

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/40"
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === "Escape") onClose();
				}}
			/>
			<div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto animate-drawer-in">
				<div className="flex items-center justify-between p-4 border-b border-slate-700">
					<h2 className="text-lg font-semibold text-slate-100">
						Board Settings
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded hover:bg-slate-800 text-slate-400"
						aria-label="Close"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Sync stats */}
				<div className="p-4 border-b border-slate-700/50">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
						Status
					</h3>
					<div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
						<span>Role</span>
						<span className="text-slate-100">{role}</span>
						<span>Revision</span>
						<span className="text-slate-100">{boardRevision}</span>
						<span>Last sync</span>
						<span className="text-slate-100">
							{lastSyncAt ? lastSyncAt.toLocaleTimeString() : "Never"}
						</span>
						<span>Conflicts</span>
						<span className="text-slate-100">{conflictCount}</span>
						<span>Sync failures</span>
						<span className="text-slate-100">{syncFailureCount}</span>
						<span>Realtime</span>
						<span
							className={
								realtimeStatus === "connected"
									? "text-emerald-300"
									: realtimeStatus === "connecting"
										? "text-amber-300"
										: realtimeStatus === "error"
											? "text-rose-300"
											: "text-slate-400"
							}
						>
							{realtimeStatus === "connected"
								? "Live"
								: realtimeStatus === "connecting"
									? "Reconnecting"
									: realtimeStatus === "error"
										? "Offline"
										: "Unavailable"}
						</span>
					</div>
					{presenceUsers.length > 0 ? (
						<div className="mt-2 text-xs text-slate-400">
							Active: {presenceUsers.map((u) => u.label).join(", ")}
						</div>
					) : null}
				</div>

				{/* Invites section (owner-only) */}
				{isOwner ? (
					<div className="p-4 border-b border-slate-700/50">
						<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
							Invites
						</h3>
						<div className="flex gap-2 flex-wrap mb-3">
							<select
								value={inviteRole}
								onChange={(e) =>
									onInviteRoleChange(
										e.target.value === "viewer" ? "viewer" : "editor",
									)
								}
								className="h-9 rounded-lg bg-slate-950 border border-slate-700 text-sm px-2"
							>
								<option value="editor">Editor</option>
								<option value="viewer">Viewer</option>
							</select>
							<select
								value={inviteMode}
								onChange={(e) =>
									onInviteModeChange(
										e.target.value === "reusable" ? "reusable" : "one_time",
									)
								}
								className="h-9 rounded-lg bg-slate-950 border border-slate-700 text-sm px-2"
							>
								<option value="one_time">One-time</option>
								<option value="reusable">Reusable</option>
							</select>
							<button
								type="button"
								onClick={onCreateInvite}
								disabled={isCreatingInvite}
								className="h-9 rounded-lg border border-slate-600 px-3 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
							>
								{isCreatingInvite ? "Creating..." : "Create invite"}
							</button>
						</div>
						{inviteLink ? (
							<p className="text-xs text-amber-300 break-all mb-2">
								{inviteLink}
							</p>
						) : null}
						{inviteMessage ? (
							<p className="text-xs text-slate-400 mb-2">{inviteMessage}</p>
						) : null}
						{activeInvites.length > 0 ? (
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<span className="text-xs text-slate-300">
										Active invites ({activeInvites.length})
									</span>
									<button
										type="button"
										onClick={onCleanupInvites}
										disabled={isCleaningInvites}
										className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-60"
									>
										{isCleaningInvites ? "Cleaning..." : "Cleanup"}
									</button>
								</div>
								{activeInvites.map((invite) => (
									<div
										key={invite.id}
										className="flex items-center justify-between gap-2 rounded border border-slate-700 px-3 py-2 text-xs text-slate-300"
									>
										<span className="truncate">
											{invite.role} |{" "}
											{invite.isReusable ? "reusable" : "one-time"} | uses{" "}
											{invite.acceptedCount} | expires{" "}
											{new Date(invite.expiresAt).toLocaleDateString()}
										</span>
										<button
											type="button"
											onClick={() => onRevokeInvite(invite.id)}
											className="shrink-0 rounded border border-rose-600/70 px-2 py-1 text-rose-300 hover:bg-rose-950/40"
										>
											Revoke
										</button>
									</div>
								))}
							</div>
						) : null}
					</div>
				) : null}

				{/* Board settings */}
				<div className="p-4 border-b border-slate-700/50">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
						Settings
					</h3>
					{isOwner ? (
						<div className="space-y-3">
							<div className="flex gap-2">
								<input
									value={boardTitleDraft}
									onChange={(e) => onBoardTitleDraftChange(e.target.value)}
									className="h-9 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-slate-500"
									placeholder="Board title"
								/>
								<button
									type="button"
									onClick={onRenameBoard}
									disabled={isRenamingBoard}
									className="h-9 rounded-lg border border-slate-600 px-3 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
								>
									{isRenamingBoard ? "Saving..." : "Rename"}
								</button>
							</div>
							<button
								type="button"
								onClick={() => setConfirmAction({ type: "deleteBoard" })}
								disabled={isDeletingBoard}
								className="h-9 rounded-lg border border-rose-600/70 px-3 text-sm text-rose-300 hover:bg-rose-950/40 disabled:opacity-60"
							>
								{isDeletingBoard ? "Deleting..." : "Delete board"}
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setConfirmAction({ type: "leaveBoard" })}
							disabled={isLeavingBoard}
							className="h-9 rounded-lg border border-amber-600/70 px-3 text-sm text-amber-300 hover:bg-amber-950/30 disabled:opacity-60"
						>
							{isLeavingBoard ? "Leaving..." : "Leave board"}
						</button>
					)}
					{boardMessage ? (
						<p className="mt-2 text-xs text-amber-300">{boardMessage}</p>
					) : null}
				</div>

				{/* Members */}
				<div className="p-4">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
						Members ({members.length})
					</h3>
					{members.length === 0 ? (
						<p className="text-xs text-slate-500">No members found.</p>
					) : (
						<div className="space-y-2">
							{members.map((member) => {
								const isCurrentUser = member.userId === currentUserId;
								const isOwnerRow = member.role === "owner";
								const canManage = isOwner && !isOwnerRow && !isCurrentUser;
								return (
									<div
										key={member.userId}
										className="rounded border border-slate-700 bg-slate-950/50 px-3 py-2"
									>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div>
												<p className="text-xs text-slate-200">
													{member.userId}
													{isCurrentUser ? " (you)" : ""}
												</p>
												<p className="text-[11px] text-slate-500">
													Added{" "}
													{new Date(member.createdAt).toLocaleDateString()}
												</p>
											</div>
											{canManage ? (
												<div className="flex items-center gap-2">
													<button
														type="button"
														onClick={() =>
															setConfirmAction({
																type: "transferOwnership",
																userId: member.userId,
															})
														}
														disabled={
															memberActionUserId === member.userId ||
															isTransferringOwnership
														}
														className="h-7 rounded border border-amber-600/70 px-2 text-xs text-amber-300 hover:bg-amber-950/30 disabled:opacity-60"
													>
														Make owner
													</button>
													<select
														value={member.role}
														onChange={(e) =>
															onUpdateMemberRole(
																member.userId,
																e.target.value === "viewer"
																	? "viewer"
																	: "editor",
															)
														}
														disabled={
															memberActionUserId === member.userId ||
															isTransferringOwnership
														}
														className="h-7 rounded border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
													>
														<option value="editor">editor</option>
														<option value="viewer">viewer</option>
													</select>
													<button
														type="button"
														onClick={() =>
															setConfirmAction({
																type: "removeMember",
																userId: member.userId,
															})
														}
														disabled={
															memberActionUserId === member.userId ||
															isTransferringOwnership
														}
														className="h-7 rounded border border-rose-600/70 px-2 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-60"
													>
														Remove
													</button>
												</div>
											) : (
												<span
													className={`inline-flex h-7 items-center rounded px-2 text-xs font-medium ${roleBadgeClassName(
														member.role,
													)}`}
												>
													{member.role}
												</span>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>

			{/* Confirm dialogs */}
			<ConfirmDialog
				open={confirmAction?.type === "removeMember"}
				title="Remove member"
				description="Remove this member from the board? They will lose access until re-invited."
				confirmLabel="Remove"
				variant="destructive"
				onConfirm={() => {
					if (confirmAction?.type === "removeMember") {
						onRemoveMember(confirmAction.userId);
					}
					setConfirmAction(null);
				}}
				onCancel={() => setConfirmAction(null)}
			/>
			<ConfirmDialog
				open={confirmAction?.type === "transferOwnership"}
				title="Transfer ownership"
				description="Transfer ownership to this member? You will become an editor."
				confirmLabel="Transfer"
				variant="destructive"
				onConfirm={() => {
					if (confirmAction?.type === "transferOwnership") {
						onTransferOwnership(confirmAction.userId);
					}
					setConfirmAction(null);
				}}
				onCancel={() => setConfirmAction(null)}
			/>
			<ConfirmDialog
				open={confirmAction?.type === "leaveBoard"}
				title="Leave board"
				description="Leave this board? You will lose access until re-invited."
				confirmLabel="Leave"
				variant="destructive"
				onConfirm={() => {
					onLeaveBoard();
					setConfirmAction(null);
				}}
				onCancel={() => setConfirmAction(null)}
			/>
			<ConfirmDialog
				open={confirmAction?.type === "deleteBoard"}
				title="Delete board"
				description={`Type "${boardTitle}" to delete this board permanently.`}
				confirmLabel="Delete"
				variant="destructive"
				promptMode
				promptPlaceholder="Type the board title to confirm"
				promptValidation={boardTitle}
				onConfirm={() => {
					onDeleteBoard();
					setConfirmAction(null);
				}}
				onCancel={() => setConfirmAction(null)}
			/>
		</>
	);
}
