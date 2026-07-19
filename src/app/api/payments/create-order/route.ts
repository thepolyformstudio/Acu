import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getPlanById, isRazorpayConfigured, getRazorpayKeyId, getRazorpayKeySecret } from "@/lib/payments";
import { checkRateLimit, getClientIp, getRateLimitConfig } from "@/lib/rateLimiter";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`create-order:${ip}`, getRateLimitConfig("loose"));
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }
    if (!isRazorpayConfigured()) {
      return NextResponse.json(
        { error: "Razorpay not configured. Add NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env" },
        { status: 500 }
      );
    }

    const { planId, userId, userEmail } = await request.json();
    if (!planId || typeof planId !== "string" || !["monthly", "yearly"].includes(planId)) {
      return NextResponse.json({ error: "Invalid or missing planId. Must be 'monthly' or 'yearly'." }, { status: 400 });
    }
    if (!userId || typeof userId !== "string" || userId.length < 5 || userId.length > 200) {
      return NextResponse.json({ error: "Invalid or missing userId." }, { status: 400 });
    }
    if (!userEmail || typeof userEmail !== "string" || !userEmail.includes("@") || userEmail.length > 254) {
      return NextResponse.json({ error: "Invalid or missing userEmail." }, { status: 400 });
    }

    const plan = getPlanById(planId);

    const razorpay = new Razorpay({
      key_id: getRazorpayKeyId(),
      key_secret: getRazorpayKeySecret(),
    });

    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: plan.currency,
      receipt: `${userId}_${planId}_${Date.now()}`,
      notes: {
        userId,
        planId,
        userEmail,
      },
    });

    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err: any) {
    console.error("[Payments] Error creating order:", err);
    return NextResponse.json(
      { error: "Failed to create order. Please try again." },
      { status: 500 }
    );
  }
}
