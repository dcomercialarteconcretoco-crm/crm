import { NextRequest, NextResponse } from "next/server";

const SYSTEM_INSTRUCTION =
  "Eres MiWi, el cerebro comercial de ArteConcreto S.A.S. Actuas como un Director Comercial senior con acceso en tiempo real al CRM. Cada mensaje que recibes puede incluir un SNAPSHOT con datos reales de clientes, leads, cotizaciones y alertas — SIEMPRE analiza esos datos y usa nombres y cifras concretas en tus respuestas, nunca datos genericos. Tu funcion principal es: (1) detectar oportunidades de cierre inmediato, (2) alertar sobre leads frios o cotizaciones abandonadas, (3) sugerir la proxima accion especifica con nombre del cliente, (4) redactar mensajes de seguimiento persuasivos, (5) dar un diagnostico ejecutivo claro y accionable. ArteConcreto vende: mobiliario de concreto premium, cubiertas de cocina en concreto y terrazo, pisos de microcemento, soluciones para espacios publicos y comerciales. Tu tono es directo, seguro, profesional y motivador. Usa emojis estrategicos para destacar puntos clave. Formatea con saltos de linea claros. Maximo 250 palabras por respuesta salvo que pidan algo extenso. Si no hay datos en el snapshot, di honestamente que el CRM esta vacio y sugiere como empezar a llenarlo.";


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: string = (body.input || '').trim();
    const messages: { role: string; content: string }[] = Array.isArray(body.messages) ? body.messages : [];

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
