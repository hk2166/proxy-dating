// Analyze one person end-to-end and print the result (no saving):
//   npx tsx --env-file=.env scripts/try-person.ts <linkedin-url> <instagram-url> [out.json]
import fs from "node:fs";
import { analyzePerson } from "../src/lib/pipeline";

async function main() {
  const [li, ig, out] = process.argv.slice(2);
  const t = Date.now();
  const p = await analyzePerson(li, ig, (e) => {
    if (e.type === "step") console.log(`[${((Date.now() - t) / 1000).toFixed(0)}s] ${e.step} ${e.status} ${e.detail || ""}`);
  });
  if (out) fs.writeFileSync(out, JSON.stringify(p, null, 2));
  console.log(JSON.stringify({ headline: p.analysis?.headline, vibe: p.analysis?.vibe, needs: p.analysis?.needs.map((n) => n.need) }, null, 2));
}
main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
