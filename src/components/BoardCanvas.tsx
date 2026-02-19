import { PanelBottomOpen } from "lucide-react";
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
const NUDGE_PX = 10;

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
	const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
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
	const pinchRef = useRef<{
		initialDistance: number;
		initialZoom: number;
		midX: number;
		midY: number;
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

	// Mouse wheel zoom
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

	// Pinch-to-zoom (Step 6.6)
	useEffect(() => {
		const board = boardRef.current;
		if (!board) return;

		const getDistance = (t1: Touch, t2: Touch) =>
			Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length === 2) {
				const d = getDistance(e.touches[0], e.touches[1]);
				const bounds = board.getBoundingClientRect();
				pinchRef.current = {
					initialDistance: d,
					initialZoom: zoomRef.current,
					midX: (e.touches[0].clientX + e.touches[1].clientX) / 2 - bounds.left,
					midY: (e.touches[0].clientY + e.touches[1].clientY) / 2 - bounds.top,
				};
			}
		};

		const onTouchMove = (e: TouchEvent) => {
			if (e.touches.length === 2 && pinchRef.current) {
				e.preventDefault();
				const d = getDistance(e.touches[0], e.touches[1]);
				const ratio = d / pinchRef.current.initialDistance;
				const oldZoom = zoomRef.current;
				const newZoom = clamp(
					pinchRef.current.initialZoom * ratio,
					MIN_ZOOM,
					MAX_ZOOM,
				);
				const cx = pinchRef.current.midX;
				const cy = pinchRef.current.midY;
				setPanX(cx - (cx - panXRef.current) * (newZoom / oldZoom));
				setPanY(cy - (cy - panYRef.current) * (newZoom / oldZoom));
				setZoom(newZoom);
			}
		};

		const onTouchEnd = () => {
			pinchRef.current = null;
		};

		board.addEventListener("touchstart", onTouchStart, { passive: true });
		board.addEventListener("touchmove", onTouchMove, { passive: false });
		board.addEventListener("touchend", onTouchEnd, { passive: true });
		return () => {
			board.removeEventListener("touchstart", onTouchStart);
			board.removeEventListener("touchmove", onTouchMove);
			board.removeEventListener("touchend", onTouchEnd);
		};
	}, []);

	const bringToFront = useCallback(
		(id: string) => {
			const target = notes.find((item) => item.id === id);
			if (!target) return;
			onNotesChange([...notes.filter((item) => item.id !== id), target]);
		},
		[notes, onNotesChange],
	);

	const removeNote = useCallback(
		(id: string) => {
			if (selectedNoteId === id) setSelectedNoteId(null);
			onNotesChange(notes.filter((note) => note.id !== id));
		},
		[selectedNoteId, notes, onNotesChange],
	);

	// Keyboard navigation for notes (Step 6.7)
	const handleCanvasKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			// Only handle keys when canvas area is focused (not child inputs)
			const tag = (e.target as HTMLElement).tagName;
			if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

			if (e.key === "Escape") {
				setSelectedNoteId(null);
				return;
			}

			if ((e.key === "Delete" || e.key === "Backspace") && selectedNoteId) {
				e.preventDefault();
				removeNote(selectedNoteId);
				return;
			}

			// Arrow keys nudge selected note
			if (
				selectedNoteId &&
				["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
			) {
				e.preventDefault();
				const dx =
					e.key === "ArrowLeft"
						? -NUDGE_PX
						: e.key === "ArrowRight"
							? NUDGE_PX
							: 0;
				const dy =
					e.key === "ArrowUp"
						? -NUDGE_PX
						: e.key === "ArrowDown"
							? NUDGE_PX
							: 0;
				onNotesChange(
					notes.map((n) =>
						n.id === selectedNoteId ? { ...n, x: n.x + dx, y: n.y + dy } : n,
					),
				);
				return;
			}

			// Tab/Shift+Tab to cycle through notes
			if (e.key === "Tab" && filteredNotes.length > 0) {
				e.preventDefault();
				const currentIdx = filteredNotes.findIndex(
					(n) => n.id === selectedNoteId,
				);
				let nextIdx: number;
				if (e.shiftKey) {
					nextIdx = currentIdx <= 0 ? filteredNotes.length - 1 : currentIdx - 1;
				} else {
					nextIdx = currentIdx >= filteredNotes.length - 1 ? 0 : currentIdx + 1;
				}
				const next = filteredNotes[nextIdx];
				setSelectedNoteId(next.id);
				bringToFront(next.id);
				onBroadcastActivity?.(next.id, "editing");
			}
		},
		[
			selectedNoteId,
			filteredNotes,
			notes,
			onNotesChange,
			onBroadcastActivity,
			removeNote,
			bringToFront,
		],
	);

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
					{/* Desktop inspector */}
					<Inspector
						selectedNote={selectedNote}
						onUpdateNote={updateNote}
						onUpdateNoteImage={(id, file) => void updateNoteImage(id, file)}
						onFitNoteToImage={fitNoteToImage}
						onRemoveNoteImage={removeNoteImage}
						onRemoveNote={removeNote}
						className="hidden lg:flex"
					/>
					<div
						ref={boardRef}
						tabIndex={0}
						role="toolbar"
						aria-label="Canvas board - use arrow keys to move notes, Tab to cycle, Delete to remove"
						onKeyDown={handleCanvasKeyDown}
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

				{/* Mobile inspector toggle button */}
				<button
					type="button"
					onClick={() => setMobileInspectorOpen(true)}
					aria-label="Open inspector"
					className="fixed bottom-4 right-4 z-30 lg:hidden inline-flex items-center gap-2 px-4 py-3 rounded-full bg-slate-800 border border-slate-600 text-slate-200 text-sm font-medium shadow-lg hover:bg-slate-700 transition-colors"
				>
					<PanelBottomOpen className="w-4 h-4" />
					Inspector
				</button>

				{/* Mobile inspector bottom sheet */}
				{mobileInspectorOpen ? (
					<>
						<div
							role="presentation"
							className="fixed inset-0 z-40 bg-black/40 lg:hidden"
							onClick={() => setMobileInspectorOpen(false)}
							onKeyDown={(e) => {
								if (e.key === "Escape") setMobileInspectorOpen(false);
							}}
						/>
						<div
							role="dialog"
							aria-modal="true"
							aria-label="Inspector"
							className="fixed inset-x-0 bottom-0 z-50 lg:hidden max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900 shadow-2xl animate-sheet-up"
						>
							<div className="flex items-center justify-between p-3 border-b border-slate-700/50">
								<span className="text-sm font-semibold text-slate-300">
									Inspector
								</span>
								<button
									type="button"
									onClick={() => setMobileInspectorOpen(false)}
									className="p-1 rounded hover:bg-slate-800 text-slate-400"
									aria-label="Close inspector"
								>
									&times;
								</button>
							</div>
							<div className="p-4">
								<Inspector
									selectedNote={selectedNote}
									onUpdateNote={updateNote}
									onUpdateNoteImage={(id, file) =>
										void updateNoteImage(id, file)
									}
									onFitNoteToImage={fitNoteToImage}
									onRemoveNoteImage={removeNoteImage}
									onRemoveNote={removeNote}
									className="border-0 bg-transparent p-0"
								/>
							</div>
						</div>
					</>
				) : null}
			</section>
		</main>
	);
}
