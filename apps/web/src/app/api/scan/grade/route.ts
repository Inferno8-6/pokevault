import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLimits } from "@/lib/premium";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { isPremium } = await getUserLimits();
  if (!isPremium)
    return NextResponse.json(
      { error: "Fonctionnalité Premium requise", premium: true },
      { status: 403 },
    );

  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: "Estimation non configurée (clé OpenAI manquante)" }, { status: 503 });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    if (!file)
      return NextResponse.json({ error: "Image manquante" }, { status: 400 });

    if (file.size > 4 * 1024 * 1024)
      return NextResponse.json({ error: "Image trop grande (max 4 Mo)" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
            },
            {
              type: "text",
              text: `Tu es un expert PSA / Beckett en grading de cartes Pokémon TCG.
Analyse cette photo de carte et estime un grade PSA (1-10).

Évalue chaque critère sur 10 :
- **Centrage** (centering) : symétrie du cadre avant/arrière
- **Surface** (surface) : rayures, taches, impressions, brillance
- **Coins** (corners) : usure, blanchiment, pliures aux 4 coins
- **Bords** (edges) : usure, entailles, blanchiment sur les 4 bords

Réponds UNIQUEMENT en JSON avec ce format exact :
{
  "grade": 8,
  "centering": 9,
  "surface": 8,
  "corners": 7,
  "edges": 8,
  "confidence": "medium",
  "details": "Description courte en français des défauts visibles (ou 'Carte en excellent état' si aucun défaut)"
}

Règles :
- grade = note globale PSA estimée (pas la moyenne, mais le jugement expert)
- confidence : "high" si photo nette recto+verso, "medium" si un seul côté visible, "low" si photo floue/partielle
- Si la photo ne montre pas une carte Pokémon : {"grade": null, "error": "Pas une carte Pokémon détectée"}`,
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      return NextResponse.json({ error: "Impossible d'analyser la réponse" }, { status: 500 });

    const result = JSON.parse(jsonMatch[0]);

    if (result.grade === null)
      return NextResponse.json({ graded: false, message: result.error ?? "Carte non reconnue" });

    return NextResponse.json({
      graded: true,
      grade: result.grade,
      centering: result.centering,
      surface: result.surface,
      corners: result.corners,
      edges: result.edges,
      confidence: result.confidence,
      details: result.details,
    });
  } catch (error) {
    console.error("Grade estimation error:", error);
    return NextResponse.json({ error: "Erreur lors de l'estimation" }, { status: 500 });
  }
}
