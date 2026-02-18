import { Plus, Search } from "lucide-react";
import { useRef, useState } from "react";
import { NOTE_COLOR_LABELS, NOTE_COLORS } from "@/lib/notes";

type CanvasToolbarProps = {
	title: string;
	filteredCount: number;
	totalCount: number;
	syncState: "idle" | "saving" | "saved" | "error";
	query: string;
	onQueryChange: (value: string) => void;
	colorFilter: string;
	onColorFilterChange: (value: string) => void;
	tagFilter: string;
	onTagFilterChange: (value: string) => void;
	tags: string[];
	onCreateNote: () => void;
	rightActions?: React.ReactNode;
};

export default function CanvasToolbar({
	title,
	filteredCount,
	totalCount,
	syncState,
	query,
	onQueryChange,
	colorFilter,
	onColorFilterChange,
	tagFilter,
	onTagFilterChange,
	tags,
	onCreateNote,
	rightActions,
}: CanvasToolbarProps) {
	const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
	const colorDropdownRef = useRef<HTMLDivElement>(null);

	return (
		<div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h2 className="text-xl font-semibold">{title}</h2>
					<p className="text-sm text-slate-400">
						Showing {filteredCount} of {totalCount} notes
					</p>
				</div>
				<div className="flex items-center gap-3">
					<span
						className={`text-xs font-medium px-2 py-1 rounded border ${
							syncState === "saved"
								? "text-emerald-300 border-emerald-500/50"
								: syncState === "error"
									? "text-rose-300 border-rose-500/50"
									: "text-amber-300 border-amber-500/50"
						}`}
					>
						{syncState === "saved"
							? "Synced"
							: syncState === "error"
								? "Sync failed"
								: syncState === "saving"
									? "Saving..."
									: "Ready"}
					</span>
					<button
						type="button"
						onClick={onCreateNote}
						className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 text-slate-900 font-semibold hover:bg-amber-300 transition-colors"
					>
						<Plus className="w-4 h-4" />
						Add note
					</button>
					{rightActions}
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
				<label className="relative block">
					<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
					<input
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
						placeholder="Search title, body, or tag..."
						className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-950 border border-slate-700 text-sm outline-none focus:border-slate-500"
					/>
				</label>

				<div className="relative" ref={colorDropdownRef}>
					<button
						type="button"
						onClick={() => setColorDropdownOpen(!colorDropdownOpen)}
						className="w-full h-10 rounded-lg bg-slate-950 border border-slate-700 text-sm px-3 outline-none text-left flex items-center gap-2 hover:border-slate-500"
					>
						{colorFilter === "all" ? (
							<span className="text-slate-400">All colors</span>
						) : (
							<>
								<span
									className="inline-block w-4 h-4 rounded-full border border-slate-600 shrink-0"
									style={{ backgroundColor: colorFilter }}
								/>
								<span>{NOTE_COLOR_LABELS[colorFilter] || colorFilter}</span>
							</>
						)}
					</button>
					{colorDropdownOpen ? (
						<>
							<div
								className="fixed inset-0 z-30"
								onClick={() => setColorDropdownOpen(false)}
								onKeyDown={(e) => {
									if (e.key === "Escape") setColorDropdownOpen(false);
								}}
							/>
							<div className="absolute top-full left-0 mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 shadow-xl z-40 py-1">
								<button
									type="button"
									onClick={() => {
										onColorFilterChange("all");
										setColorDropdownOpen(false);
									}}
									className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-slate-800 ${
										colorFilter === "all" ? "text-amber-300" : "text-slate-300"
									}`}
								>
									All colors
								</button>
								{NOTE_COLORS.map((color) => (
									<button
										key={color}
										type="button"
										onClick={() => {
											onColorFilterChange(color);
											setColorDropdownOpen(false);
										}}
										className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-slate-800 ${
											colorFilter === color
												? "text-amber-300"
												: "text-slate-300"
										}`}
									>
										<span
											className="inline-block w-4 h-4 rounded-full border border-slate-600 shrink-0"
											style={{ backgroundColor: color }}
										/>
										{NOTE_COLOR_LABELS[color] || color}
									</button>
								))}
							</div>
						</>
					) : null}
				</div>

				<select
					value={tagFilter}
					onChange={(event) => onTagFilterChange(event.target.value)}
					className="h-10 rounded-lg bg-slate-950 border border-slate-700 text-sm px-3 outline-none focus:border-slate-500"
				>
					<option value="all">All tags</option>
					{tags.map((tag) => (
						<option key={tag} value={tag}>
							{tag}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
