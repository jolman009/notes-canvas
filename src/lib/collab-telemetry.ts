const LATENCY_WINDOW_SIZE = 50;

export type CollabMetrics = {
	reconnectCount: number;
	conflictCount: number;
	mergeConflictCount: number;
	broadcastSendCount: number;
	broadcastReceiveCount: number;
	saveLatencyMs: number[];
};

export type MetricsSummary = {
	reconnectCount: number;
	conflictCount: number;
	mergeConflictCount: number;
	broadcastSendCount: number;
	broadcastReceiveCount: number;
	avgSaveLatencyMs: number;
	p95SaveLatencyMs: number;
	totalSaves: number;
};

let metrics: CollabMetrics = {
	reconnectCount: 0,
	conflictCount: 0,
	mergeConflictCount: 0,
	broadcastSendCount: 0,
	broadcastReceiveCount: 0,
	saveLatencyMs: [],
};

export function recordSaveLatency(ms: number) {
	metrics.saveLatencyMs.push(ms);
	if (metrics.saveLatencyMs.length > LATENCY_WINDOW_SIZE) {
		metrics.saveLatencyMs = metrics.saveLatencyMs.slice(-LATENCY_WINDOW_SIZE);
	}
}

export function recordReconnect() {
	metrics.reconnectCount++;
}

export function recordConflict() {
	metrics.conflictCount++;
}

export function recordMergeConflict() {
	metrics.mergeConflictCount++;
}

export function recordBroadcastSend() {
	metrics.broadcastSendCount++;
}

export function recordBroadcastReceive() {
	metrics.broadcastReceiveCount++;
}

export function getMetricsSummary(): MetricsSummary {
	const latencies = metrics.saveLatencyMs;
	const totalSaves = latencies.length;
	const avg =
		totalSaves > 0 ? latencies.reduce((sum, v) => sum + v, 0) / totalSaves : 0;
	const sorted = [...latencies].sort((a, b) => a - b);
	const p95Index = Math.min(
		Math.floor(sorted.length * 0.95),
		sorted.length - 1,
	);
	const p95 = sorted.length > 0 ? sorted[p95Index] : 0;

	return {
		reconnectCount: metrics.reconnectCount,
		conflictCount: metrics.conflictCount,
		mergeConflictCount: metrics.mergeConflictCount,
		broadcastSendCount: metrics.broadcastSendCount,
		broadcastReceiveCount: metrics.broadcastReceiveCount,
		avgSaveLatencyMs: Math.round(avg),
		p95SaveLatencyMs: Math.round(p95),
		totalSaves,
	};
}

export function resetMetrics() {
	metrics = {
		reconnectCount: 0,
		conflictCount: 0,
		mergeConflictCount: 0,
		broadcastSendCount: 0,
		broadcastReceiveCount: 0,
		saveLatencyMs: [],
	};
}

export function logMetricsOnTeardown() {
	const summary = getMetricsSummary();
	console.log("[collab-telemetry] Session metrics:", summary);
}
