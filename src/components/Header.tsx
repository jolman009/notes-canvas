import { Link, useRouterState } from "@tanstack/react-router";
import { StickyNote } from "lucide-react";
import { useEffect, useState } from "react";
import { getStoredSession, isSessionValid } from "@/lib/auth-session";

export default function Header() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const [displayName, setDisplayName] = useState("");

	useEffect(() => {
		const session = getStoredSession();
		if (!isSessionValid(session)) {
			setDisplayName("");
			return;
		}
		setDisplayName(session.user.name || session.user.email);
	}, [pathname]);

	return (
		<header className="h-16 px-6 flex items-center justify-between bg-slate-900/95 text-slate-100 border-b border-slate-700/80">
			<Link to="/boards" className="flex items-center gap-2">
				<StickyNote className="w-5 h-5 text-amber-300" />
				<span className="text-lg font-semibold tracking-tight">
					Canvas Notes
				</span>
			</Link>
			<span className="text-sm text-slate-400">
				{displayName ? `Signed in as ${displayName}` : "Guest"}
			</span>
		</header>
	);
}
