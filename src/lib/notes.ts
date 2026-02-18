export const NOTE_COLORS = [
	"#fef3c7",
	"#dbeafe",
	"#e9d5ff",
	"#dcfce7",
	"#fde68a",
];

export const NOTE_COLOR_LABELS: Record<string, string> = {
	"#fef3c7": "Warm Yellow",
	"#dbeafe": "Sky Blue",
	"#e9d5ff": "Soft Purple",
	"#dcfce7": "Mint Green",
	"#fde68a": "Bright Gold",
};
export const DEFAULT_NOTE_WIDTH = 260;
export const DEFAULT_NOTE_HEIGHT = 220;
export const MIN_NOTE_WIDTH = 180;
export const MIN_NOTE_HEIGHT = 150;
export const NOTE_REACTIONS = ["👍", "❤️", "👏"] as const;
export type NoteReaction = (typeof NOTE_REACTIONS)[number] | "";

export type Note = {
	id: string;
	title: string;
	body: string;
	tag: string;
	link: string;
	imageDataUrl: string;
	imageFit: "cover" | "contain";
	imageNaturalWidth: number;
	imageNaturalHeight: number;
	reactionEmoji: NoteReaction;
	x: number;
	y: number;
	width: number;
	height: number;
	color: string;
};

export const seedNotes: Note[] = [
	{
		id: "seed-1",
		title: "Project ideas",
		body: "- Add search\n- Add tags\n- Add markdown support",
		tag: "planning",
		link: "",
		imageDataUrl: "",
		imageFit: "cover",
		imageNaturalWidth: 0,
		imageNaturalHeight: 0,
		reactionEmoji: "",
		x: 60,
		y: 60,
		width: DEFAULT_NOTE_WIDTH,
		height: DEFAULT_NOTE_HEIGHT,
		color: NOTE_COLORS[0],
	},
	{
		id: "seed-2",
		title: "Today",
		body: "Drag and resize notes on this board.",
		tag: "daily",
		link: "",
		imageDataUrl: "",
		imageFit: "cover",
		imageNaturalWidth: 0,
		imageNaturalHeight: 0,
		reactionEmoji: "",
		x: 370,
		y: 170,
		width: DEFAULT_NOTE_WIDTH,
		height: DEFAULT_NOTE_HEIGHT,
		color: NOTE_COLORS[1],
	},
];

export function sanitizeNotes(input: unknown): Note[] {
	if (!Array.isArray(input)) {
		return [];
	}
	return input
		.map((item) => {
			if (!item || typeof item !== "object") {
				return null;
			}
			const note = item as Partial<Note>;
			if (typeof note.id !== "string") {
				return null;
			}
			return {
				id: note.id,
				title: typeof note.title === "string" ? note.title : "",
				body: typeof note.body === "string" ? note.body : "",
				tag: typeof note.tag === "string" ? note.tag : "",
				link: typeof note.link === "string" ? note.link : "",
				imageDataUrl:
					typeof note.imageDataUrl === "string" ? note.imageDataUrl : "",
				imageFit: note.imageFit === "contain" ? "contain" : "cover",
				imageNaturalWidth:
					typeof note.imageNaturalWidth === "number"
						? Math.max(0, note.imageNaturalWidth)
						: 0,
				imageNaturalHeight:
					typeof note.imageNaturalHeight === "number"
						? Math.max(0, note.imageNaturalHeight)
						: 0,
				reactionEmoji:
					typeof note.reactionEmoji === "string" &&
					NOTE_REACTIONS.includes(note.reactionEmoji as NoteReaction)
						? (note.reactionEmoji as NoteReaction)
						: "",
				x: typeof note.x === "number" ? note.x : 0,
				y: typeof note.y === "number" ? note.y : 0,
				width:
					typeof note.width === "number"
						? clamp(note.width, MIN_NOTE_WIDTH, 640)
						: DEFAULT_NOTE_WIDTH,
				height:
					typeof note.height === "number"
						? clamp(note.height, MIN_NOTE_HEIGHT, 640)
						: DEFAULT_NOTE_HEIGHT,
				color:
					typeof note.color === "string" && NOTE_COLORS.includes(note.color)
						? note.color
						: NOTE_COLORS[0],
			};
		})
		.filter((note): note is Note => note !== null);
}

export function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function roleBadgeClassName(role: "owner" | "editor" | "viewer") {
	if (role === "owner") {
		return "border border-amber-500/50 bg-amber-500/10 text-amber-200";
	}
	if (role === "editor") {
		return "border border-sky-500/50 bg-sky-500/10 text-sky-200";
	}
	return "border border-slate-500/50 bg-slate-500/10 text-slate-200";
}

export function toSafeLink(value: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		return "#";
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}
	return `https://${trimmed}`;
}
