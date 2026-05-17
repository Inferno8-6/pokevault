import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

// POST /api/scan — identifie une carte Pokémon depuis une photo (Gemini Flash)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!process.env.GEMINI_API_KEY)
    return NextResponse.json({ error: "Scan non configuré (clé Gemini manquante)" }, { status: 503 });

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
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 500,
        // @ts-expect-error — thinkingConfig ok with 2.5 models, types may lag
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const prompt = `Tu es un expert en cartes Pokémon TCG (français, anglais et japonais).
Identifie précisément la carte sur cette image.

Procède ainsi (étapes mentales) :
1. Cherche le NOM du Pokémon en haut de la carte (parfois suivi de "ex", "GX", "V", "VMAX", "VSTAR")
2. Cherche le NUMÉRO en bas (ex "4/102", "001/165", "SV4a-185") — distinguer un numéro de Stage HP
3. Cherche le LOGO du set (en bas à droite ou centre bas)
4. Détecte la LANGUE (FR / EN / JA) selon le texte des attaques
5. Détecte la VARIANTE visuelle : holographique (reflet arc-en-ciel sur l'illustration), reverse holo (reflet sur le reste de la carte), normale (mate)

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "name": "Nom du Pokémon en français (ex: Dracaufeu, Pikachu, Mewtwo, Dracaufeu ex)",
  "set": "Nom complet de la série (ex: 'Écarlate et Violet — 151', 'Évolutions Prismatiques') ou null",
  "number": "Numéro tel qu'imprimé (ex: '4/102', '199/165') ou null",
  "language": "fr|en|ja|unknown",
  "variant": "normal|holo|reverseHolo|firstEdition|unknown",
  "confidence": "high|medium|low"
}

Règles :
- confidence "high" : nom + numéro + set tous lisibles distinctement
- confidence "medium" : un élément manque mais identification probable
- confidence "low" : photo floue ou angle difficile
- Préfère le nom français même si la carte est en anglais (cherche l'équivalent FR)
- Si ce n'est PAS une carte Pokémon TCG officielle (jouet, fan-art, autre TCG) :
  {"name": null, "set": null, "number": null, "language": null, "variant": null, "confidence": "low"}`;

    const response = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      { text: prompt },
    ]);

    const text = response.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Scan: no JSON in response", { text });
      return NextResponse.json({ error: `Réponse non-JSON: ${text.slice(0, 200)}` }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);

    if (!result.name)
      return NextResponse.json({ identified: false, message: "Carte non reconnue" });

    return NextResponse.json({
      identified: true,
      name: result.name,
      set: result.set,
      number: result.number,
      language: result.language ?? null,
      variant: result.variant ?? null,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("Scan error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erreur Gemini : ${msg}` }, { status: 500 });
  }
}
