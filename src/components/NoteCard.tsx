import { GripHorizontal, Trash2 } from "lucide-react";
import { NOTE_REACTIONS, type Note, toSafeLink } from "@/lib/notes";

type NoteCardProps = {
	note: Note;
	isActive: boolean;
	isSelected: boolean;
	onSelect: (id: string) => void;
	onStartDrag: (id: string, event: React.PointerEvent<HTMLDivElement>) => void;
	onStartResize: (
		id: string,
		event: React.PointerEvent<HTMLDivElement>,
	) => void;
	onRemove: (id: string) => void;
	onReactionToggle: (id: string, emoji: string) => void;
};

export default function NoteCard({
	note,
	isActive,
	isSelected,
	onSelect,
	onStartDrag,
	onStartResize,
	onRemove,
	onReactionToggle,
}: NoteCardProps) {
	return (
		<div
			className={`absolute rounded-xl border border-slate-800/30 shadow-xl animate-note-appear transition-shadow duration-150 ${
				isActive || isSelected ? "ring-2 ring-amber-200/70" : ""
			}`}
			style={{
				left: note.x,
				top: note.y,
				width: note.width,
				height: note.height,
				backgroundColor: note.color,
			}}
			onPointerDown={() => onSelect(note.id)}
		>
			<div
				onPointerDown={(event) => onStartDrag(note.id, event)}
				className="h-10 px-3 flex items-center justify-between cursor-grab active:cursor-grabbing bg-black/10 rounded-t-xl select-none touch-none"
			>
				<span className="text-xs font-semibold uppercase tracking-wide text-slate-800/70">
					note
				</span>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => onRemove(note.id)}
						className="ml-1 p-1 rounded text-slate-800/70 hover:bg-black/10 hover:text-slate-950"
						aria-label="Delete note"
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
			</div>

			<div className="h-[calc(100%-2.5rem)] px-3 py-2 flex flex-col gap-2">
				<h4 className="text-sm font-semibold text-slate-900 truncate">
					{note.title.trim() || "Untitled note"}
				</h4>
				<p className="max-h-20 overflow-hidden text-xs leading-relaxed text-slate-900/85">
					{note.body.trim() ||
						"No content yet. Use the inspector to edit this note."}
				</p>
				{note.imageDataUrl ? (
					<div className="w-full rounded overflow-hidden border border-black/10 bg-black/5 mt-auto">
						<img
							src={note.imageDataUrl}
							alt="Note attachment"
							className="w-full"
							style={{
								height: Math.max(
									64,
									Math.min(132, Math.floor(note.height * 0.28)),
								),
								objectFit: note.imageFit,
							}}
						/>
					</div>
				) : null}
				<div className="flex items-center gap-1 flex-wrap mt-auto">
					{note.tag.trim() ? (
						<span className="rounded bg-black/15 px-1.5 py-0.5 text-[11px] text-slate-900/80">
							#{note.tag.trim()}
						</span>
					) : null}
					{note.link.trim() ? (
						<a
							href={toSafeLink(note.link)}
							target="_blank"
							rel="noreferrer noopener"
							className="rounded bg-black/15 px-1.5 py-0.5 text-[11px] text-blue-900 underline"
							onPointerDown={(event) => event.stopPropagation()}
						>
							link
						</a>
					) : null}
					{note.reactionEmoji ? (
						<span className="rounded bg-black/15 px-1.5 py-0.5 text-[11px] text-slate-900/90">
							{note.reactionEmoji}
						</span>
					) : null}
				</div>
				<div className="flex items-center gap-1">
					{NOTE_REACTIONS.map((emoji) => (
						<button
							key={`${note.id}-reaction-${emoji}`}
							type="button"
							onClick={() => onReactionToggle(note.id, emoji)}
							className={`rounded border px-1.5 py-0.5 text-xs ${
								note.reactionEmoji === emoji
									? "border-slate-900/70 bg-black/20 text-slate-900"
									: "border-black/20 bg-black/10 text-slate-900/85"
							}`}
							aria-label={`Set reaction ${emoji}`}
						>
							{emoji}
						</button>
					))}
				</div>
			</div>

			<div
				className="absolute right-0 bottom-0 w-6 h-6 cursor-se-resize bg-black/15 rounded-tl-md flex items-center justify-center"
				onPointerDown={(event) => onStartResize(note.id, event)}
				aria-label="Resize note"
			>
				<GripHorizontal className="w-3.5 h-3.5 text-slate-800/60" />
			</div>
		</div>
	);
}
