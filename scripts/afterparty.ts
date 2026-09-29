// npx tsx --env-file=.env scripts/afterparty.ts
import fs from "node:fs";
import path from "node:path";
import { makeAfterparty } from "../src/lib/afterparty";
import { allRankings } from "../src/lib/ranking";
import { seedFiles } from "../src/lib/store";
import type { Person } from "../src/lib/types";

async function main() {
  const { people, dates } = seedFiles.read();
  const ready = people.filter((p) => p.analysis);
  const rankings = allRankings(ready, dates);
  const byId = new Map(ready.map((p) => [p.id, p]));
  const top = (id: string) => rankings[id]?.[0]?.personId;
  const pairs: [Person, Person][] = ready
    .filter((p) => top(p.id) && top(top(p.id)!) === p.id && p.id < top(p.id)!)
    .map((p) => [p, byId.get(top(p.id)!)!]);

  console.log(`${ready.length} agents, ${pairs.length} mutual picks — throwing the afterparty…`);
  const party = await makeAfterparty(ready, dates, rankings, pairs);
  fs.writeFileSync(path.join(seedFiles.dir, "afterparty.json"), JSON.stringify(party, null, 1));
  console.log(`gossip ${party.gossip.length}, rejections ${party.rejections.length}, futures ${party.futures.length}`);
  for (const m of party.gossip.slice(0, 6)) console.log(`  ${m.from}: ${m.text}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
