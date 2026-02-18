import { X } from "lucide-react";
import {
	createContext,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

type ToastType = "info" | "success" | "warning" | "error" | "conflict";

type ToastAction = {
	label: string;
	onClick: () => void;
};

type Toast = {
	id: string;
	type: ToastType;
	message: string;
	actions?: ToastAction[];
};

type ToastContextValue = {
	addToast: (
		type: ToastType,
		message: string,
		actions?: ToastAction[],
	) => string;
	removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS: Record<ToastType, number | null> = {
	info: 5000,
	success: 5000,
	warning: 8000,
	error: 8000,
	conflict: null,
};

const TYPE_STYLES: Record<ToastType, string> = {
	info: "border-sky-600/60 bg-slate-900/95 text-sky-200",
	success: "border-emerald-600/60 bg-slate-900/95 text-emerald-200",
	warning: "border-amber-600/60 bg-slate-900/95 text-amber-200",
	error: "border-rose-600/60 bg-slate-900/95 text-rose-200",
	conflict: "border-amber-600/70 bg-slate-900/95 text-amber-200",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
		const timer = timersRef.current.get(id);
		if (timer) {
			clearTimeout(timer);
			timersRef.current.delete(id);
		}
	}, []);

	const addToast = useCallback(
		(type: ToastType, message: string, actions?: ToastAction[]) => {
			const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
			setToasts((prev) => [...prev, { id, type, message, actions }]);
			const dismissMs = AUTO_DISMISS_MS[type];
			if (dismissMs != null) {
				const timer = setTimeout(() => {
					removeToast(id);
				}, dismissMs);
				timersRef.current.set(id, timer);
			}
			return id;
		},
		[removeToast],
	);

	return (
		<ToastContext.Provider value={{ addToast, removeToast }}>
			{children}
			{typeof document !== "undefined"
				? createPortal(
						<div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2 max-w-md">
							{toasts.map((toast) => (
								<div
									key={toast.id}
									className={`rounded-lg border px-4 py-3 text-sm shadow-2xl flex items-start gap-3 ${TYPE_STYLES[toast.type]}`}
								>
									<div className="flex-1">
										<p>{toast.message}</p>
										{toast.actions && toast.actions.length > 0 ? (
											<div className="mt-2 flex flex-wrap items-center gap-2">
												{toast.actions.map((action) => (
													<button
														key={action.label}
														type="button"
														onClick={action.onClick}
														className="rounded border border-current/30 px-3 py-1 text-xs hover:bg-white/10"
													>
														{action.label}
													</button>
												))}
											</div>
										) : null}
									</div>
									<button
										type="button"
										onClick={() => removeToast(toast.id)}
										className="shrink-0 p-0.5 rounded hover:bg-white/10"
										aria-label="Dismiss"
									>
										<X className="w-4 h-4" />
									</button>
								</div>
							))}
						</div>,
						document.body,
					)
				: null}
		</ToastContext.Provider>
	);
}

export function useToast() {
	const ctx = useContext(ToastContext);
	if (!ctx) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return ctx;
}
