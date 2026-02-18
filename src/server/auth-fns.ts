import { createServerFn } from "@tanstack/react-start";

type AuthResult =
	| {
			ok: true;
			session?: {
				accessToken: string;
				refreshToken: string;
				expiresAt: number;
				user: {
					id: string;
					email: string;
					name?: string;
				};
			};
			message?: string;
	  }
	| {
			ok: false;
			message: string;
	  };

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID;
const SUPABASE_URL =
	process.env.SUPABASE_URL ||
	(SUPABASE_PROJECT_ID ? `https://${SUPABASE_PROJECT_ID}.supabase.co` : "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

export const signInWithEmailServer = createServerFn({ method: "POST" })
	.inputValidator((input: { email: string; password: string }) => ({
		email: String(input.email || "")
			.trim()
			.toLowerCase(),
		password: String(input.password || ""),
	}))
	.handler(async ({ data }) => {
		const result = await runSupabaseAuth(
			"/auth/v1/token?grant_type=password",
			data,
			true,
		);
		if (result.ok && result.session) {
			await upsertUserProfile(
				result.session.accessToken,
				result.session.user.id,
				result.session.user.name || "",
			);
		}
		return result;
	});

export const signUpWithEmailServer = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { email: string; password: string; name?: string }) => ({
			email: String(input.email || "")
				.trim()
				.toLowerCase(),
			password: String(input.password || ""),
			name: String(input.name || "").trim(),
		}),
	)
	.handler(async ({ data }) => {
		const result = await runSupabaseAuth(
			"/auth/v1/signup",
			{
				email: data.email,
				password: data.password,
				data: data.name ? { full_name: data.name, name: data.name } : undefined,
			},
			false,
		);
		if (result.ok && result.session) {
			await upsertUserProfile(
				result.session.accessToken,
				result.session.user.id,
				result.session.user.name || "",
			);
		}
		return result;
	});

async function runSupabaseAuth(
	path: string,
	payload: { email: string; password: string; data?: Record<string, string> },
	requireSession: boolean,
): Promise<AuthResult> {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
		return {
			ok: false,
			message: "Supabase auth is not configured on the server.",
		};
	}
	if (!payload.email || !payload.password) {
		return { ok: false, message: "Email and password are required." };
	}

	const response = await fetch(`${SUPABASE_URL}${path}`, {
		method: "POST",
		headers: {
			apikey: SUPABASE_ANON_KEY,
			Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	const body = (await response.json().catch(() => ({}))) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
		user?: {
			id?: string;
			email?: string;
			user_metadata?: {
				full_name?: string;
				name?: string;
			};
		};
		msg?: string;
		error_description?: string;
		error?: string;
	};

	if (!response.ok) {
		return {
			ok: false,
			message:
				body.msg ||
				body.error_description ||
				body.error ||
				`Auth failed with status ${response.status}.`,
		};
	}

	if (
		!body.access_token ||
		!body.refresh_token ||
		!body.user?.id ||
		!body.user?.email
	) {
		if (!requireSession) {
			return {
				ok: true,
				message:
					"Account created. Check your email to confirm your account, then log in.",
			};
		}
		return {
			ok: false,
			message:
				"Signup created an account but no session was returned. Check your email confirmation settings.",
		};
	}

	return {
		ok: true,
		session: {
			accessToken: body.access_token,
			refreshToken: body.refresh_token,
			expiresAt: Date.now() + (body.expires_in || 3600) * 1000,
			user: {
				id: body.user.id,
				email: body.user.email,
				name: extractUserName(body.user.user_metadata),
			},
		},
	};
}

function extractUserName(metadata?: { full_name?: string; name?: string }) {
	if (!metadata) {
		return undefined;
	}
	return metadata.full_name || metadata.name || undefined;
}

async function upsertUserProfile(
	accessToken: string,
	userId: string,
	displayName: string,
) {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
	try {
		await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
			method: "POST",
			headers: {
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				Prefer: "resolution=merge-duplicates",
			},
			body: JSON.stringify({
				user_id: userId,
				display_name: displayName,
			}),
		});
	} catch {
		// Non-critical: database trigger should handle profile creation
	}
}
