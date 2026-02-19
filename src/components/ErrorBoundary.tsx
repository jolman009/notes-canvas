import { Component, type ErrorInfo, type ReactNode } from "react";
import { getSentry } from "../lib/sentry";

type ErrorBoundaryProps = {
	children: ReactNode;
};

type ErrorBoundaryState = {
	hasError: boolean;
	error: Error | null;
};

export default class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("[ErrorBoundary]", error, errorInfo);
		const Sentry = getSentry();
		if (Sentry) {
			Sentry.captureException(error, {
				extra: { componentStack: errorInfo.componentStack },
			});
		}
	}

	render() {
		if (this.state.hasError) {
			return (
				<main className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center p-4">
					<div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
						<h1 className="text-2xl font-semibold text-rose-300">
							Something went wrong
						</h1>
						<p className="mt-2 text-sm text-slate-400">
							{this.state.error?.message || "An unexpected error occurred."}
						</p>
						<div className="mt-5 flex items-center justify-center gap-3">
							<button
								type="button"
								onClick={() => window.location.reload()}
								className="inline-flex items-center rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900"
							>
								Reload page
							</button>
							<a
								href="/boards"
								className="inline-flex items-center rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
							>
								Go to boards
							</a>
						</div>
					</div>
				</main>
			);
		}
		return this.props.children;
	}
}
