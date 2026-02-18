import { Minus, Plus, RotateCcw } from "lucide-react";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 3;

type ZoomControlsProps = {
	zoom: number;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onReset: () => void;
};

export default function ZoomControls({
	zoom,
	onZoomIn,
	onZoomOut,
	onReset,
}: ZoomControlsProps) {
	return (
		<div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 backdrop-blur-sm px-1 py-1 shadow-lg">
			<button
				type="button"
				onClick={onZoomOut}
				disabled={zoom <= MIN_ZOOM}
				className="p-1.5 rounded text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
				aria-label="Zoom out"
			>
				<Minus className="w-4 h-4" />
			</button>
			<span className="text-xs text-slate-300 w-12 text-center select-none tabular-nums">
				{Math.round(zoom * 100)}%
			</span>
			<button
				type="button"
				onClick={onZoomIn}
				disabled={zoom >= MAX_ZOOM}
				className="p-1.5 rounded text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
				aria-label="Zoom in"
			>
				<Plus className="w-4 h-4" />
			</button>
			<div className="w-px h-5 bg-slate-700 mx-0.5" />
			<button
				type="button"
				onClick={onReset}
				className="p-1.5 rounded text-slate-300 hover:bg-slate-800 hover:text-slate-100"
				aria-label="Reset zoom"
			>
				<RotateCcw className="w-3.5 h-3.5" />
			</button>
		</div>
	);
}
