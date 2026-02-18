import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
	open: boolean;
	title: string;
	description?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "default" | "destructive";
	promptMode?: boolean;
	promptPlaceholder?: string;
	promptValidation?: string;
	onConfirm: (promptValue?: string) => void;
	onCancel: () => void;
};

export default function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	variant = "default",
	promptMode = false,
	promptPlaceholder = "",
	promptValidation,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const [promptValue, setPromptValue] = useState("");
	const cancelRef = useRef<HTMLButtonElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!open) {
			setPromptValue("");
			return;
		}
		if (promptMode) {
			inputRef.current?.focus();
		} else {
			cancelRef.current?.focus();
		}
	}, [open, promptMode]);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onCancel();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, onCancel]);

	if (!open) return null;

	const confirmDisabled =
		promptMode && promptValidation != null && promptValue !== promptValidation;

	const confirmButtonClass =
		variant === "destructive"
			? "bg-rose-600 text-white hover:bg-rose-500"
			: "bg-amber-400 text-slate-900 hover:bg-amber-300";

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div
				className="absolute inset-0 bg-black/60"
				onClick={onCancel}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") onCancel();
				}}
			/>
			<div className="relative z-10 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
				<h2 className="text-lg font-semibold text-slate-100">{title}</h2>
				{description ? (
					<p className="mt-2 text-sm text-slate-400">{description}</p>
				) : null}
				{promptMode ? (
					<input
						ref={inputRef}
						value={promptValue}
						onChange={(e) => setPromptValue(e.target.value)}
						placeholder={promptPlaceholder}
						className="mt-3 w-full h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-slate-500"
					/>
				) : null}
				<div className="mt-5 flex items-center justify-end gap-3">
					<button
						ref={cancelRef}
						type="button"
						onClick={onCancel}
						className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
					>
						{cancelLabel}
					</button>
					<button
						type="button"
						onClick={() => onConfirm(promptMode ? promptValue : undefined)}
						disabled={confirmDisabled}
						className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${confirmButtonClass}`}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
