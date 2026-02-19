export function initSentry() {
	const dsn =
		typeof import.meta !== "undefined"
			? (import.meta as unknown as { env?: Record<string, string> }).env
					?.VITE_SENTRY_DSN
			: undefined;

	if (!dsn) {
		console.info("[Sentry] No DSN configured — error tracking disabled.");
		return;
	}

	import("@sentry/react")
		.then((Sentry) => {
			Sentry.init({
				dsn,
				tracesSampleRate: 0.1,
				environment:
					(import.meta as unknown as { env?: Record<string, string> }).env
						?.MODE ?? "production",
			});
			// Expose for ErrorBoundary
			(globalThis as Record<string, unknown>).__SENTRY__ = Sentry;
			console.info("[Sentry] Initialized.");
		})
		.catch((err) => {
			console.warn("[Sentry] Failed to load:", err);
		});
}
