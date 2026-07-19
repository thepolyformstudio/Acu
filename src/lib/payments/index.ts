export const PLANS = {
  monthly: { amount: 9900, currency: "INR", description: "Acu Premium Monthly", period: "monthly" },
  yearly: { amount: 49900, currency: "INR", description: "Acu Premium Annual", period: "yearly" },
} as const;

export type PlanId = keyof typeof PLANS;

export function getPlanById(planId: string) {
  const plan = PLANS[planId as PlanId];
  if (!plan) throw new Error(`Unknown plan: ${planId}`);
  return plan;
}

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export function isRazorpayConfigured(): boolean {
  return !!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && RAZORPAY_KEY_ID.startsWith("rzp_"));
}

export function getRazorpayKeyId(): string {
  return RAZORPAY_KEY_ID || "";
}

export function getRazorpayKeySecret(): string {
  return RAZORPAY_KEY_SECRET || "";
}

export function getPremiumDurationMs(planId: PlanId): number {
  return planId === "yearly"
    ? 365 * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;
}
