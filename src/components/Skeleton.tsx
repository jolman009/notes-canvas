export function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div className={`rounded-lg bg-slate-700/40 animate-pulse ${className}`} />
	);
}

export function BoardCardSkeleton() {
	return (
		<div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
			<Skeleton className="h-5 w-3/5 mb-3" />
			<Skeleton className="h-3 w-2/5" />
		</div>
	);
}

export function BoardPageSkeleton() {
	return (
		<main className="h-[calc(100vh-4rem)] bg-slate-950 text-slate-100">
			<section className="h-full p-4 md:p-6 flex flex-col gap-4">
				<div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
					<div className="flex items-center justify-between gap-4">
						<div>
							<Skeleton className="h-6 w-48 mb-2" />
							<Skeleton className="h-4 w-32" />
						</div>
						<div className="flex items-center gap-3">
							<Skeleton className="h-8 w-20 rounded-lg" />
							<Skeleton className="h-10 w-28 rounded-lg" />
						</div>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<Skeleton className="h-10 rounded-lg" />
						<Skeleton className="h-10 rounded-lg" />
						<Skeleton className="h-10 rounded-lg" />
					</div>
				</div>
				<div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
					<div className="rounded-2xl border border-slate-700 bg-slate-900/85 p-4 flex flex-col gap-3">
						<Skeleton className="h-4 w-24 mb-1" />
						<Skeleton className="h-3 w-44" />
						<Skeleton className="h-24 rounded-xl" />
					</div>
					<div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-6">
						<div className="flex gap-4 flex-wrap">
							<Skeleton className="h-40 w-60 rounded-xl" />
							<Skeleton className="h-40 w-60 rounded-xl" />
							<Skeleton className="h-40 w-60 rounded-xl" />
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}
