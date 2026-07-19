const USAGE_KEY = "acu_daily_usage";
const USAGE_LOG_KEY = "acu_usage_log";

interface DailyUsage {
  date: string;
  firestoreReads: number;
  firestoreWrites: number;
  aiGenerations: number;
}

export function trackUsage(type: "firestoreRead" | "firestoreWrite" | "aiGeneration"): void {
  if (typeof window === "undefined") return;

  const today = new Date().toISOString().split("T")[0];
  const usage: DailyUsage = JSON.parse(localStorage.getItem(USAGE_KEY) || "null") || {
    date: today,
    firestoreReads: 0,
    firestoreWrites: 0,
    aiGenerations: 0,
  };

  if (usage.date !== today) {
    logUsage(usage);
    usage.date = today;
    usage.firestoreReads = 0;
    usage.firestoreWrites = 0;
    usage.aiGenerations = 0;
  }

  if (type === "firestoreRead") usage.firestoreReads++;
  if (type === "firestoreWrite") usage.firestoreWrites++;
  if (type === "aiGeneration") usage.aiGenerations++;

  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}

function logUsage(usage: DailyUsage): void {
  const log = JSON.parse(localStorage.getItem(USAGE_LOG_KEY) || "[]");
  log.push(usage);
  if (log.length > 90) log.shift();
  localStorage.setItem(USAGE_LOG_KEY, JSON.stringify(log));

  console.log(`[Acu Usage] ${usage.date}: ${usage.firestoreReads} reads, ${usage.firestoreWrites} writes, ${usage.aiGenerations} AI calls`);
}

export function checkUsageWarning(): string | null {
  const warningThreshold = process.env.NEXT_PUBLIC_FIREBASE_USAGE_WARNING;
  if (!warningThreshold) return null;

  const usage: DailyUsage = JSON.parse(localStorage.getItem(USAGE_KEY) || "null");
  if (!usage) return null;

  const threshold = parseInt(warningThreshold, 10);
  const total = usage.firestoreReads + usage.firestoreWrites;

  if (total > threshold * 0.9) {
    return `Firebase usage is at ${total} operations today (${Math.round((total / threshold) * 100)}% of ${threshold} warning threshold).`;
  }

  return null;
}

export const FIREBASE_TIER_LIMITS = {
  spark: { readsPerDay: 50000, writesPerDay: 20000, storageGB: 1 },
  blaze: { readsPerDay: "pay-as-you-go", writesPerDay: "pay-as-you-go", storageGB: "pay-as-you-go" },
} as const;

export function getMaxUsersPerTier(avgReadsPerUserPerDay: number = 50): { spark: number; blaze: string } {
  return {
    spark: Math.floor(FIREBASE_TIER_LIMITS.spark.readsPerDay / avgReadsPerUserPerDay),
    blaze: "Unlimited (pay per operation)",
  };
}
