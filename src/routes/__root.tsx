import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import ErrorBoundary from "../components/ErrorBoundary";
import Header from "../components/Header";
import { ToastProvider } from "../components/Toast";
import { checkEnv } from "../lib/env-check";
import { initSentry } from "../lib/sentry";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Canvas Notes",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	notFoundComponent: NotFoundPage,
	shellComponent: RootDocument,
});

function NotFoundPage() {
	return (
		<main className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center p-4">
			<div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
				<h1 className="text-2xl font-semibold">Page not found</h1>
				<p className="mt-2 text-sm text-slate-400">
					This link may be invalid or expired.
				</p>
				<div className="mt-5 flex items-center justify-center gap-3">
					<Link
						to="/boards"
						className="inline-flex items-center rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900"
					>
						Go to boards
					</Link>
					<Link
						to="/login"
						className="inline-flex items-center rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
					>
						Log in
					</Link>
				</div>
			</div>
		</main>
	);
}

let initialized = false;

function RootDocument({ children }: { children: React.ReactNode }) {
	if (typeof window !== "undefined" && !initialized) {
		initialized = true;
		initSentry();
		checkEnv();
	}

	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<Header />
				<ErrorBoundary>
					<ToastProvider>{children}</ToastProvider>
				</ErrorBoundary>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
