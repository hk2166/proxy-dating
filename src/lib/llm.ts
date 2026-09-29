import { z } from "zod";

// Two interchangeable providers behind the same two functions (chat, structured),
// both speaking the chat-completions API:
//   openai     strict JSON-schema outputs, vision (default)
//   deepseek   JSON mode + zod validation, text only
// LLM_PROVIDER picks one; otherwise the first provider with a key set is used.
type Provider = "openai" | "deepseek";
export const PROVIDER: Provider =
  process.env.LLM_PROVIDER === "openai" || process.env.LLM_PROVIDER === "deepseek"
    ? process.env.LLM_PROVIDER
    : process.env.OPENAI_API_KEY || !process.env.DEEPSEEK_API_KEY
      ? "openai"
      : "deepseek";

const DEFAULT_MODEL = PROVIDER === "openai" ? process.env.OPENAI_MODEL || "gpt-5.4" : process.env.DEEPSEEK_MODEL || "deepseek-chat";
export const MODELS = {
  analysis: process.env.ANALYSIS_MODEL || DEFAULT_MODEL,
  date: process.env.DATE_MODEL || DEFAULT_MODEL,
};

export const SUPPORTS_VISION = PROVIDER === "openai";

type Effort = "low" | "medium" | "high";
export type ContentBlock = { type: "text"; text: string } | { type: "image"; mediaType: string; data: string };
export type Content = string | ContentBlock[];

// cap parallel calls so hundreds of dates don't trip rate limits
const MAX_CONCURRENCY = Number(process.env.LLM_CONCURRENCY || 16);
let active = 0;
const queue: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENCY) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

const API = {
  openai: { url: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1") + "/chat/completions", key: () => process.env.OPENAI_API_KEY },
  deepseek: { url: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com") + "/chat/completions", key: () => process.env.DEEPSEEK_API_KEY },
};
// Reasoning models (gpt-5*, o-series) take max_completion_tokens + reasoning_effort and no temperature.
const isReasoning = (model: string) => /^(gpt-5|gpt-6|o\d)/.test(model) && !/chat-latest/.test(model);

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

function toParts(user: Content): string | Part[] {
  if (typeof user === "string") return user;
  const parts: Part[] = [];
  for (const b of user) {
    if (b.type === "text") parts.push({ type: "text", text: b.text });
    else if (SUPPORTS_VISION) parts.push({ type: "image_url", image_url: { url: `data:${b.mediaType};base64,${b.data}` } });
  }
  return parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
}

function withFeedback(content: string | Part[], feedback: string): string | Part[] {
  if (!feedback) return content;
  return typeof content === "string" ? `${content}\n\n${feedback}` : [...content, { type: "text", text: feedback }];
}

function body(model: string, maxTokens: number, effort: Effort, temperature: number) {
  if (isReasoning(model)) return { model, max_completion_tokens: maxTokens, reasoning_effort: effort === "high" ? "medium" : "low" };
  return { model, max_tokens: Math.min(maxTokens, 8000), temperature };
}

async function call(payload: Record<string, unknown>): Promise<string> {
  const api = API[PROVIDER];
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(api.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${api.key()}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (e) {
      if (attempt < 5) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string | null; refusal?: string | null } }[] };
      const msg = data.choices?.[0]?.message;
      if (msg?.refusal) throw new Error("Model declined this request");
      const content = msg?.content?.trim();
      if (content) return content;
      if (attempt < 3) continue;
      throw new Error(`${PROVIDER} returned an empty response`);
    }
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 8) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait + Math.random() * 1000));
      continue;
    }
    throw new Error(`${PROVIDER} ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function chat(opts: { system: string; user: Content; model?: string; effort?: Effort; maxTokens?: number }): Promise<string> {
  return withSlot(() =>
    call({
      ...body(opts.model || MODELS.date, opts.maxTokens ?? 3000, opts.effort ?? "low", 1.1),
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: toParts(opts.user) },
      ],
    }),
  );
}

export async function structured<S extends z.ZodType>(opts: {
  system: string;
  user: Content;
  schema: S;
  model?: string;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  return withSlot(async () => {
    const schema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
    delete schema.$schema;
    // OpenAI enforces the schema (strict); DeepSeek only has JSON mode, so the schema goes in the prompt.
    const format =
      PROVIDER === "openai" ? { type: "json_schema", json_schema: { name: "output", strict: true, schema } } : { type: "json_object" };
    const system =
      PROVIDER === "openai"
        ? opts.system
        : `${opts.system}\n\nRespond with ONE json object (no markdown, no commentary) that validates against this JSON Schema:\n${JSON.stringify(schema)}`;
    let feedback = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await call({
        ...body(opts.model || MODELS.analysis, opts.maxTokens ?? 16000, opts.effort ?? "medium", 0.8),
        response_format: format,
        messages: [
          { role: "system", content: system },
          { role: "user", content: withFeedback(toParts(opts.user), feedback) },
        ],
      });
      try {
        const parsed = opts.schema.safeParse(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")));
        if (parsed.success) return parsed.data as z.infer<S>;
        feedback = `(Your previous json did not validate: ${parsed.error.message.slice(0, 500)}. Return corrected json.)`;
      } catch {
        feedback = "(Your previous reply was not valid json. Return only a json object.)";
      }
    }
    throw new Error("Structured output could not be parsed");
  });
}
