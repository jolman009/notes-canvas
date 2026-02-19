import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	getStoredSession,
	isSessionValid,
	setStoredSession,
} from "@/lib/auth-session";
import { signInWithEmailServer } from "@/server/auth-fns";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (isSessionValid(getStoredSession())) {
			void navigate({ to: "/boards" });
		}
	}, [navigate]);

	const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		setIsSubmitting(true);
		try {
			const result = await signInWithEmailServer({
				data: { email, password },
			});
			if (!result.ok) {
				setError(result.message);
				return;
			}
			if (!result.session) {
				setError(
					result.message || "No active session returned. Please try again.",
				);
				return;
			}
			setStoredSession(result.session);
			await navigate({ to: "/boards" });
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<main className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center p-4">
			<div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6">
				<h1 className="text-2xl font-semibold">Log in</h1>
				<p className="text-sm text-slate-400 mt-1">
					Sign in with your email and password.
				</p>
				<form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
					<input
						type="email"
						required
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						placeholder="Email"
						aria-label="Email address"
						className="h-11 rounded-lg bg-slate-950 border border-slate-700 px-3 outline-none focus:border-slate-500"
					/>
					<input
						type="password"
						required
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						placeholder="Password"
						aria-label="Password"
						className="h-11 rounded-lg bg-slate-950 border border-slate-700 px-3 outline-none focus:border-slate-500"
					/>
					{error ? (
						<p className="text-sm text-rose-300" role="alert">
							{error}
						</p>
					) : null}
					<button
						type="submit"
						disabled={isSubmitting}
						className="h-11 rounded-lg bg-amber-400 text-slate-900 font-semibold disabled:opacity-60"
					>
						{isSubmitting ? "Logging in..." : "Log in"}
					</button>
				</form>
				<p className="text-sm text-slate-400 mt-4">
					Need an account?{" "}
					<Link to="/signup" className="text-amber-300 underline">
						Sign up
					</Link>
				</p>
			</div>
		</main>
	);
}
