import { z } from "zod";

// Every call walks a chain of providers, cheapest first (LLM_CHAIN, default
// groq → deepseek → openai → anthropic). Each provider can have several comma-separated
// keys; busy keys cool down, dead keys (bad key, no credit) are skipped for good.

type Effort = "low" | "medium" | "high";
export type ContentBlock = { type: "text"; text: string } | { type: "image"; mediaType: string; data: string };
export type Content = string | ContentBlock[];

type Provider = {
  name: string;
  url: string;
  keys: string[];
  model: string;
  big?: string; // stronger model for the calls that matter most (reading + writing profiles)
  vision: boolean;
  schema: "strict" | "json" | "prompt"; // how structured output is requested
};

const keys = (v?: string) => (v || "").split(",").map((k) => k.trim()).filter(Boolean);

const PROVIDERS: Record<string, Provider> = {
  groq: {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keys: keys(process.env.GROQ_API_KEY).filter((k) => k.startsWith("gsk_")),
    model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    big: process.env.GROQ_BIG_MODEL || "openai/gpt-oss-120b",
    vision: false,
    schema: "json",
  },
  deepseek: {
    name: "deepseek",
    url: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com") + "/chat/completions",
    keys: keys(process.env.DEEPSEEK_API_KEY),
    model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
    vision: false,
    schema: "json",
  },
  openai: {
    name: "openai",
    url: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1") + "/chat/completions",
    keys: keys(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5.4-nano",
    vision: true,
    schema: "strict",
  },
  anthropic: {
    name: "anthropic",
    url: "https://api.anthropic.com/v1/messages",
    keys: keys(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
    vision: true,
    schema: "prompt",
  },
};

const CHAIN = keys(process.env.LLM_CHAIN || "groq,deepseek,openai,anthropic")
  .map((n) => PROVIDERS[n])
  .filter((p) => p && p.keys.length);

// kept for callers that pass a model; the chain decides what actually runs
export const MODELS = { analysis: "analysis", date: "date" };
export const SUPPORTS_VISION = CHAIN.some((p) => p.vision);

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

const dead = new Set<string>();
const coolUntil = new Map<string, number>();
const turn = new Map<string, number>(); // round-robin per provider
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Req = { system: string; user: Content; maxTokens: number; effort: Effort; temperature: number; schema?: Record<string, unknown>; big?: boolean };

const hasImages = (c: Content) => typeof c !== "string" && c.some((b) => b.type === "image");

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

function openaiContent(c: Content, vision: boolean): string | Part[] {
  if (typeof c === "string") return c;
  const parts: Part[] = [];
  for (const b of c) {
    if (b.type === "text") parts.push({ type: "text", text: b.text });
    else if (vision) parts.push({ type: "image_url", image_url: { url: `data:${b.mediaType};base64,${b.data}` } });
  }
  return parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
}

function anthropicContent(c: Content) {
  if (typeof c === "string") return c;
  return c.map((b) =>
    b.type === "text" ? { type: "text", text: b.text } : { type: "image", source: { type: "base64", media_type: b.mediaType, data: b.data } },
  );
}

function request(p: Provider, key: string, r: Req): { url: string; headers: Record<string, string>; body: unknown } {
  const model = (r.big && p.big) || p.model;
  const jsonHint = r.schema && p.schema !== "strict" ? `\n\nReply with ONE json object (no markdown) that validates against this JSON Schema:\n${JSON.stringify(r.schema)}` : "";
  if (p.name === "anthropic")
    return {
      url: p.url,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: {
        model,
        max_tokens: Math.min(r.maxTokens, 8000),
        temperature: Math.min(r.temperature, 1),
        system: r.system + jsonHint,
        messages: [{ role: "user", content: anthropicContent(r.user) }],
      },
    };

  const reasoning = /^(gpt-5|gpt-6|o\d)/.test(model) || model.includes("gpt-oss");
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: r.system + jsonHint },
      { role: "user", content: openaiContent(r.user, p.vision) },
    ],
  };
  if (reasoning) {
    body.max_completion_tokens = r.maxTokens;
    body.reasoning_effort = r.effort === "high" ? "medium" : "low";
    if (p.name === "groq") body.temperature = Math.min(r.temperature, 1);
  } else {
    body.max_tokens = Math.min(r.maxTokens, 8000);
    body.temperature = r.temperature;
  }
  if (r.schema) body.response_format = p.schema === "strict" ? { type: "json_schema", json_schema: { name: "output", strict: true, schema: r.schema } } : { type: "json_object" };
  return { url: p.url, headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body };
}

function textOf(p: Provider, data: Record<string, unknown>): string {
  if (p.name === "anthropic") return ((data.content as { type: string; text?: string }[]) || []).map((b) => b.text || "").join("").trim();
  const msg = (data.choices as { message?: { content?: string | null; refusal?: string | null } }[])?.[0]?.message;
  if (msg?.refusal) throw new Error("Model declined this request");
  return (msg?.content || "").trim();
}

/** Run one request down the chain. Returns the text and which model produced it. */
async function run(r: Req): Promise<{ text: string; model: string }> {
  const vision = hasImages(r.user);
  let chain = vision ? CHAIN.filter((p) => p.vision) : CHAIN;
  if (!chain.length) chain = CHAIN; // nobody can see images: send the text only
  if (!chain.length) throw new Error("No LLM keys configured");
  const errors: string[] = [];

  for (let round = 0; round < 6; round++) {
    let soonest = Infinity;
    for (const p of chain) {
      const start = turn.get(p.name) || 0;
      turn.set(p.name, start + 1);
      for (let i = 0; i < p.keys.length; i++) {
        const key = p.keys[(start + i) % p.keys.length];
        const id = `${p.name}:${key.slice(-6)}`;
        if (dead.has(id)) continue;
        const until = coolUntil.get(id) || 0;
        if (until > Date.now()) {
          soonest = Math.min(soonest, until);
          continue;
        }
        const req = request(p, key, r);
        let res: Response;
        try {
          res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(120_000) });
        } catch (e) {
          errors.push(`${id} network: ${e instanceof Error ? e.message : e}`);
          coolUntil.set(id, Date.now() + 5_000);
          continue;
        }
        if (res.ok) {
          const text = textOf(p, (await res.json()) as Record<string, unknown>);
          if (text) return { text, model: (r.big && p.big) || p.model };
          errors.push(`${id} empty reply`);
          continue;
        }
        const body = (await res.text()).slice(0, 300);
        errors.push(`${id} ${res.status}: ${body.slice(0, 120)}`);
        if (res.status === 401 || res.status === 403 || res.status === 402 || /insufficient|no credits|balance|quota/i.test(body)) dead.add(id);
        else if (res.status === 429 || res.status >= 500) {
          const retry = Number(res.headers.get("retry-after")) * 1000 || 15_000;
          coolUntil.set(id, Date.now() + Math.min(retry, 60_000));
        }
        // 400s (bad param, too long for this model…) just fall through to the next provider
      }
    }
    if (soonest === Infinity) break; // everything left is dead
    await sleep(Math.max(500, soonest - Date.now()));
  }
  throw new Error(`All LLM providers failed: ${errors.slice(-4).join(" | ")}`);
}

type Opts = { system: string; user: Content; model?: string; effort?: Effort; maxTokens?: number; meta?: { model?: string }; big?: boolean };

export async function chat(opts: Opts): Promise<string> {
  return withSlot(async () => {
    const out = await run({ system: opts.system, user: opts.user, maxTokens: opts.maxTokens ?? 3000, effort: opts.effort ?? "low", temperature: 1.1 });
    if (opts.meta) opts.meta.model = out.model;
    return out.text;
  });
}

export async function structured<S extends z.ZodType>(opts: Opts & { schema: S }): Promise<z.infer<S>> {
  return withSlot(async () => {
    const schema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
    delete schema.$schema;
    let feedback = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const user: Content = !feedback ? opts.user : typeof opts.user === "string" ? `${opts.user}\n\n${feedback}` : [...opts.user, { type: "text", text: feedback }];
      const out = await run({ system: opts.system, user, maxTokens: opts.maxTokens ?? 16000, effort: opts.effort ?? "medium", temperature: 0.8, schema, big: opts.big });
      try {
        const parsed = opts.schema.safeParse(JSON.parse(out.text.replace(/^```(?:json)?\s*|\s*```$/g, "")));
        if (parsed.success) {
          if (opts.meta) opts.meta.model = out.model;
          return parsed.data as z.infer<S>;
        }
        feedback = `(Your previous json did not validate: ${parsed.error.message.slice(0, 500)}. Return corrected json.)`;
      } catch {
        feedback = "(Your previous reply was not valid json. Return only a json object.)";
      }
    }
    throw new Error("Structured output could not be parsed");
  });
}
