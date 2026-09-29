import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

// One client for the whole process. maxRetries covers 429/5xx bursts when
// hundreds of dates run in parallel.
let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ maxRetries: 6, timeout: 180_000 });
  return client;
}

export const MODELS = {
  analysis: process.env.ANALYSIS_MODEL || "claude-opus-5-5",
  date: process.env.DATE_MODEL || "claude-opus-5-5",
};

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

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

// Server-side refusal fallback: if the primary model declines, the API reruns
// the request on a fallback model inside the same call.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

export type Content = Anthropic.Beta.BetaContentBlockParam[] | string;

function textOf(msg: Anthropic.Beta.BetaMessage) {
  return msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Free-text call (used for each conversational turn on a date). */
export async function chat(opts: {
  system: string;
  user: Content;
  model?: string;
  effort?: Effort;
  maxTokens?: number;
}): Promise<string> {
  return withSlot(async () => {
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
  });
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
  return withSlot(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await getClient().beta.messages.parse({
        model: opts.model || MODELS.analysis,
        max_tokens: opts.maxTokens ?? 16000,
        ...FALLBACK,
        output_config: {
          effort: opts.effort ?? "medium",
          format: betaZodOutputFormat(opts.schema),
        },
        system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: opts.user }],
      });
      if (res.stop_reason === "refusal") throw new Error("Model declined this request");
      if (res.parsed_output) return res.parsed_output as z.infer<S>;
    }
    throw new Error("Structured output could not be parsed");
  });
}
