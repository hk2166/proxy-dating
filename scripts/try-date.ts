// Run one speed date (and optionally a full date) between two analyzed seed people and print it:
//   npx tsx --env-file=.env scripts/try-date.ts <idA> <idB> [full]
import { fullDate, speedDate } from "../src/lib/dating";
import { seedFiles } from "../src/lib/store";

async function main() {
  const [x, y, full] = process.argv.slice(2);
  const people = seedFiles.read().people;
  const a = people.find((p) => p.id === x)!;
  const b = people.find((p) => p.id === y)!;
  const t = Date.now();
  const log = (e: { type: string; message?: { speaker: string; text: string }; venue?: string }) => {
    if (e.type === "date:message") console.log(`  [${((Date.now() - t) / 1000).toFixed(0)}s] ${e.message!.speaker.toUpperCase()}: ${e.message!.text}`);
    if (e.type === "date:venue") console.log(`  VENUE: ${e.venue}`);
  };
  const s = await speedDate(a, b, log);
  console.log("SPEED scores", s.scoreA?.overall, s.scoreB?.overall, "|", s.scoreA?.verdict, "|", s.scoreB?.verdict);
  if (full) {
    const f = await fullDate(a, b, s, log);
    console.log("FULL scores", f.scoreA?.overall, f.scoreB?.overall);
    console.log("A report:", f.scoreA?.reportToPrincipal);
    console.log("B report:", f.scoreB?.reportToPrincipal);
  }
  console.log(`took ${((Date.now() - t) / 1000).toFixed(0)}s`);
}
main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
