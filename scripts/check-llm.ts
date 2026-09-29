// Quick check that the LLM key and request shape work: npx tsx --env-file=.env scripts/check-llm.ts
import { z } from "zod";
import { chat, structured } from "../src/lib/llm";

async function main() {
  let t = Date.now();
  const s = await structured({
    system: "You extract data.",
    user: "Maya runs ultramarathons and bakes sourdough on Sundays.",
    schema: z.object({ name: z.string(), hobbies: z.array(z.string()) }),
    effort: "low",
    maxTokens: 2000,
  });
  console.log("structured ok", JSON.stringify(s), ((Date.now() - t) / 1000).toFixed(1) + "s");
  t = Date.now();
  const c = await chat({ system: "You are a witty dating agent. Reply in one sentence.", user: "Open a speed date with someone who loves climbing.", maxTokens: 2000 });
  console.log("chat ok:", c, ((Date.now() - t) / 1000).toFixed(1) + "s");
}
main().catch((e) => {
  console.error("FAILED:", e?.status, e?.message);
  process.exit(1);
});
