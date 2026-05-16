import { NextRequest, NextResponse } from "next/server";
import { getFullCard, normalizeFullCard } from "@/lib/tcgdex";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const card = await getFullCard(id);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json(
      { data: normalizeFullCard(card) },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    console.error("TCGdex card fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch card" }, { status: 500 });
  }
}
