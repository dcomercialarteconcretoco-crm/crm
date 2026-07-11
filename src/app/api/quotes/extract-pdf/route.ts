import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getPool, hasDatabase } from "@/lib/postgres";

/**
 * POST /api/quotes/extract-pdf
 *
 * Lee un PDF de cotización VIEJA (pre-CRM) con Gemini y devuelve los datos
 * estructurados para pre-llenar el formulario de "cotización histórica" en la
 * hoja de vida del cliente. El PDF viaja inline a Gemini (multimodal) — no hay
 * librería de parsing en el stack y no hace falta.
 *
 * Contrato con la UI: SIEMPRE responde 200 con { ok: boolean }. Un `ok: false`
 * (sin API key, PDF ilegible, respuesta imparseable) NO es un error rojo: el
 * modal degrada a formulario manual. Solo 4xx en input inválido / rate limit.
 */

// Mismo límite que los attachments de cliente (el PDF luego se guarda ahí).
const MAX_SIZE = 10 * 1024 * 1024;

const EXTRACT_PROMPT = `Eres un extractor de datos de cotizaciones comerciales colombianas (ArteConcreto S.A.S, mobiliario en concreto). Analiza el PDF adjunto y devuelve SOLO un objeto JSON con esta forma exacta (sin markdown, sin explicaciones):

{
  "legible": boolean,
  "quoteNumber": string|null,
  "date": string|null,
  "clientName": string|null,
  "clientCompany": string|null,
  "referencia": string|null,
  "items": [{ "name": string, "quantity": number, "unit": string|null, "unitPrice": number, "total": number }],
  "subtotal": number|null,
  "tax": number|null,
  "total": number|null,
  "validUntil": string|null,
  "paymentTerms": string|null,
  "deliveryTime": string|null,
  "notes": string|null
}

Reglas:
- "legible": false si el documento no es una cotización o es imposible de leer.
- "quoteNumber": el número visible tal cual aparece (ej "ART-142-2023").
- "date": fecha de emisión en formato YYYY-MM-DD.
- Montos en pesos colombianos como números puros sin separadores ni símbolo (ej: 1250000). "tax" es el IVA en pesos (monto, no porcentaje).
- Si un dato no aparece, usa null — NO lo inventes.
- "quantity" y precios numéricos; si un ítem no trae cantidad usa 1.
- Si el PDF es un escaneo, haz tu mejor esfuerzo leyendo la imagen; si es imposible, "legible": false.`;

type Extracted = {
    legible: boolean;
    quoteNumber: string | null;
    date: string | null;
    clientName: string | null;
    clientCompany: string | null;
    referencia: string | null;
    items: Array<{ name: string; quantity: number; unit: string | null; unitPrice: number; total: number }>;
    subtotal: number | null;
    tax: number | null;
    total: number | null;
    validUntil: string | null;
    paymentTerms: string | null;
    deliveryTime: string | null;
    notes: string | null;
};

export async function POST(req: NextRequest) {
    try {
        // La extracción es la llamada más cara del CRM a Gemini (PDF completo):
        // 5/min por IP alcanza de sobra para el flujo "de a una" del modal.
        const ip =
            req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
            req.headers.get("x-real-ip") ||
            "unknown";
        const limit = rateLimit(ip, { maxRequests: 5, windowMs: 60_000, key: "extract-pdf" });
        if (!limit.ok) {
            return NextResponse.json(
                { error: `Demasiadas extracciones seguidas. Espera ${limit.retryAfter}s.` },
                { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
            );
        }

        const formData = await req.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: "No llegó ningún archivo." }, { status: 400 });
        }
        if (file.type !== "application/pdf") {
            return NextResponse.json({ error: "Solo se aceptan archivos PDF." }, { status: 400 });
        }
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "El archivo excede 10 MB." }, { status: 400 });
        }

        // Key de Gemini: env primero; si no está (setups donde la key se guarda
        // desde /settings), caer a settings.geminiKey del state compartido —
        // leída server-side, nunca enviada por el cliente.
        let apiKey = (
            process.env.GEMINI_API_KEY ||
            process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
            ""
        ).trim();
        if (!apiKey && hasDatabase()) {
            try {
                const { rows } = await getPool().query(
                    `SELECT value->>'geminiKey' AS key FROM crm_state WHERE key = 'settings'`
                );
                apiKey = (rows[0]?.key || "").trim();
            } catch {
                // sin DB o sin settings — se maneja abajo como no-key
            }
        }
        if (!apiKey) {
            return NextResponse.json({ ok: false, reason: "no-key" });
        }

        const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [
                            { text: EXTRACT_PROMPT },
                            { inlineData: { mimeType: "application/pdf", data: base64 } },
                        ],
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 4096,
                        responseMimeType: "application/json",
                    },
                }),
            }
        );

        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) {
            console.error("extract-pdf: Gemini error", data?.error?.message || res.status);
            return NextResponse.json({ ok: false, reason: "gemini-error" });
        }

        const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        // Gemini a veces envuelve en ```json aunque se pida responseMimeType JSON.
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

        let extracted: Extracted;
        try {
            extracted = JSON.parse(cleaned);
        } catch {
            console.error("extract-pdf: respuesta imparseable", cleaned.slice(0, 200));
            return NextResponse.json({ ok: false, reason: "unparseable" });
        }

        if (!extracted || extracted.legible === false) {
            return NextResponse.json({ ok: false, reason: "unreadable" });
        }

        return NextResponse.json({ ok: true, extracted });
    } catch (error: any) {
        console.error("extract-pdf route error:", error?.message || error);
        return NextResponse.json({ ok: false, reason: "server-error" });
    }
}
