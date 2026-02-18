import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getStoredSession, isSessionValid } from "@/lib/auth-session";

export const Route = createFileRoute("/")({
	component: HomeRedirect,
});

function HomeRedirect() {
	const navigate = useNavigate();

	useEffect(() => {
		const session = getStoredSession();
		if (isSessionValid(session)) {
			void navigate({ to: "/boards" });
			return;
		}
		void navigate({ to: "/login" });
	}, [navigate]);

	return (
		<main className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center">
			<p className="text-sm text-slate-400">Redirecting...</p>
		</main>
	);
}
