import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

const PRICE_ID = process.env.STRIPE_PRICE_ID;
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!PRICE_ID)
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 500 });

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: session.user.email,
    metadata: { userId: session.user.id },
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: `${APP_URL}/premium?success=1`,
    cancel_url: `${APP_URL}/premium?canceled=1`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
