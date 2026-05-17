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
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 200 },
    });

    const prompt = `Tu es un expert en cartes Pokémon TCG. Identifie la carte sur cette image.

Réponds UNIQUEMENT en JSON avec ce format exact :
{
  "name": "Nom du Pokémon en français (ex: Dracaufeu, Pikachu, Mewtwo)",
  "set": "Nom de la série si visible (sinon null)",
  "number": "Numéro de la carte si visible (ex: 4/102) (sinon null)",
  "confidence": "high|medium|low"
}

Si ce n'est pas une carte Pokémon : {"name": null, "set": null, "number": null, "confidence": "low"}`;

    const response = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      { text: prompt },
    ]);

    const text = response.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      return NextResponse.json({ error: "Impossible d'analyser la réponse" }, { status: 500 });

    const result = JSON.parse(jsonMatch[0]);

    if (!result.name)
      return NextResponse.json({ identified: false, message: "Carte non reconnue" });

    return NextResponse.json({
      identified: true,
      name: result.name,
      set: result.set,
      number: result.number,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json({ error: "Erreur lors de l'analyse" }, { status: 500 });
  }
}
