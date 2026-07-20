import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit, getClientIp, getRateLimitConfig } from "@/lib/rateLimiter";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

interface RequestBody {
  contents: any[];
  systemInstruction?: string;
  generationConfig?: { temperature?: number; [key: string]: any };
  model?: string;
}

async function tryGemini(body: RequestBody): Promise<string> {
  if (!GEMINI_KEY) throw new Error("GEMINI_KEY_NOT_CONFIGURED");

  const ai = new GoogleGenerativeAI(GEMINI_KEY);
  const model = ai.getGenerativeModel({
    model: body.model || "gemini-flash-latest",
    systemInstruction: body.systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: body.generationConfig?.temperature ?? 0.2,
      ...body.generationConfig,
    },
  });

  const result = await model.generateContent(body.contents);
  return result.response.text();
}

async function tryGroq(body: RequestBody): Promise<string> {
  if (!GROQ_KEY) throw new Error("GROQ_KEY_NOT_CONFIGURED");

  const messages: any[] = [];
  if (body.systemInstruction) {
    messages.push({ role: "system", content: body.systemInstruction });
  }

  for (const part of body.contents) {
    if (part.text) {
      messages.push({ role: "user", content: part.text });
    }
  }

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: body.generationConfig?.temperature ?? 0.2,
      max_tokens: 16000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function isRateLimitError(err: any): boolean {
  const msg = err?.message || String(err);
  return (
    msg.includes("429") ||
    msg.includes("Quota") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Too Many Requests")
  );
}

export async function POST(request: NextRequest) {
  if (!GEMINI_KEY && !GROQ_KEY) {
    return NextResponse.json(
      { error: "No AI API keys configured on server" },
      { status: 500 }
    );
  }

  // Rate limiting
  const ip = getClientIp(request);
  const rlConfig = getRateLimitConfig("moderate");
  const rl = checkRateLimit(`ai:${ip}`, rlConfig);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const body: RequestBody = await request.json();

    if (!body.contents || !Array.isArray(body.contents) || body.contents.length === 0) {
      return NextResponse.json({ error: "Request must include a non-empty 'contents' array." }, { status: 400 });
    }

    // Try Gemini first, fall back to Groq on rate limit
    try {
      const text = await tryGemini(body);
      return NextResponse.json({ text, provider: "gemini" });
    } catch (geminiErr) {
      if (isRateLimitError(geminiErr)) {
        // If the request contains image (inlineData) parts, Groq cannot handle it
        const hasImageParts = body.contents.some((part: any) => !!part.inlineData);
        if (hasImageParts) {
          return NextResponse.json(
            { error: "Image OCR requires Gemini and is unavailable right now due to rate limits. Please try again shortly." },
            { status: 429 }
          );
        }
        console.log("[AI Proxy] Gemini rate-limited, falling back to Groq");
        try {
          const text = await tryGroq(body);
          return NextResponse.json({ text, provider: "groq" });
        } catch (groqErr) {
          if (isRateLimitError(groqErr)) {
            return NextResponse.json(
              { error: "All AI providers are rate-limited. Please try again later." },
              { status: 429 }
            );
          }
          throw groqErr;
        }
      }
      // Check if Gemini key is just not configured — try Groq directly
      const geminiMsg = (geminiErr as Error).message || String(geminiErr);
      if (geminiMsg === "GEMINI_KEY_NOT_CONFIGURED" && GROQ_KEY) {
        const text = await tryGroq(body);
        return NextResponse.json({ text, provider: "groq" });
      }
      throw geminiErr;
    }
  } catch (err: any) {
    console.error("[AI Proxy] Error:", err);
    return NextResponse.json(
      { error: "AI generation failed. Please try again." },
      { status: 500 }
    );
  }
}
