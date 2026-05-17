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
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 1200,
        // PSA grading needs reasoning — give it a small thinking budget so
        // it actually evaluates each criterion instead of guessing.
        // @ts-expect-error — thinkingConfig ok with 2.5 models, types may lag
        thinkingConfig: { thinkingBudget: 2048 },
      },
    });

    const prompt = `Tu es un expert PSA / Beckett en grading de cartes Pokémon TCG.
Analyse rigoureusement cette photo et estime un grade PSA (1-10).

Méthode d'évaluation (applique-la étape par étape) :

**CENTRAGE** (centering, sur 10) :
- 10 : cadrage parfait, marges identiques sur les 4 côtés (50/50 H et V)
- 9 : très léger décalage (max 55/45)
- 8 : décalage visible (60/40)
- 7 : décalage marqué (65/35)
- 6 ou moins : décalage important (70/30 ou pire)
- Si verso non visible, juge uniquement le recto et marque "confidence" en baisse

**SURFACE** (sur 10) :
- 10 : aucune rayure, aucun défaut d'impression, brillance intacte
- 9 : 1-2 micro-défauts invisibles à distance normale
- 8 : quelques micro-rayures sur le foil, ou minuscule défaut d'impression
- 7 : rayures visibles sur l'illustration ou holo "scratched"
- 6 ou moins : rayures profondes, taches, marques évidentes

**COINS** (corners, sur 10) — analyse les 4 coins individuellement :
- 10 : 4 coins parfaitement pointus
- 9 : très léger émoussement sur 1 coin
- 8 : léger blanchiment sur 1-2 coins
- 7 : blanchiment visible sur 2+ coins
- 6 ou moins : coins arrondis ou abîmés

**BORDS** (edges, sur 10) :
- 10 : 4 bords nets, noirs/colorés sans blanchiment
- 9 : très léger frottement sur 1 bord
- 8 : blanchiment léger sur 1-2 bords
- 7 : blanchiment ou entailles visibles
- 6 ou moins : usure marquée

**GRADE GLOBAL PSA** — règle clé :
- PSA 10 (Gem Mint) : TOUS les critères ≥ 9.5 ET centrage ≥ 9
- PSA 9 (Mint) : aucun critère < 8, défauts mineurs autorisés
- PSA 8 (NM-MT) : 1 critère peut être à 7
- PSA 7 (NM) : défauts visibles mais légers
- PSA 6 et moins : défauts évidents

Réponds UNIQUEMENT en JSON valide :
{
  "grade": 8,
  "centering": 9,
  "surface": 8,
  "corners": 7,
  "edges": 8,
  "confidence": "high|medium|low",
  "details": "2-3 phrases en français décrivant précisément les défauts observés (ou 'Carte en condition exceptionnelle' si grade ≥ 9)"
}

Confidence :
- "high" : photo nette, recto ET verso visibles, lumière correcte
- "medium" : un seul côté visible OU lumière imparfaite
- "low" : photo floue, angle difficile, ou reflets masquant des zones

Si ce n'est pas une carte Pokémon : {"grade": null, "error": "Pas une carte Pokémon détectée"}`;

    const response = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      { text: prompt },
    ]);

    const text = response.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Grade: no JSON in response", { text });
      return NextResponse.json({ error: `Réponse non-JSON: ${text.slice(0, 200)}` }, { status: 500 });
    }

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
