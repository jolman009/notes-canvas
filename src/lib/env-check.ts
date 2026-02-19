export function checkEnv() {
	const env = (import.meta as unknown as { env?: Record<string, string> }).env;
	if (!env) {
		console.warn("[env-check] import.meta.env not available.");
		return;
	}

	const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY"] as const;
	const optional = ["VITE_SENTRY_DSN"] as const;

	for (const key of required) {
		if (!env[key]) {
			console.error(`[env-check] Missing required env var: ${key}`);
		}
	}

	for (const key of optional) {
		if (!env[key]) {
			console.info(`[env-check] Optional env var not set: ${key}`);
		}
	}
}
