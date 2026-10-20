import { apiUrl, fetchJSON } from "./core.js";

// Leaderboard catalogue, mirrored from relay/src/leaderboards.ts (leaderboardMetrics).
// The economy category (Bazaar profit, net worth, purse, bank) is intentionally absent: the queued
// mod update removes the economy sharing category. See docs/api-contract.md, "Leaderboards".
export const CATEGORIES = [
  { id: "dungeons", label: "Dungeons", metrics: ["dungeon_runs", "dungeon_profit", "dungeon_run_time"] },
  { id: "rng", label: "RNG", metrics: ["rng_drops"] },
  { id: "other", label: "Other", metrics: ["completed_tasks"] },
];
export const METRICS = {
  dungeon_runs: { category: "dungeons", label: "Recorded dungeon completions", short: "Runs", unit: "runs", aggregation: "event-sum",
    description: "New timestamped completed-run records; legacy aggregate totals are excluded." },
  dungeon_profit: { category: "dungeons", label: "Estimated recorded dungeon profit", short: "Profit", unit: "coins", aggregation: "event-sum",
    description: "Sum of newly recorded chest profit estimates, including losses; legacy aggregate totals are excluded." },
  dungeon_run_time: { category: "dungeons", label: "Average Run Time", short: "Avg time", unit: "milliseconds", aggregation: "event-average",
    description: "Average newly completed timed runs across all floors. Unknown start times and historical totals are excluded. Faster times rank first." },
  rng_drops: { category: "rng", label: "Supported reported RNG drops", short: "Drops", unit: "drops", aggregation: "event-sum",
    description: "Count of newly accepted supported community drop reports; not official drop probability or every Hypixel drop." },
  completed_tasks: { category: "other", label: "Completed tasks", short: "Tasks", unit: "tasks", aggregation: "event-sum", available: false,
    description: "Would require timestamped completed-task records.",
    reason: "No reliable completed-task publisher exists. This metric is unavailable until genuine completion records are collected." },
};
export const PERIODS = [
  { id: "all-time", label: "All time" },
  { id: "weekly", label: "This week (UTC, from Monday)" },
  { id: "monthly", label: "This month (UTC)" },
];
export const SOURCE = "Explicitly shared client observations; API-derived client snapshots remain unverified; coin valuations are estimates";
export const COVERAGE = "Consenting SkyMyce participants only; each Minecraft identity is ranked separately; this is not all Hypixel players";

/** Same period boundaries as the relay's utcPeriodStart. */
export function periodStart(period, now = Date.now()) {
  if (period === "all-time") return null;
  const d = new Date(now);
  if (period === "monthly") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return midnight - ((d.getUTCDay() + 6) % 7) * 86400000;
}

/** NEW public read endpoint (docs/api-contract.md 4.1); same LeaderboardResult shape as /community/leaderboard. */
export const fetchLeaderboard = query => fetchJSON(apiUrl(`/community/public/leaderboard?${new URLSearchParams(query)}`));
