type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs?: number;
}

const DEFAULTS = {
  strict: { windowMs: 60_000, maxRequests: 10, blockDurationMs: 300_000 },
  moderate: { windowMs: 60_000, maxRequests: 30, blockDurationMs: 120_000 },
  loose: { windowMs: 60_000, maxRequests: 60, blockDurationMs: 60_000 },
} as const;

export function getRateLimitConfig(tier: keyof typeof DEFAULTS): RateLimitConfig {
  return { ...DEFAULTS[tier] };
}

export function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs + (config.blockDurationMs || 0) });
    return { allowed: true, retryAfterMs: 0 };
  }

  entry.count++;
  if (entry.count > config.maxRequests) {
    const retryAfterMs = entry.resetAt - now;
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true, retryAfterMs: 0 };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "127.0.0.1";
}
