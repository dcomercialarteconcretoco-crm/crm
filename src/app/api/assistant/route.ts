import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_INSTRUCTION =
  "Eres MiWi, un asistente de inteligencia artificial experto en ventas y gestion de clientes para Arte Concreto, una empresa lider en mobiliario de concreto, cubiertas de cocina de lujo y soluciones para espacios publicos. Tu objetivo es ayudar a Juan Sierra y su equipo a vender mas y gestionar mejor sus leads. Eres audaz, profesional, premium y enfocado en resultados. Analizas pipelines, sugieres cierres de ventas, redactas correos persuasivos y das consejos sobre proyectos de concreto, marmol, terrazo y microcemento. Si te preguntan por recomendaciones, basate en la eficiencia y el valor del lead.";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      messages?: AssistantMessage[];
      input?: string;
      apiKey?: string;
    };

    const input = body.input?.trim();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      body.apiKey ||
      ""
    ).trim();

    if (!input) {
      return NextResponse.json({ error: "Mensaje vacio." }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini no esta configurado." },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const chat = model.startChat({
      history: messages.map((message) => ({
        role: message.role === "user" ? "user" : "model",
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(input);
    const response = await result.response;

    return NextResponse.json({ text: response.text() });
  } catch (error) {
    console.error("Assistant route error:", error);
    return NextResponse.json(
      { error: "No fue posible consultar a MiWi." },
      { status: 500 }
    );
  }
}
