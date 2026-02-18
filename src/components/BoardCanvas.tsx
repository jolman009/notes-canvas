import { useEffect, useMemo, useRef, useState } from "react";
import CanvasToolbar from "@/components/CanvasToolbar";
import Inspector from "@/components/Inspector";
import NoteCard from "@/components/NoteCard";
import { readImageFile } from "@/lib/canvas-helpers";
import {
	clamp,
	DEFAULT_NOTE_HEIGHT,
	DEFAULT_NOTE_WIDTH,
	MIN_NOTE_HEIGHT,
	MIN_NOTE_WIDTH,
	NOTE_COLORS,
	type Note,
} from "@/lib/notes";

type BoardCanvasProps = {
	notes: Note[];
	onNotesChange: (notes: Note[]) => void;
	syncState: "idle" | "saving" | "saved" | "error";
	title?: string;
	rightActions?: React.ReactNode;
};

export default function BoardCanvas({
	notes,
	onNotesChange,
	syncState,
	title = "Your Canvas Board",
	rightActions,
}: BoardCanvasProps) {
	const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
	const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [colorFilter, setColorFilter] = useState("all");
	const [tagFilter, setTagFilter] = useState("all");
	const boardRef = useRef<HTMLDivElement | null>(null);
	const dragStateRef = useRef<{
		id: string;
		offsetX: number;
		offsetY: number;
	} | null>(null);
	const resizeStateRef = useRef<{
		id: string;
		startX: number;
		startY: number;
		startWidth: number;
		startHeight: number;
		noteX: number;
		noteY: number;
	} | null>(null);

	const tags = useMemo(
		() =>
			Array.from(
				new Set(
					notes.map((note) => note.tag.trim()).filter((tag) => tag.length > 0),
				),
			).sort((a, b) => a.localeCompare(b)),
		[notes],
	);

	const filteredNotes = useMemo(
		() =>
			notes.filter((note) => {
				const textMatches =
					query.trim().length === 0 ||
					`${note.title}\n${note.body}\n${note.tag}\n${note.link}`
						.toLowerCase()
						.includes(query.toLowerCase());
				const colorMatches =
					colorFilter === "all" || note.color === colorFilter;
				const tagMatches = tagFilter === "all" || note.tag.trim() === tagFilter;
				return textMatches && colorMatches && tagMatches;
			}),
		[notes, query, colorFilter, tagFilter],
	);

	const selectedNote = useMemo(
		() => notes.find((note) => note.id === selectedNoteId) || null,
		[notes, selectedNoteId],
	);

	useEffect(() => {
		const onPointerMove = (event: PointerEvent) => {
			const board = boardRef.current;
			if (!board) return;

			const dragState = dragStateRef.current;
			if (dragState) {
				const note = notes.find((item) => item.id === dragState.id);
				if (!note) return;
				const bounds = board.getBoundingClientRect();
				const nextX = clamp(
					event.clientX - bounds.left - dragState.offsetX,
					0,
					Math.max(0, bounds.width - note.width),
				);
				const nextY = clamp(
					event.clientY - bounds.top - dragState.offsetY,
					0,
					Math.max(0, bounds.height - note.height),
				);
				onNotesChange(
					notes.map((item) =>
						item.id === dragState.id ? { ...item, x: nextX, y: nextY } : item,
					),
				);
				return;
			}

			const resizeState = resizeStateRef.current;
			if (resizeState) {
				const bounds = board.getBoundingClientRect();
				const deltaX = event.clientX - resizeState.startX;
				const deltaY = event.clientY - resizeState.startY;
				const nextWidth = clamp(
					resizeState.startWidth + deltaX,
					MIN_NOTE_WIDTH,
					Math.max(MIN_NOTE_WIDTH, bounds.width - resizeState.noteX),
				);
				const nextHeight = clamp(
					resizeState.startHeight + deltaY,
					MIN_NOTE_HEIGHT,
					Math.max(MIN_NOTE_HEIGHT, bounds.height - resizeState.noteY),
				);
				onNotesChange(
					notes.map((item) =>
						item.id === resizeState.id
							? { ...item, width: nextWidth, height: nextHeight }
							: item,
					),
				);
			}
		};

		const onPointerUp = () => {
			dragStateRef.current = null;
			resizeStateRef.current = null;
			setActiveNoteId(null);
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};
	}, [notes, onNotesChange]);

	const createNote = () => {
		const board = boardRef.current;
		const id = `note-${Date.now()}`;
		const x = board
			? clamp(
					board.clientWidth / 2 - DEFAULT_NOTE_WIDTH / 2,
					0,
					board.clientWidth - DEFAULT_NOTE_WIDTH,
				)
			: 100;
		const y = board
			? clamp(
					board.clientHeight / 2 - DEFAULT_NOTE_HEIGHT / 2,
					0,
					board.clientHeight - DEFAULT_NOTE_HEIGHT,
				)
			: 100;

		onNotesChange([
			...notes,
			{
				id,
				title: "New note",
				body: "",
				tag: "",
				link: "",
				imageDataUrl: "",
				imageFit: "cover",
				imageNaturalWidth: 0,
				imageNaturalHeight: 0,
				reactionEmoji: "",
				x,
				y,
				width: DEFAULT_NOTE_WIDTH,
				height: DEFAULT_NOTE_HEIGHT,
				color: NOTE_COLORS[notes.length % NOTE_COLORS.length],
			},
		]);
		setSelectedNoteId(id);
	};

	const bringToFront = (id: string) => {
		const target = notes.find((item) => item.id === id);
		if (!target) return;
		onNotesChange([...notes.filter((item) => item.id !== id), target]);
	};

	const startDrag = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
		const board = boardRef.current;
		if (!board) return;
		const source = event.target as HTMLElement;
		if (["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(source.tagName))
			return;
		const note = notes.find((item) => item.id === id);
		if (!note) return;
		const bounds = board.getBoundingClientRect();
		dragStateRef.current = {
			id,
			offsetX: event.clientX - bounds.left - note.x,
			offsetY: event.clientY - bounds.top - note.y,
		};
		resizeStateRef.current = null;
		setActiveNoteId(id);
		setSelectedNoteId(id);
		bringToFront(id);
	};

	const startResize = (
		id: string,
		event: React.PointerEvent<HTMLDivElement>,
	) => {
		event.preventDefault();
		event.stopPropagation();
		const note = notes.find((item) => item.id === id);
		if (!note) return;
		dragStateRef.current = null;
		resizeStateRef.current = {
			id,
			startX: event.clientX,
			startY: event.clientY,
			startWidth: note.width,
			startHeight: note.height,
			noteX: note.x,
			noteY: note.y,
		};
		setActiveNoteId(id);
		setSelectedNoteId(id);
		bringToFront(id);
	};

	const removeNote = (id: string) => {
		if (selectedNoteId === id) setSelectedNoteId(null);
		onNotesChange(notes.filter((note) => note.id !== id));
	};

	const removeNoteImage = (id: string) => {
		onNotesChange(
			notes.map((item) =>
				item.id === id
					? {
							...item,
							imageDataUrl: "",
							imageNaturalWidth: 0,
							imageNaturalHeight: 0,
						}
					: item,
			),
		);
	};

	const updateNote = (
		id: string,
		field: keyof Pick<
			Note,
			| "title"
			| "body"
			| "tag"
			| "color"
			| "link"
			| "imageDataUrl"
			| "imageFit"
			| "imageNaturalWidth"
			| "imageNaturalHeight"
			| "reactionEmoji"
		>,
		value: string | number,
	) => {
		onNotesChange(
			notes.map((note) =>
				note.id === id ? { ...note, [field]: value } : note,
			),
		);
	};

	const updateNoteImage = async (id: string, file: File | null) => {
		if (!file || !file.type.startsWith("image/")) return;
		const image = await readImageFile(file);
		onNotesChange(
			notes.map((note) =>
				note.id === id
					? {
							...note,
							imageDataUrl: image.dataUrl,
							imageNaturalWidth: image.width,
							imageNaturalHeight: image.height,
						}
					: note,
			),
		);
	};

	const fitNoteToImage = (id: string) => {
		const board = boardRef.current;
		if (!board) return;
		const boardWidth = board.clientWidth;
		const boardHeight = board.clientHeight;

		onNotesChange(
			notes.map((note) => {
				if (
					note.id !== id ||
					!note.imageDataUrl ||
					note.imageNaturalWidth <= 0 ||
					note.imageNaturalHeight <= 0
				)
					return note;
				const ratio = note.imageNaturalWidth / note.imageNaturalHeight;
				const targetWidth = clamp(
					note.imageNaturalWidth,
					MIN_NOTE_WIDTH,
					Math.min(560, boardWidth),
				);
				const targetHeight = clamp(
					targetWidth / ratio,
					MIN_NOTE_HEIGHT,
					Math.min(520, boardHeight),
				);
				return {
					...note,
					width: targetWidth,
					height: targetHeight,
					x: clamp(note.x, 0, Math.max(0, boardWidth - targetWidth)),
					y: clamp(note.y, 0, Math.max(0, boardHeight - targetHeight)),
				};
			}),
		);
	};

	const handleReactionToggle = (id: string, emoji: string) => {
		const note = notes.find((n) => n.id === id);
		if (!note) return;
		updateNote(id, "reactionEmoji", note.reactionEmoji === emoji ? "" : emoji);
	};

	const handleSelectNote = (id: string) => {
		setSelectedNoteId(id);
		bringToFront(id);
	};

	return (
		<main className="h-[calc(100vh-4rem)] bg-slate-950 text-slate-100">
			<section className="h-full p-4 md:p-6 flex flex-col gap-4">
				<CanvasToolbar
					title={title}
					filteredCount={filteredNotes.length}
					totalCount={notes.length}
					syncState={syncState}
					query={query}
					onQueryChange={setQuery}
					colorFilter={colorFilter}
					onColorFilterChange={setColorFilter}
					tagFilter={tagFilter}
					onTagFilterChange={setTagFilter}
					tags={tags}
					onCreateNote={createNote}
					rightActions={rightActions}
				/>

				<div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
					<Inspector
						selectedNote={selectedNote}
						onUpdateNote={updateNote}
						onUpdateNoteImage={(id, file) => void updateNoteImage(id, file)}
						onFitNoteToImage={fitNoteToImage}
						onRemoveNoteImage={removeNoteImage}
						onRemoveNote={removeNote}
					/>
					<div
						ref={boardRef}
						className="relative min-h-[420px] lg:min-h-0 border border-slate-700 rounded-2xl overflow-hidden"
						style={{
							backgroundColor: "#0f172a",
							backgroundImage:
								"linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)",
							backgroundSize: "28px 28px",
						}}
					>
						{filteredNotes.map((note) => (
							<NoteCard
								key={note.id}
								note={note}
								isActive={activeNoteId === note.id}
								isSelected={selectedNoteId === note.id}
								onSelect={handleSelectNote}
								onStartDrag={startDrag}
								onStartResize={startResize}
								onRemove={removeNote}
								onReactionToggle={handleReactionToggle}
							/>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
