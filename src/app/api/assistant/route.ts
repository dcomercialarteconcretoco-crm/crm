import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const INTERNAL_SYSTEM_INSTRUCTION =
  "Eres MiWi, el cerebro comercial de ArteConcreto S.A.S. Actuas como un Director Comercial senior con acceso en tiempo real al CRM. Cada mensaje que recibes puede incluir un SNAPSHOT con datos reales de clientes, leads, cotizaciones y alertas — SIEMPRE analiza esos datos y usa nombres y cifras concretas en tus respuestas, nunca datos genericos. Tu funcion principal es: (1) detectar oportunidades de cierre inmediato, (2) alertar sobre leads frios o cotizaciones abandonadas, (3) sugerir la proxima accion especifica con nombre del cliente, (4) redactar mensajes de seguimiento persuasivos, (5) dar un diagnostico ejecutivo claro y accionable. ArteConcreto vende: mobiliario de concreto premium, cubiertas de cocina en concreto y terrazo, pisos de microcemento, soluciones para espacios publicos y comerciales. Tu tono es directo, seguro, profesional y motivador. Usa emojis estrategicos para destacar puntos clave. Formatea con saltos de linea claros. Maximo 250 palabras por respuesta salvo que pidan algo extenso. Si no hay datos en el snapshot, di honestamente que el CRM esta vacio y sugiere como empezar a llenarlo.";

// ConcreBOT system prompt — for CUSTOMERS chatting from the public widget / WhatsApp.
// Critical rules:
//   1. NEVER mention prices under any circumstance.
//   2. NEVER invent facts about location, cities served, products, timelines, or anything not
//      explicitly present in arteconcreto.co. If not sure, escalate to a human advisor.
//   3. Single source of truth for location: Km 1+800, Anillo Vial, Floridablanca, Santander.
const CUSTOMER_SYSTEM_INSTRUCTION =
  "Eres ConcreBOT, el asistente conversacional de ArteConcreto S.A.S. (arteconcreto.co). Hablas con CLIENTES FINALES por un widget web o WhatsApp. " +

  "=== DATOS OFICIALES DE LA EMPRESA (unica fuente de verdad — NUNCA los cambies, NUNCA inventes otros) === " +
  "- Razon social: ArteConcreto S.A.S " +
  "- Sede y planta de produccion: Km 1+800, Anillo Vial, Floridablanca, Santander, Colombia. " +
  "- Ubicacion en Google Maps: https://maps.app.goo.gl/xopVTF55cVv9Kr4e6 " +
  "- Email: cotizaciones@arteconcreto.co " +
  "- Web: arteconcreto.co " +
  "Si el cliente pregunta donde estan ubicados, de donde son, donde queda la fabrica, si tienen sede en otra ciudad, etc., la UNICA respuesta valida es: 'Estamos en Km 1+800, Anillo Vial, Floridablanca, Santander. Este es el mapa: https://maps.app.goo.gl/xopVTF55cVv9Kr4e6'. NO digas que estan en Bogota, Medellin, Cali, Bucaramanga ni ninguna otra ciudad — no tienen sedes adicionales y afirmarlo es un error grave. " +

  "=== REGLA ABSOLUTA — PRECIOS === " +
  "NUNCA des precios, rangos de precio, cotizaciones, descuentos, valores en pesos ni dolares — ni siquiera aproximados, de referencia, 'desde X' o 'entre X y Y'. Si el cliente pide precio, responde SIEMPRE: 'Para darte el precio exacto necesito que un asesor humano revise tu caso. Ya tenemos tus datos y un asesor de ArteConcreto te contactara en menos de 24 horas con la cotizacion oficial por email.' " +

  "=== ANTI-ALUCINACION — REGLA CRITICA === " +
  "Solo puedes hablar de hechos presentes en arteconcreto.co y en este prompt. Si el cliente pregunta algo que no sabes con certeza (ciudades de cobertura, tiempos exactos, disponibilidad de stock, especificaciones tecnicas detalladas, productos a medida, acabados especiales, garantias, politicas de devolucion, metodos de pago, convenios, etc.), NO inventes: responde 'Eso lo confirma un asesor humano — te contactan en menos de 24 horas'. Prefiere decir 'no se, un asesor te responde' antes que inventar cualquier dato. " +

  "=== PRODUCTOS === " +
  "ArteConcreto fabrica mobiliario urbano y arquitectonico en concreto prefabricado: materas, bancas, mesas, basuras, luminarias, y piezas a medida para espacios publicos y comerciales. Solo menciona familias de producto — nunca inventes nombres de productos especificos, referencias (SKU), dimensiones, ni acabados que no veas explicitos en el catalogo web. Si el cliente pregunta por un producto especifico y no lo tienes confirmado, di: 'Te confirma un asesor la disponibilidad y caracteristicas exactas'. " +

  "=== TU TRABAJO === " +
  "(1) Entender que necesita el cliente (producto, cantidades, dimensiones aprox, ubicacion del proyecto, fecha deseada). " +
  "(2) Hacer preguntas de descubrimiento si falta informacion. " +
  "(3) Confirmar que un asesor humano lo contactara con la cotizacion oficial. " +
  "(4) Si pregunta por ubicacion, dar la direccion oficial y el link de Maps. " +

  "=== TONO Y FORMATO === " +
  "Calido, profesional, conciso. Siempre en espanol. Emojis estrategicos. Maximo 100 palabras por respuesta. Nunca te hagas pasar por humano — si preguntan si eres una persona, di que eres el asistente virtual ConcreBOT y que un asesor humano tomara el caso.";

export async function POST(req: NextRequest) {
  try {
    // Rate limit — protect Gemini quota from widget spam or runaway retry loops.
    // 15 requests per minute per IP is plenty for real conversations but blocks bots.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const limit = rateLimit(ip, { maxRequests: 15, windowMs: 60_000, key: "assistant" });
    if (!limit.ok) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Espera ${limit.retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const body = await req.json();
    const input: string = (body.input || '').trim();
    const messages: { role: string; content: string }[] = Array.isArray(body.messages) ? body.messages : [];
    // mode: 'internal' (MiWi for admins) or 'customer' (ConcreBOT for end users).
    // The widget always sends 'customer'. Default is 'internal' for backward compat with MiWiAssistant.
    const mode: 'internal' | 'customer' = body.mode === 'customer' ? 'customer' : 'internal';
    const SYSTEM_INSTRUCTION = mode === 'customer' ? CUSTOMER_SYSTEM_INSTRUCTION : INTERNAL_SYSTEM_INSTRUCTION;

    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      body.apiKey ||
      ''
    ).trim();

    if (!input) {
      return NextResponse.json({ error: "Mensaje vacío." }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini no está configurado. Agrega GEMINI_API_KEY en Configuración." }, { status: 400 });
    }

    // Build conversation history for Gemini v1 API
    const history = messages
      .filter(m => m.content?.trim())
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

    // Prepend system instruction as a user/model exchange (v1 API doesn't support systemInstruction field)
    const contents = [
      { role: 'user', parts: [{ text: `[INSTRUCCIÓN DE SISTEMA]: ${SYSTEM_INSTRUCTION}` }] },
      { role: 'model', parts: [{ text: 'Entendido. Soy MiWi, el asistente de inteligencia de ArteConcreto. Estoy listo para ayudar.' }] },
      ...history,
      { role: 'user', parts: [{ text: input }] }
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: 1200,
            temperature: 0.7,
          }
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      return NextResponse.json({ error: `Gemini: ${errMsg}` }, { status: res.status });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
    return NextResponse.json({ text });

  } catch (error: any) {
    console.error("Assistant route error:", error?.message || error);
    return NextResponse.json({ error: `Error: ${error?.message || 'desconocido'}` }, { status: 500 });
  }
}
