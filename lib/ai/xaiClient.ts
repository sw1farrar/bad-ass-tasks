import "server-only";

export type XaiVisionImage = {
  dataUrl: string;
  label?: string;
};

type XaiChatOptions = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  expectJson?: boolean;
  images?: XaiVisionImage[];
};

export type XaiChatFailure =
  | "missing_key"
  | "sim_forced"
  | "http_error"
  | "network_error"
  | "empty_response";

export type XaiChatResult =
  | { ok: true; content: string }
  | { ok: false; error: XaiChatFailure; status?: number; detail?: string };

const XAI_KEY_PLACEHOLDERS = new Set([
  "",
  "paste_your_xai_key_here",
  "xai-your-api-key-here",
  "your-api-key-here",
]);

function resolveApiKey(): string {
  const raw =
    process.env.XAI_API_KEY?.trim() || process.env.NEXT_PUBLIC_XAI_API_KEY?.trim() || "";
  if (XAI_KEY_PLACEHOLDERS.has(raw.toLowerCase())) return "";
  return raw;
}

/** Why Grok is unavailable before making a request. */
export function getXaiUnavailableReason(): XaiChatFailure | null {
  if (process.env.AI_FORCE_SIM === "1" || process.env.NEXT_PUBLIC_AI_FORCE_SIM === "1") {
    return "sim_forced";
  }
  if (!resolveApiKey()) return "missing_key";
  return null;
}

export function isXaiConfigured(): boolean {
  return getXaiUnavailableReason() === null;
}

export async function callXaiChat(options: XaiChatOptions): Promise<XaiChatResult> {
  const unavailable = getXaiUnavailableReason();
  if (unavailable) {
    return { ok: false, error: unavailable };
  }

  const apiKey = resolveApiKey();
  const userContent =
    options.images?.length ?
      [
        { type: "text", text: options.userPrompt },
        ...options.images.map((image) => ({
          type: "image_url",
          image_url: {
            url: image.dataUrl,
            detail: "high",
          },
        })),
      ]
    : options.userPrompt;

  const body: Record<string, unknown> = {
    model: process.env.XAI_MODEL?.trim() || "grok-4.3",
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 400,
  };

  if (options.expectJson) {
    body.response_format = { type: "json_object" };
  }

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.images?.length ? 90_000 : 45_000),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const errBody = (await res.json()) as { error?: { message?: string } };
        detail = errBody.error?.message ?? "";
      } catch {
        detail = await res.text().catch(() => "");
      }
      console.error("[xAI] request failed", res.status, detail || res.statusText);
      return {
        ok: false,
        error: "http_error",
        status: res.status,
        detail: detail.slice(0, 200) || res.statusText,
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, error: "empty_response" };
    }
    return { ok: true, content };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "network error";
    console.error("[xAI] network error", detail);
    return { ok: false, error: "network_error", detail };
  }
}