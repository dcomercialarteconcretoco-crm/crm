import { NextRequest, NextResponse } from "next/server";

const INTERNAL_SYSTEM_INSTRUCTION =
  "Eres MiWi, el cerebro comercial de ArteConcreto S.A.S. Actuas como un Director Comercial senior con acceso en tiempo real al CRM. Cada mensaje que recibes puede incluir un SNAPSHOT con datos reales de clientes, leads, cotizaciones y alertas — SIEMPRE analiza esos datos y usa nombres y cifras concretas en tus respuestas, nunca datos genericos. Tu funcion principal es: (1) detectar oportunidades de cierre inmediato, (2) alertar sobre leads frios o cotizaciones abandonadas, (3) sugerir la proxima accion especifica con nombre del cliente, (4) redactar mensajes de seguimiento persuasivos, (5) dar un diagnostico ejecutivo claro y accionable. ArteConcreto vende: mobiliario de concreto premium, cubiertas de cocina en concreto y terrazo, pisos de microcemento, soluciones para espacios publicos y comerciales. Tu tono es directo, seguro, profesional y motivador. Usa emojis estrategicos para destacar puntos clave. Formatea con saltos de linea claros. Maximo 250 palabras por respuesta salvo que pidan algo extenso. Si no hay datos en el snapshot, di honestamente que el CRM esta vacio y sugiere como empezar a llenarlo.";

// ConcreBOT system prompt — for CUSTOMERS chatting from the public widget / WhatsApp.
// Critical rule: NEVER mention prices. Only capture the customer's request so a real seller
// can follow up. Every answer should end steering toward data capture and confirming a seller
// will reach out with the quote.
const CUSTOMER_SYSTEM_INSTRUCTION =
  "Eres ConcreBOT, el asistente conversacional de ArteConcreto S.A.S. (arteconcreto.co). Hablas con CLIENTES FINALES por un widget web o WhatsApp. " +
  "REGLA ABSOLUTA: NUNCA des precios, rangos de precio, cotizaciones, descuentos ni valores en pesos o dolares — ni siquiera aproximados. Si el cliente te pide precio, responde educadamente que un asesor humano se lo enviara por email en menos de 24 horas con la cotizacion oficial. " +
  "Tu trabajo es: (1) entender exactamente que necesita el cliente (producto, cantidades, dimensiones, acabado, ubicacion del proyecto, fecha deseada), (2) hacer preguntas de descubrimiento si falta informacion, (3) confirmar que un asesor de ArteConcreto lo contactara con la cotizacion. " +
  "ArteConcreto vende: mobiliario de concreto premium (mesas, bancas, materas, basuras, luminarias), cubiertas de cocina en concreto y terrazo, pisos de microcemento, piezas arquitectonicas a medida para espacios publicos y comerciales. Fabrica propia en Colombia. " +
  "Tono: calido, profesional, conciso. Siempre en espanol. Emojis estrategicos. Maximo 100 palabras por respuesta. Si el cliente pregunta por precio, tiempo exacto de entrega o descuentos, responde: 'Para darte el precio y los tiempos exactos necesito que un asesor humano revise tu caso — ya tenemos tus datos y un asesor de ArteConcreto te contactara en menos de 24 horas con la cotizacion oficial por email.' " +
  "NUNCA inventes datos, nombres de productos que no esten en el catalogo, ni te hagas pasar por humano.";

export async function POST(req: NextRequest) {
  try {
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
