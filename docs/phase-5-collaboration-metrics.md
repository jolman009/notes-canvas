# Phase 5 — Collaboration Metrics

## Metric Definitions

| Metric | Type | Description |
|--------|------|-------------|
| `totalSaves` | Counter | Number of successful save operations in this session |
| `avgSaveLatencyMs` | Gauge | Average round-trip time for save operations (rolling window of 50) |
| `p95SaveLatencyMs` | Gauge | 95th percentile save latency (rolling window of 50) |
| `reconnectCount` | Counter | Number of realtime channel reconnection attempts |
| `conflictCount` | Counter | Number of revision-level save conflicts (server-side) |
| `mergeConflictCount` | Counter | Number of note-level merge conflicts (client-side three-way merge) |
| `broadcastSendCount` | Counter | Number of editing activity broadcasts sent |
| `broadcastReceiveCount` | Counter | Number of editing activity broadcasts received from other users |

## Where Metrics Are Displayed
- **Settings drawer** > "Collaboration Health" section — real-time view of current session metrics
- **Browser console** — full metrics summary logged on component teardown (page navigation)

## Alert Thresholds (Recommended)

| Metric | Warning | Critical |
|--------|---------|----------|
| `avgSaveLatencyMs` | > 2000ms | > 5000ms |
| `p95SaveLatencyMs` | > 5000ms | > 10000ms |
| `conflictCount` per session | > 5 | > 15 |
| `mergeConflictCount` per session | > 3 | > 10 |
| `reconnectCount` per session | > 5 | > 15 |

## Future Enhancements
- Server-side metric aggregation via API endpoint
- Dashboard with per-board collaboration health scores
- Alerting integration (email, Slack) for critical thresholds
- Histogram visualization of save latency distribution
