import type * as SentryType from "@sentry/react";

let Sentry: typeof SentryType | null = null;

export function getSentry() {
	return Sentry;
}

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
		.then((mod) => {
			mod.init({
				dsn,
				tracesSampleRate: 0.1,
				environment:
					(import.meta as unknown as { env?: Record<string, string> }).env
						?.MODE ?? "production",
			});
			Sentry = mod;
			console.info("[Sentry] Initialized.");
		})
		.catch((err) => {
			console.warn("[Sentry] Failed to load:", err);
		});
}
