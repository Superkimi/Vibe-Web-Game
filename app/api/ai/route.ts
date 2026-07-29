import { NextResponse } from "next/server";
import { z } from "zod";
import { aiChangeSetSchema, gameProjectSchema } from "@/lib/game-schema";
import { buildGameAgentPrompt } from "@/lib/ai-prompt";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  project: gameProjectSchema,
  message: z.string().min(1).max(5000),
  config: z.object({
    protocol: z.enum(["openai", "anthropic"]),
    baseUrl: z.string().url(),
    model: z.string().min(1).max(200),
    apiKey: z.string().min(1).max(1000),
    temperature: z.number().min(0).max(1).default(0.2),
  }),
});

function safeEndpoint(baseUrl: string, protocol: "openai" | "anthropic") {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") throw new Error("Model endpoint must use HTTPS");
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw new Error("Private network model endpoints are not allowed");
  }

  const trimmed = url.toString().replace(/\/$/, "");
  if (protocol === "anthropic") {
    return trimmed.endsWith("/v1/messages") ? trimmed : `${trimmed}/v1/messages`;
  }
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("The model did not return JSON");
  }
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const endpoint = safeEndpoint(body.config.baseUrl, body.config.protocol);
    const prompt = buildGameAgentPrompt(body.project, body.message);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    try {
      let upstream: Response;
      if (body.config.protocol === "anthropic") {
        upstream = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": body.config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: body.config.model,
            max_tokens: 5000,
            temperature: body.config.temperature,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });
      } else {
        upstream = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${body.config.apiKey}`,
          },
          body: JSON.stringify({
            model: body.config.model,
            temperature: body.config.temperature,
            messages: [
              {
                role: "system",
                content:
                  "Return only a JSON object that follows the operation protocol in the user prompt.",
              },
              { role: "user", content: prompt },
            ],
          }),
          signal: controller.signal,
        });
      }

      const responseText = await upstream.text();
      if (!upstream.ok) {
        let detail = responseText.slice(0, 500);
        try {
          const parsed = JSON.parse(responseText);
          detail = parsed?.error?.message ?? parsed?.message ?? detail;
        } catch {
          // Upstream returned plain text.
        }
        return errorResponse(`Model request failed (${upstream.status}): ${detail}`, 502);
      }

      const payload = JSON.parse(responseText);
      const modelText =
        body.config.protocol === "anthropic"
          ? payload?.content?.find((item: { type?: string }) => item.type === "text")?.text
          : payload?.choices?.[0]?.message?.content;

      if (typeof modelText !== "string" || !modelText.trim()) {
        return errorResponse("The model returned an empty response", 502);
      }

      const changes = aiChangeSetSchema.parse(extractJson(modelText));
      return NextResponse.json({ ok: true, changes });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        `Schema validation failed: ${error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("The model request timed out after 60 seconds", 504);
    }
    return errorResponse(error instanceof Error ? error.message : String(error), 500);
  }
}

