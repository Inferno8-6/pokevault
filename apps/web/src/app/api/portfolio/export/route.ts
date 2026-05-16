import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import { getUserLimits } from "@/lib/premium";

// GET /api/portfolio/export — exporte la collection en CSV
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { isPremium } = await getUserLimits();
  if (!isPremium)
    return NextResponse.json(
      { error: "L'export CSV est réservé aux membres Premium.", premium: true },
      { status: 403 },
    );

  const collection = await db.collection.findMany({
    where: { userId: session.user.id },
    include: {
      card: {
        include: {
          prices: { orderBy: { fetchedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { addedAt: "desc" },
  });

  const rows = [
    ["Nom", "Série", "Numéro", "Rareté", "État", "Quantité", "Prix achat (€)", "Prix actuel (€)", "Valeur totale (€)", "Ajouté le"],
    ...collection.map((item) => {
      const price = item.card.prices[0]?.price ?? 0;
      const conditionLabels: Record<string, string> = {
        mint: "Mint",
        near_mint: "Near Mint",
        excellent: "Excellent",
        good: "Good",
        played: "Played",
        poor: "Poor",
      };
      return [
        `"${item.card.name}"`,
        `"${item.card.setName}"`,
        item.card.number,
        `"${item.card.rarity ?? ""}"`,
        `"${conditionLabels[item.condition ?? ""] ?? item.condition ?? ""}"`,
        item.quantity,
        item.purchasePrice?.toFixed(2) ?? "",
        price.toFixed(2),
        (price * item.quantity).toFixed(2),
        new Date(item.addedAt).toLocaleDateString("fr-FR"),
      ];
    }),
  ];

  const csv = rows.map((r) => r.join(";")).join("\n");
  const bom = "﻿"; // BOM pour Excel (encodage correct des accents)

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pokevault-collection-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
