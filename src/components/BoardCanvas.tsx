import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CanvasToolbar from "@/components/CanvasToolbar";
import Inspector from "@/components/Inspector";
import NoteCard from "@/components/NoteCard";
import ZoomControls, { MAX_ZOOM, MIN_ZOOM } from "@/components/ZoomControls";
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

type RemoteActivity = {
	userId: string;
	label: string;
	noteId: string | null;
	activity: "editing" | "dragging" | "idle";
	timestamp: number;
};

type BoardCanvasProps = {
	notes: Note[];
	onNotesChange: (notes: Note[]) => void;
	syncState: "idle" | "saving" | "saved" | "error";
	title?: string;
	rightActions?: React.ReactNode;
	remoteActivityMap?: Map<string, RemoteActivity>;
	onBroadcastActivity?: (
		noteId: string | null,
		activity: "editing" | "dragging" | "idle",
	) => void;
};

const ZOOM_FACTOR = 1.1;
const GRID_SIZE = 28;

export default function BoardCanvas({
	notes,
	onNotesChange,
	syncState,
	title = "Your Canvas Board",
	rightActions,
	remoteActivityMap,
	onBroadcastActivity,
}: BoardCanvasProps) {
	const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
	const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [colorFilter, setColorFilter] = useState("all");
	const [tagFilter, setTagFilter] = useState("all");
	const [zoom, setZoom] = useState(1);
	const [panX, setPanX] = useState(0);
	const [panY, setPanY] = useState(0);
	const [isPanning, setIsPanning] = useState(false);
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
	} | null>(null);
	const panStateRef = useRef<{
		startX: number;
		startY: number;
		startPanX: number;
		startPanY: number;
	} | null>(null);

	const zoomRef = useRef(zoom);
	const panXRef = useRef(panX);
	const panYRef = useRef(panY);
	zoomRef.current = zoom;
	panXRef.current = panX;
	panYRef.current = panY;

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

	// Build a map of noteId → editing indicator for remote users
	const editingByMap = useMemo(() => {
		const map = new Map<
			string,
			{ userId: string; label: string; activity: string }
		>();
		if (!remoteActivityMap) return map;
		const now = Date.now();
		for (const entry of remoteActivityMap.values()) {
			if (
				entry.noteId &&
				entry.activity !== "idle" &&
				now - entry.timestamp < 10_000
			) {
				map.set(entry.noteId, {
					userId: entry.userId,
					label: entry.label,
					activity: entry.activity,
				});
			}
		}
		return map;
	}, [remoteActivityMap]);

	const screenToCanvas = useCallback((screenX: number, screenY: number) => {
		const board = boardRef.current;
		if (!board) return { x: 0, y: 0 };
		const bounds = board.getBoundingClientRect();
		return {
			x: (screenX - bounds.left - panXRef.current) / zoomRef.current,
			y: (screenY - bounds.top - panYRef.current) / zoomRef.current,
		};
	}, []);

	useEffect(() => {
		const onPointerMove = (event: PointerEvent) => {
			const board = boardRef.current;
			if (!board) return;

			const panState = panStateRef.current;
			if (panState) {
				setPanX(panState.startPanX + (event.clientX - panState.startX));
				setPanY(panState.startPanY + (event.clientY - panState.startY));
				return;
			}

			const dragState = dragStateRef.current;
			if (dragState) {
				const note = notes.find((item) => item.id === dragState.id);
				if (!note) return;
				const canvas = screenToCanvas(event.clientX, event.clientY);
				const nextX = canvas.x - dragState.offsetX;
				const nextY = canvas.y - dragState.offsetY;
				onNotesChange(
					notes.map((item) =>
						item.id === dragState.id ? { ...item, x: nextX, y: nextY } : item,
					),
				);
				return;
			}

			const resizeState = resizeStateRef.current;
			if (resizeState) {
				const z = zoomRef.current;
				const deltaX = (event.clientX - resizeState.startX) / z;
				const deltaY = (event.clientY - resizeState.startY) / z;
				const nextWidth = Math.max(
					MIN_NOTE_WIDTH,
					resizeState.startWidth + deltaX,
				);
				const nextHeight = Math.max(
					MIN_NOTE_HEIGHT,
					resizeState.startHeight + deltaY,
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
			const wasDragging = dragStateRef.current !== null;
			const wasResizing = resizeStateRef.current !== null;
			dragStateRef.current = null;
			resizeStateRef.current = null;
			if (panStateRef.current) {
				panStateRef.current = null;
				setIsPanning(false);
			}
			setActiveNoteId(null);
			if (wasDragging || wasResizing) {
				onBroadcastActivity?.(null, "idle");
			}
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};
	}, [notes, onNotesChange, screenToCanvas, onBroadcastActivity]);

	useEffect(() => {
		const board = boardRef.current;
		if (!board) return;
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const bounds = board.getBoundingClientRect();
			const cursorX = event.clientX - bounds.left;
			const cursorY = event.clientY - bounds.top;
			const oldZoom = zoomRef.current;
			const direction = event.deltaY < 0 ? 1 : -1;
			const newZoom = clamp(
				oldZoom * ZOOM_FACTOR ** direction,
				MIN_ZOOM,
				MAX_ZOOM,
			);
			const newPanX =
				cursorX - (cursorX - panXRef.current) * (newZoom / oldZoom);
			const newPanY =
				cursorY - (cursorY - panYRef.current) * (newZoom / oldZoom);
			setZoom(newZoom);
			setPanX(newPanX);
			setPanY(newPanY);
		};
		board.addEventListener("wheel", onWheel, { passive: false });
		return () => board.removeEventListener("wheel", onWheel);
	}, []);

	const createNote = () => {
		const board = boardRef.current;
		const id = `note-${Date.now()}`;
		let x = 100;
		let y = 100;
		if (board) {
			const centerX = board.clientWidth / 2;
			const centerY = board.clientHeight / 2;
			x = (centerX - panX) / zoom - DEFAULT_NOTE_WIDTH / 2;
			y = (centerY - panY) / zoom - DEFAULT_NOTE_HEIGHT / 2;
		}
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
		if (!boardRef.current) return;
		const source = event.target as HTMLElement;
		if (["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(source.tagName))
			return;
		const note = notes.find((item) => item.id === id);
		if (!note) return;
		const canvas = screenToCanvas(event.clientX, event.clientY);
		dragStateRef.current = {
			id,
			offsetX: canvas.x - note.x,
			offsetY: canvas.y - note.y,
		};
		resizeStateRef.current = null;
		panStateRef.current = null;
		setActiveNoteId(id);
		setSelectedNoteId(id);
		bringToFront(id);
		onBroadcastActivity?.(id, "dragging");
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
		panStateRef.current = null;
		resizeStateRef.current = {
			id,
			startX: event.clientX,
			startY: event.clientY,
			startWidth: note.width,
			startHeight: note.height,
		};
		setActiveNoteId(id);
		setSelectedNoteId(id);
		bringToFront(id);
	};

	const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.target !== boardRef.current) return;
		panStateRef.current = {
			startX: event.clientX,
			startY: event.clientY,
			startPanX: panX,
			startPanY: panY,
		};
		dragStateRef.current = null;
		resizeStateRef.current = null;
		setSelectedNoteId(null);
		setIsPanning(true);
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
				const targetWidth = clamp(note.imageNaturalWidth, MIN_NOTE_WIDTH, 560);
				const targetHeight = clamp(targetWidth / ratio, MIN_NOTE_HEIGHT, 520);
				return { ...note, width: targetWidth, height: targetHeight };
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
		onBroadcastActivity?.(id, "editing");
	};

	const handleZoomIn = () => {
		const board = boardRef.current;
		if (!board) return;
		const oldZoom = zoom;
		const newZoom = clamp(oldZoom * ZOOM_FACTOR, MIN_ZOOM, MAX_ZOOM);
		const cx = board.clientWidth / 2;
		const cy = board.clientHeight / 2;
		setPanX(cx - (cx - panX) * (newZoom / oldZoom));
		setPanY(cy - (cy - panY) * (newZoom / oldZoom));
		setZoom(newZoom);
	};

	const handleZoomOut = () => {
		const board = boardRef.current;
		if (!board) return;
		const oldZoom = zoom;
		const newZoom = clamp(oldZoom / ZOOM_FACTOR, MIN_ZOOM, MAX_ZOOM);
		const cx = board.clientWidth / 2;
		const cy = board.clientHeight / 2;
		setPanX(cx - (cx - panX) * (newZoom / oldZoom));
		setPanY(cy - (cy - panY) * (newZoom / oldZoom));
		setZoom(newZoom);
	};

	const handleZoomReset = () => {
		setZoom(1);
		setPanX(0);
		setPanY(0);
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
						className="relative min-h-[420px] lg:min-h-0 border border-slate-700 rounded-2xl overflow-hidden touch-none"
						style={{
							backgroundColor: "#0f172a",
							backgroundImage:
								"linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)",
							backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
							backgroundPosition: `${panX}px ${panY}px`,
							cursor: isPanning ? "grabbing" : "grab",
						}}
						onPointerDown={startPan}
					>
						<div
							style={{
								transformOrigin: "0 0",
								transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
							}}
						>
							{filteredNotes.map((note) => (
								<NoteCard
									key={note.id}
									note={note}
									isActive={activeNoteId === note.id}
									isSelected={selectedNoteId === note.id}
									editingBy={editingByMap.get(note.id)}
									onSelect={handleSelectNote}
									onStartDrag={startDrag}
									onStartResize={startResize}
									onRemove={removeNote}
									onReactionToggle={handleReactionToggle}
								/>
							))}
						</div>
						<ZoomControls
							zoom={zoom}
							onZoomIn={handleZoomIn}
							onZoomOut={handleZoomOut}
							onReset={handleZoomReset}
						/>
					</div>
				</div>
			</section>
		</main>
	);
}
