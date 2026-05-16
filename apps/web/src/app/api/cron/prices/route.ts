import { NextResponse } from "next/server";
import { fetchAndStorePrices, checkAlerts } from "@/lib/price-engine";

// Cet endpoint est appelé par :
// - Vercel Cron (vercel.json)
// - Un service cron externe (cron-job.org, gratuit)
// - En dev : manuellement ou via setInterval

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // 🔐 Sécurité renforcée : si CRON_SECRET est défini, il est obligatoire.
  // Si non défini, on bloque quand même en production.
  const isProd = process.env.NODE_ENV === "production";
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  } else if (isProd) {
    // En production sans secret configuré → bloquer par sécurité
    console.error("[Cron] CRON_SECRET non configuré en production !");
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    // 1. Mettre à jour les prix depuis TCGdex
    const priceResult = await fetchAndStorePrices();

    // 2. Vérifier les alertes de prix
    const alertResult = await checkAlerts();

    return NextResponse.json({
      success: true,
      prices: priceResult,
      alerts: alertResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Price fetch failed:", error);
    return NextResponse.json({ error: "Échec mise à jour des prix" }, { status: 500 });
  }
}
