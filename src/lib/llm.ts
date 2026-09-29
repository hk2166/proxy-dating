import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Interchangeable providers behind the same two functions (chat, structured):
//   anthropic  Claude via the Anthropic SDK (structured outputs, vision, refusal fallback)
//   openai     OpenAI chat completions (strict JSON-schema outputs, vision)
//   deepseek   DeepSeek chat completions (JSON mode + zod validation, text only)
// LLM_PROVIDER picks one; otherwise the first provider with a key set is used.
type Provider = "anthropic" | "openai" | "deepseek";
export const PROVIDER: Provider = (["anthropic", "openai", "deepseek"] as const).includes(process.env.LLM_PROVIDER as Provider)
  ? (process.env.LLM_PROVIDER as Provider)
  : process.env.OPENAI_API_KEY
    ? "openai"
    : process.env.DEEPSEEK_API_KEY
      ? "deepseek"
      : "anthropic";

const DEFAULT_MODEL = {
  anthropic: "claude-opus-5-5",
  openai: process.env.OPENAI_MODEL || "gpt-5.4",
  deepseek: process.env.DEEPSEEK_MODEL || "deepseek-chat",
}[PROVIDER];
export const MODELS = {
  analysis: process.env.ANALYSIS_MODEL || DEFAULT_MODEL,
  date: process.env.DATE_MODEL || DEFAULT_MODEL,
};

/** Whether the active provider can look at images (Instagram photos). */
export const SUPPORTS_VISION = PROVIDER !== "deepseek";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type Content = Anthropic.Beta.BetaContentBlockParam[] | string;

// ---- concurrency limiter (shared by every call in this process) ----
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

// ============================ Anthropic ============================
// One client for the whole process. maxRetries covers 429/5xx bursts when
// hundreds of dates run in parallel.
let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ maxRetries: 6, timeout: 180_000 });
  return client;
}

// Server-side refusal fallback: if the primary model declines, the API reruns
// the request on a fallback model inside the same call.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

function textOf(msg: Anthropic.Beta.BetaMessage) {
  return msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function anthropicChat(opts: { system: string; user: Content; model?: string; effort?: Effort; maxTokens?: number }) {
  const res = await getClient().beta.messages.create({
    model: opts.model || MODELS.date,
    max_tokens: opts.maxTokens ?? 4000,
    ...FALLBACK,
    output_config: { effort: opts.effort ?? "low" },
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.user }],
  });
  if (res.stop_reason === "refusal") throw new Error("Model declined this turn");
  return textOf(res);
}

async function anthropicStructured<S extends z.ZodType>(opts: {
  system: string;
  user: Content;
  schema: S;
  model?: string;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getClient().beta.messages.parse({
      model: opts.model || MODELS.analysis,
      max_tokens: opts.maxTokens ?? 16000,
      ...FALLBACK,
      output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: opts.user }],
    });
    if (res.stop_reason === "refusal") throw new Error("Model declined this request");
    if (res.parsed_output) return res.parsed_output as z.infer<S>;
  }
  throw new Error("Structured output could not be parsed");
}

// ===================== OpenAI-compatible (OpenAI, DeepSeek) =====================
const COMPAT = {
  openai: { url: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1") + "/chat/completions", key: () => process.env.OPENAI_API_KEY },
  deepseek: { url: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com") + "/chat/completions", key: () => process.env.DEEPSEEK_API_KEY },
};
// Reasoning models (gpt-5*, o-series) take max_completion_tokens + reasoning_effort and no temperature.
const isReasoning = (model: string) => /^(gpt-5|gpt-6|o\d)/.test(model) && !/chat-latest/.test(model);

type CompatPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/** Anthropic-style content → chat-completions content (images become data URLs; dropped without vision). */
function toCompat(user: Content): string | CompatPart[] {
  if (typeof user === "string") return user;
  const parts: CompatPart[] = [];
  for (const b of user) {
    if (b.type === "text") parts.push({ type: "text", text: b.text });
    else if (b.type === "image" && SUPPORTS_VISION && b.source.type === "base64")
      parts.push({ type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } });
  }
  return parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
}

function withFeedback(content: string | CompatPart[], feedback: string): string | CompatPart[] {
  if (!feedback) return content;
  return typeof content === "string" ? `${content}\n\n${feedback}` : [...content, { type: "text", text: feedback }];
}

function compatBody(model: string, maxTokens: number, effort: Effort | undefined, temperature: number) {
  if (isReasoning(model)) {
    const reasoning_effort = effort === "high" || effort === "xhigh" || effort === "max" ? "medium" : "low";
    return { model, max_completion_tokens: maxTokens, reasoning_effort };
  }
  return { model, max_tokens: Math.min(maxTokens, 8000), temperature };
}

async function compatCall(body: Record<string, unknown>): Promise<string> {
  const api = COMPAT[PROVIDER as "openai" | "deepseek"];
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(api.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${api.key()}` },
        body: JSON.stringify(body),
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

async function compatChat(opts: { system: string; user: Content; model?: string; effort?: Effort; maxTokens?: number }) {
  const model = opts.model || MODELS.date;
  return compatCall({
    ...compatBody(model, opts.maxTokens ?? 3000, opts.effort ?? "low", 1.1),
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: toCompat(opts.user) },
    ],
  });
}

async function compatStructured<S extends z.ZodType>(opts: {
  system: string;
  user: Content;
  schema: S;
  model?: string;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const model = opts.model || MODELS.analysis;
  const schema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  delete schema.$schema;
  // OpenAI enforces the schema (strict); DeepSeek only has JSON mode, so the schema goes in the prompt.
  const format =
    PROVIDER === "openai"
      ? { type: "json_schema", json_schema: { name: "output", strict: true, schema } }
      : { type: "json_object" };
  const system =
    PROVIDER === "openai"
      ? opts.system
      : `${opts.system}\n\nRespond with ONE json object (no markdown, no commentary) that validates against this JSON Schema:\n${JSON.stringify(schema)}`;
  let feedback = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await compatCall({
      ...compatBody(model, opts.maxTokens ?? 16000, opts.effort ?? "medium", 0.8),
      response_format: format,
      messages: [
        { role: "system", content: system },
        { role: "user", content: withFeedback(toCompat(opts.user), feedback) },
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
}

// ============================ public API ============================

/** Free-text call (used for each conversational turn on a date). */
export async function chat(opts: { system: string; user: Content; model?: string; effort?: Effort; maxTokens?: number }): Promise<string> {
  return withSlot(() => (PROVIDER === "anthropic" ? anthropicChat(opts) : compatChat(opts)));
}

/** Structured call: output is validated against a zod schema. */
export async function structured<S extends z.ZodType>(opts: {
  system: string;
  user: Content;
  schema: S;
  model?: string;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  return withSlot(() => (PROVIDER === "anthropic" ? anthropicStructured(opts) : compatStructured(opts)));
}
