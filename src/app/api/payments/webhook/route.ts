import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getPlanById, getPremiumDurationMs, PlanId } from "@/lib/payments";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

function getAdminFirestore() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";
    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const notes = payment.notes || {};
      const userId = notes.userId;
      const planId = notes.planId;

      if (!userId || !planId) {
        return NextResponse.json({ error: "Missing userId/planId in payment notes" }, { status: 400 });
      }

      const plan = getPlanById(planId as PlanId);
      const expiresAt = new Date(Date.now() + getPremiumDurationMs(planId as PlanId)).toISOString();

      const firestore = getAdminFirestore();
      await firestore.collection("profiles").doc(userId).update({
        is_premium: true,
        coupon_applied: `razorpay_${planId}`,
        premium_expires_at: expiresAt,
      });

      console.log(`[Payments] Premium activated for ${userId} via ${planId}`);
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      console.error("[Payments] Payment failed:", payment.id, payment.error_description);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Payments] Webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
