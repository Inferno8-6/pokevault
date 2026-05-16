import { NextRequest, NextResponse } from "next/server";
import { db } from "@pokemon/db";

// GET /api/sealed/search?q=... — recherche dans le catalogue de produits scellés
// Renvoie les produits déjà connus (créés via une précédente saisie utilisateur).
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2)
    return NextResponse.json({ results: [] });

  const products = await db.sealedProduct.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { setName: { contains: q, mode: "insensitive" } },
        { setCode: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 12,
    orderBy: [{ updatedAt: "desc" }],
  });

  return NextResponse.json({
    results: products.map((p) => ({
      id: p.id,
      name: p.name,
      productType: p.productType,
      setName: p.setName,
      setCode: p.setCode,
      language: p.language,
      imageUrl: p.imageUrl,
      currentPrice: p.currentPrice,
    })),
  });
}
