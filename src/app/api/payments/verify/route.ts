import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getPlanById, isRazorpayConfigured, getRazorpayKeySecret, getPremiumDurationMs, PlanId } from "@/lib/payments";
import { checkRateLimit, getClientIp, getRateLimitConfig } from "@/lib/rateLimiter";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`verify:${ip}`, getRateLimitConfig("moderate"));
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }
    if (!isRazorpayConfigured()) {
      return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, planId, userId } = await request.json();

    const missing: string[] = [];
    if (!razorpay_payment_id || typeof razorpay_payment_id !== "string") missing.push("razorpay_payment_id");
    if (!razorpay_order_id || typeof razorpay_order_id !== "string") missing.push("razorpay_order_id");
    if (!razorpay_signature || typeof razorpay_signature !== "string") missing.push("razorpay_signature");
    if (!planId || typeof planId !== "string" || !["monthly", "yearly"].includes(planId)) missing.push("planId");
    if (!userId || typeof userId !== "string" || userId.length < 5) missing.push("userId");
    if (missing.length) {
      return NextResponse.json({ error: `Invalid or missing: ${missing.join(", ")}` }, { status: 400 });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", getRazorpayKeySecret())
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + getPremiumDurationMs(planId as PlanId)).toISOString();

    return NextResponse.json({
      verified: true,
      premium_expires_at: expiresAt,
      plan_id: planId,
    });
  } catch (err: any) {
    console.error("[Payments] Verify error:", err);
    return NextResponse.json(
      { error: "Payment verification failed. Please contact support." },
      { status: 500 }
    );
  }
}
