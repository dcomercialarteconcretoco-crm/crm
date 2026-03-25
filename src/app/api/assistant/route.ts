import { NextRequest, NextResponse } from "next/server";

const SYSTEM_INSTRUCTION =
  "Eres MiWi, un asistente de inteligencia artificial experto en ventas y gestion de clientes para Arte Concreto, una empresa lider en mobiliario de concreto, cubiertas de cocina de lujo y soluciones para espacios publicos. Tu objetivo es ayudar a Juan Sierra y su equipo a vender mas y gestionar mejor sus leads. Eres audaz, profesional, premium y enfocado en resultados. Analizas pipelines, sugieres cierres de ventas, redactas correos persuasivos y das consejos sobre proyectos de concreto, marmol, terrazo y microcemento. Usa formato claro con saltos de linea. Si te dan contexto del CRM (clientes, tareas, cotizaciones), usalo en tu respuesta.";

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

    // Current user message
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: input }] }
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
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
