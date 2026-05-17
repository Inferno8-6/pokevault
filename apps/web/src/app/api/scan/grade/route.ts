import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLimits } from "@/lib/premium";
import { GoogleGenerativeAI } from "@google/generative-ai";

// POST /api/scan/grade — estime un grade PSA depuis une photo (Premium only, Gemini Flash)
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

  if (!process.env.GEMINI_API_KEY)
    return NextResponse.json({ error: "Estimation non configurée (clé Gemini manquante)" }, { status: 503 });

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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 400 },
    });

    const prompt = `Tu es un expert PSA / Beckett en grading de cartes Pokémon TCG.
Analyse cette photo de carte et estime un grade PSA (1-10).

Évalue chaque critère sur 10 :
- centering : symétrie du cadre avant/arrière
- surface : rayures, taches, impressions, brillance
- corners : usure, blanchiment, pliures aux 4 coins
- edges : usure, entailles, blanchiment sur les 4 bords

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
- Si la photo ne montre pas une carte Pokémon : {"grade": null, "error": "Pas une carte Pokémon détectée"}`;

    const response = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      { text: prompt },
    ]);

    const text = response.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      return NextResponse.json({ error: "Impossible d'analyser la réponse" }, { status: 500 });

    const result = JSON.parse(jsonMatch[0]);

    if (result.grade === null || result.grade === undefined)
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
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erreur Gemini : ${msg}` }, { status: 500 });
  }
}
