import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@pokemon/db";
import type Stripe from "stripe";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET)
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig)
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId) {
        await db.user.update({
          where: { id: userId },
          data: {
            premium: true,
            stripeCustomerId: session.customer as string,
          },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      await db.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { premium: false },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
