import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, Settings } from "lucide-react";

type BoardHeaderActionsProps = {
	realtimeStatus: "unconfigured" | "connecting" | "connected" | "error";
	presenceCount: number;
	activeEditorCount?: number;
	onSettingsOpen: () => void;
	onLogout: () => void;
};

export default function BoardHeaderActions({
	realtimeStatus,
	presenceCount,
	activeEditorCount = 0,
	onSettingsOpen,
	onLogout,
}: BoardHeaderActionsProps) {
	const statusDotColor =
		realtimeStatus === "connected"
			? "bg-emerald-400"
			: realtimeStatus === "connecting"
				? "bg-amber-400"
				: realtimeStatus === "error"
					? "bg-rose-400"
					: "bg-slate-500";

	const statusLabel =
		realtimeStatus === "connected"
			? "Connected"
			: realtimeStatus === "connecting"
				? "Reconnecting"
				: realtimeStatus === "error"
					? "Disconnected"
					: "Offline";

	return (
		<>
			<span
				className="flex items-center gap-1.5 text-xs text-slate-400"
				title={`Realtime status: ${statusLabel}${presenceCount > 0 ? `, ${presenceCount} online` : ""}`}
			>
				<span
					className={`inline-block w-2 h-2 rounded-full ${statusDotColor}`}
					aria-hidden="true"
				/>
				{presenceCount > 0 ? `${presenceCount} online` : null}
				{activeEditorCount > 0 ? (
					<span className="text-amber-300">({activeEditorCount} editing)</span>
				) : null}
			</span>
			<button
				type="button"
				onClick={onSettingsOpen}
				aria-label="Board settings"
				className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
			>
				<Settings className="w-4 h-4" />
				<span className="hidden sm:inline">Settings</span>
			</button>
			<Link
				to="/boards"
				aria-label="Go to boards list"
				className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
			>
				<LayoutDashboard className="w-4 h-4 sm:hidden" />
				<span className="hidden sm:inline">Boards</span>
			</Link>
			<button
				type="button"
				onClick={onLogout}
				aria-label="Log out"
				className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
			>
				<LogOut className="w-4 h-4 sm:hidden" />
				<span className="hidden sm:inline">Log out</span>
			</button>
		</>
	);
}
