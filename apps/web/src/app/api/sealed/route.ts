import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@pokemon/db";
import {
  SEALED_PRODUCT_TYPES,
  SEALED_CONDITIONS,
  LIMITS,
  isOneOf,
} from "@pokemon/shared";

/**
 * Parse un input de prix venant du body JSON.
 * Retourne `null` si vide/absent, `"invalid"` si non-parseable ou hors bornes,
 * sinon un Float bien formé arrondi au centime.
 */
function parsePrice(raw: unknown): number | null | "invalid" {
  if (raw == null || raw === "") return null;
  const n = parseFloat(String(raw));
  if (!Number.isFinite(n) || n < 0 || n > LIMITS.maxPriceEur) return "invalid";
  return Math.round(n * 100) / 100;
}

// GET /api/sealed — liste des scellés de l'utilisateur
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const holdings = await db.sealedHolding.findMany({
    where: { userId: session.user.id },
    include: { product: true },
    orderBy: { addedAt: "desc" },
  });

  const items = holdings.map((h) => {
    const value = (h.product.currentPrice ?? 0) * h.quantity;
    const cost = (h.purchasePrice ?? 0) * h.quantity;
    const pnl = cost > 0 ? value - cost : null;
    const pnlPct = cost > 0 ? ((value - cost) / cost) * 100 : null;
    return {
      id: h.id,
      productId: h.product.id,
      name: h.product.name,
      type: h.product.productType,
      setName: h.product.setName,
      setCode: h.product.setCode,
      language: h.product.language,
      imageUrl: h.product.imageUrl,
      quantity: h.quantity,
      condition: h.condition,
      purchasePrice: h.purchasePrice,
      currentPrice: h.product.currentPrice,
      currency: h.product.currency,
      value,
      cost,
      pnl,
      pnlPct,
      notes: h.notes,
      addedAt: h.addedAt,
    };
  });

  const totalValue = items.reduce((sum, i) => sum + i.value, 0);
  const totalCost = items.reduce((sum, i) => sum + i.cost, 0);
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  return NextResponse.json({
    items,
    summary: {
      totalValue,
      totalCost,
      totalQty,
      productCount: items.length,
      pnl: totalCost > 0 ? totalValue - totalCost : null,
      pnlPct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null,
    },
  });
}

// POST /api/sealed — ajout d'un produit scellé à la collection
// Body : { name, productType, setName?, setCode?, language?, imageUrl?, currentPrice?, quantity?, condition?, purchasePrice?, notes?, productId? }
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await request.json();

  // Validation
  const productId: string | undefined = typeof body.productId === "string" ? body.productId : undefined;
  const name: string = String(body.name ?? "").trim().slice(0, LIMITS.nameLength);
  const productType: string = String(body.productType ?? "booster").trim();
  const quantity = Math.min(LIMITS.maxQuantity, Math.max(1, Math.floor(Number(body.quantity ?? 1))));
  const condition: string = String(body.condition ?? "sealed").trim();

  if (!productId && !name)
    return NextResponse.json({ error: "Nom du produit requis" }, { status: 400 });
  if (!isOneOf(productType, SEALED_PRODUCT_TYPES))
    return NextResponse.json({ error: "Type de produit invalide" }, { status: 400 });
  if (!isOneOf(condition, SEALED_CONDITIONS))
    return NextResponse.json({ error: "Condition invalide" }, { status: 400 });

  const purchasePrice = parsePrice(body.purchasePrice);
  if (purchasePrice === "invalid")
    return NextResponse.json({ error: "Prix d'achat invalide" }, { status: 400 });
  const currentPrice = parsePrice(body.currentPrice);
  if (currentPrice === "invalid")
    return NextResponse.json({ error: "Prix actuel invalide" }, { status: 400 });

  try {
    // Soit on référence un produit existant, soit on en crée un
    let product;
    if (productId) {
      product = await db.sealedProduct.findUnique({ where: { id: productId } });
      if (!product)
        return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    } else {
      product = await db.sealedProduct.create({
        data: {
          name,
          productType,
          setCode: body.setCode || null,
          setName: body.setName || null,
          language: body.language || "FR",
          imageUrl: body.imageUrl || null,
          currentPrice,
          currency: "EUR",
        },
      });
    }

    // Upsert sur (userId, productId, condition) — incrémente la quantité si existe déjà
    const existing = await db.sealedHolding.findUnique({
      where: { userId_productId_condition: { userId: session.user.id, productId: product.id, condition } },
    });

    let holding;
    if (existing) {
      holding = await db.sealedHolding.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
          purchasePrice: purchasePrice ?? existing.purchasePrice,
          notes: body.notes ?? existing.notes,
        },
      });
    } else {
      holding = await db.sealedHolding.create({
        data: {
          userId: session.user.id,
          productId: product.id,
          quantity,
          condition,
          purchasePrice,
          notes: body.notes ?? null,
        },
      });
    }

    return NextResponse.json({ success: true, id: holding.id, productId: product.id });
  } catch (error) {
    console.error("Sealed add error:", error);
    return NextResponse.json({ error: "Échec de l'ajout" }, { status: 500 });
  }
}

// PATCH /api/sealed?id=xxx — édite quantité / condition / prix achat / notes
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const holding = await db.sealedHolding.findUnique({ where: { id } });
  if (!holding || holding.userId !== session.user.id)
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  const body = await request.json();
  const data: { quantity?: number; condition?: string; purchasePrice?: number | null; notes?: string | null } = {};

  if (body.quantity != null) {
    data.quantity = Math.min(LIMITS.maxQuantity, Math.max(1, Math.floor(Number(body.quantity))));
  }
  if (body.condition != null) {
    if (!isOneOf(body.condition, SEALED_CONDITIONS))
      return NextResponse.json({ error: "Condition invalide" }, { status: 400 });
    data.condition = body.condition;
  }
  if (body.purchasePrice !== undefined) {
    const p = parsePrice(body.purchasePrice);
    if (p === "invalid")
      return NextResponse.json({ error: "Prix d'achat invalide" }, { status: 400 });
    data.purchasePrice = p;
  }
  if (body.notes !== undefined) {
    data.notes = body.notes ? String(body.notes).slice(0, LIMITS.noteLength) : null;
  }

  const updated = await db.sealedHolding.update({ where: { id }, data });
  return NextResponse.json({ success: true, id: updated.id });
}

// DELETE /api/sealed?id=xxx
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const holding = await db.sealedHolding.findUnique({ where: { id } });
  if (!holding || holding.userId !== session.user.id)
    return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  await db.sealedHolding.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
