import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";

type BoardHeaderActionsProps = {
	realtimeStatus: "unconfigured" | "connecting" | "connected" | "error";
	presenceCount: number;
	onSettingsOpen: () => void;
	onLogout: () => void;
};

export default function BoardHeaderActions({
	realtimeStatus,
	presenceCount,
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

	return (
		<>
			<span className="flex items-center gap-1.5 text-xs text-slate-400">
				<span
					className={`inline-block w-2 h-2 rounded-full ${statusDotColor}`}
				/>
				{presenceCount > 0 ? `${presenceCount} online` : null}
			</span>
			<button
				type="button"
				onClick={onSettingsOpen}
				className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
			>
				<Settings className="w-4 h-4" />
				Settings
			</button>
			<Link
				to="/boards"
				className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
			>
				Boards
			</Link>
			<button
				type="button"
				onClick={onLogout}
				className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
			>
				Log out
			</button>
		</>
	);
}
