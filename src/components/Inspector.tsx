import { useId, useState } from "react";
import {
	NOTE_COLOR_LABELS,
	NOTE_COLORS,
	NOTE_REACTIONS,
	type Note,
	toSafeLink,
} from "@/lib/notes";

type InspectorProps = {
	selectedNote: Note | null;
	onUpdateNote: (
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
	) => void;
	onUpdateNoteImage: (id: string, file: File | null) => void;
	onFitNoteToImage: (id: string) => void;
	onRemoveNoteImage: (id: string) => void;
	onRemoveNote: (id: string) => void;
	className?: string;
};

const TABS = ["content", "media", "link", "style"] as const;
type InspectorTab = (typeof TABS)[number];

export default function Inspector({
	selectedNote,
	onUpdateNote,
	onUpdateNoteImage,
	onFitNoteToImage,
	onRemoveNoteImage,
	onRemoveNote,
	className,
}: InspectorProps) {
	const [inspectorTab, setInspectorTab] = useState<InspectorTab>("content");
	const tabId = useId();

	return (
		<aside
			className={`rounded-2xl border border-slate-700 bg-slate-900/85 p-4 flex flex-col gap-3 overflow-y-auto ${className ?? ""}`}
		>
			<div>
				<h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
					Inspector
				</h3>
				<p className="text-xs text-slate-500 mt-1">
					Select a note to edit details in one place.
				</p>
			</div>
			{!selectedNote ? (
				<div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
					No note selected.
				</div>
			) : (
				<>
					<div
						role="tablist"
						aria-label="Inspector tabs"
						className="grid grid-cols-2 gap-2 rounded-lg bg-slate-950/70 p-1"
					>
						{TABS.map((tab) => (
							<button
								key={tab}
								type="button"
								role="tab"
								aria-selected={inspectorTab === tab}
								aria-controls={`${tabId}-panel-${tab}`}
								id={`${tabId}-tab-${tab}`}
								onClick={() => setInspectorTab(tab)}
								className={`h-10 rounded text-xs capitalize ${
									inspectorTab === tab
										? "bg-slate-800 text-slate-100"
										: "text-slate-400 hover:bg-slate-900"
								}`}
							>
								{tab}
							</button>
						))}
					</div>
					<div
						role="tabpanel"
						id={`${tabId}-panel-${inspectorTab}`}
						aria-labelledby={`${tabId}-tab-${inspectorTab}`}
						className="flex flex-col gap-3"
					>
						{inspectorTab === "content" ? (
							<>
								<input
									value={selectedNote.title}
									onChange={(event) =>
										onUpdateNote(selectedNote.id, "title", event.target.value)
									}
									aria-label="Note title"
									className="h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm outline-none focus:border-slate-500"
									placeholder="Title"
								/>
								<textarea
									value={selectedNote.body}
									onChange={(event) =>
										onUpdateNote(selectedNote.id, "body", event.target.value)
									}
									aria-label="Note body"
									className="min-h-32 rounded-lg bg-slate-950 border border-slate-700 p-3 text-sm outline-none focus:border-slate-500 resize-y"
									placeholder="Write your note..."
								/>
								<input
									value={selectedNote.tag}
									onChange={(event) =>
										onUpdateNote(selectedNote.id, "tag", event.target.value)
									}
									aria-label="Note tag"
									className="h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm outline-none focus:border-slate-500"
									placeholder="Tag"
								/>
							</>
						) : null}
						{inspectorTab === "media" ? (
							<>
								<div className="flex items-center gap-2 flex-wrap">
									<label className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-950 cursor-pointer text-slate-200">
										Upload image
										<input
											type="file"
											accept="image/jpeg,image/gif,image/png,image/webp"
											className="hidden"
											onChange={(event) =>
												void onUpdateNoteImage(
													selectedNote.id,
													event.target.files?.[0] ?? null,
												)
											}
										/>
									</label>
									{selectedNote.imageDataUrl ? (
										<>
											<button
												type="button"
												className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-950 text-slate-200"
												onClick={() =>
													onUpdateNote(
														selectedNote.id,
														"imageFit",
														selectedNote.imageFit === "cover"
															? "contain"
															: "cover",
													)
												}
											>
												{selectedNote.imageFit === "cover"
													? "Contain"
													: "Cover"}
											</button>
											<button
												type="button"
												className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-950 text-slate-200"
												onClick={() => onFitNoteToImage(selectedNote.id)}
											>
												Fit note
											</button>
											<button
												type="button"
												className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-950 text-slate-200"
												onClick={() => onRemoveNoteImage(selectedNote.id)}
											>
												Remove image
											</button>
										</>
									) : null}
								</div>
								{selectedNote.imageDataUrl ? (
									<div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
										<img
											src={selectedNote.imageDataUrl}
											alt="Selected note attachment"
											className="w-full h-32 object-cover"
											style={{ objectFit: selectedNote.imageFit }}
										/>
									</div>
								) : (
									<p className="text-xs text-slate-500">No image attached.</p>
								)}
							</>
						) : null}
						{inspectorTab === "link" ? (
							<>
								<input
									value={selectedNote.link}
									onChange={(event) =>
										onUpdateNote(selectedNote.id, "link", event.target.value)
									}
									aria-label="Note link URL"
									className="h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm outline-none focus:border-slate-500"
									placeholder="https://example.com"
								/>
								{selectedNote.link.trim().length > 0 ? (
									<a
										href={toSafeLink(selectedNote.link)}
										target="_blank"
										rel="noreferrer noopener"
										className="text-xs text-amber-300 underline"
									>
										Open link
									</a>
								) : (
									<p className="text-xs text-slate-500">No link set.</p>
								)}
							</>
						) : null}
						{inspectorTab === "style" ? (
							<>
								<div className="flex items-center gap-2 flex-wrap">
									{NOTE_COLORS.map((color) => (
										<button
											key={`${selectedNote.id}-${color}`}
											type="button"
											onClick={() =>
												onUpdateNote(selectedNote.id, "color", color)
											}
											className={`h-8 w-8 rounded-full border ${
												selectedNote.color === color
													? "border-white"
													: "border-slate-700"
											}`}
											style={{ backgroundColor: color }}
											title={NOTE_COLOR_LABELS[color] || color}
											aria-label={`Set note color to ${NOTE_COLOR_LABELS[color] || color}`}
										/>
									))}
								</div>
								<div className="flex items-center gap-2 flex-wrap">
									{NOTE_REACTIONS.map((emoji) => (
										<button
											key={`${selectedNote.id}-reaction-${emoji}`}
											type="button"
											onClick={() =>
												onUpdateNote(
													selectedNote.id,
													"reactionEmoji",
													selectedNote.reactionEmoji === emoji ? "" : emoji,
												)
											}
											className={`h-8 min-w-8 rounded border px-2 text-sm ${
												selectedNote.reactionEmoji === emoji
													? "border-amber-400 bg-amber-400/10"
													: "border-slate-600 bg-slate-950"
											}`}
											aria-label={`Set reaction ${emoji}`}
										>
											{emoji}
										</button>
									))}
								</div>
							</>
						) : null}
					</div>
					<button
						type="button"
						onClick={() => onRemoveNote(selectedNote.id)}
						className="mt-2 inline-flex items-center justify-center rounded-lg border border-rose-600/70 px-3 py-2 text-sm text-rose-300 hover:bg-rose-950/40"
					>
						Delete note
					</button>
				</>
			)}
		</aside>
	);
}
