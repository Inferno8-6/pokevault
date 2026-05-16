import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("[stripe] STRIPE_SECRET_KEY doit être défini dans .env");
    _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  }
  return _stripe;
}
