// Quick check that the LLM chain works: npx tsx --env-file=.env scripts/check-llm.ts
import { z } from "zod";
import { chat, structured } from "../src/lib/llm";

async function main() {
  let t = Date.now();
  const m1: { model?: string } = {};
  const s = await structured({
    system: "You extract data.",
    user: "Maya runs ultramarathons and bakes sourdough on Sundays.",
    schema: z.object({ name: z.string(), hobbies: z.array(z.string()) }),
    effort: "low",
    maxTokens: 2000,
    meta: m1,
  });
  console.log(`structured ok via ${m1.model}`, JSON.stringify(s), ((Date.now() - t) / 1000).toFixed(1) + "s");
  t = Date.now();
  const m2: { model?: string } = {};
  const c = await chat({ system: "You are a witty dating agent. Reply in one sentence.", user: "Open a speed date with someone who loves climbing.", maxTokens: 2000, meta: m2 });
  console.log(`chat ok via ${m2.model}:`, c, ((Date.now() - t) / 1000).toFixed(1) + "s");
}
main().catch((e) => {
  console.error("FAILED:", e?.message);
  process.exit(1);
});
