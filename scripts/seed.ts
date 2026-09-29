/**
 * Builds the committed demo example: the 25+ real people in data/people.json.
 *
 *   npx tsx --env-file=.env scripts/seed.ts            # everything (resumable)
 *   npx tsx --env-file=.env scripts/seed.ts analyze    # just scrape + analyze
 *   npx tsx --env-file=.env scripts/seed.ts speed      # round 1 (all pairs)
 *   npx tsx --env-file=.env scripts/seed.ts full       # round 2 (top mutual matches)
 *   npx tsx --env-file=.env scripts/seed.ts decide     # round 3 (each agent's final ranking)
 *
 * Progress is checkpointed to data/seed/*.json, so re-running skips finished work.
 */
import fs from "node:fs";
import path from "node:path";
import { analyzePerson } from "../src/lib/pipeline";
import { scrapeBatch } from "../src/lib/scrape";
import { parseInstagram } from "../src/lib/urls";
import { fullDate, pairId, pickFullDates, speedDate } from "../src/lib/dating";
import { decide } from "../src/lib/decide";
import { seedFiles } from "../src/lib/store";
import type { DateRecord, Person, Sources } from "../src/lib/types";

const FULL_DATES_PER_PERSON = Number(process.env.FULL_DATES_PER_PERSON || 2);
const ANALYZE_CONCURRENCY = Number(process.env.ANALYZE_CONCURRENCY || 6);

type Entry = { name: string; linkedin: string; instagram: string };
const list: Entry[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "people.json"), "utf8"));

const state = seedFiles.read();
const people = new Map<string, Person>(state.people.map((p) => [p.id, p]));
const dates = new Map<string, DateRecord>(state.dates.map((d) => [d.id, d]));

let dirty = false;
function save() {
  seedFiles.write([...people.values()], [...dates.values()]);
  dirty = false;
}
const timer = setInterval(() => dirty && save(), 5000);

async function saveAvatar(p: Person): Promise<string | undefined> {
  const url = p.sources?.instagram.profilePic || p.sources?.linkedin.pictureUrl;
  if (!url) return undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(process.cwd(), "public", "avatars", `${p.id}.jpg`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    return `/avatars/${p.id}.jpg`;
  } catch {
    return undefined;
  }
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const q = [...items];
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (q.length) await fn(q.shift()!);
    }),
  );
}

// Scraped sources are cached locally so a failed analysis never re-scrapes.
const CACHE = path.join(process.cwd(), "data", ".cache", "sources.json");
function loadCache(): Record<string, Sources> {
  try {
    return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    return {};
  }
}

async function analyzeAll() {
  const done = new Set([...people.values()].filter((p) => p.status === "ready").map((p) => p.instagramUrl));
  const todo = list.filter((e) => !done.has(parseInstagram(e.instagram)!.url));
  console.log(`analyze: ${todo.length} to do, ${done.size} done`);
  if (!todo.length) return;

  const cache = loadCache();
  const unscraped = todo.filter((e) => !cache[parseInstagram(e.instagram)!.handle]);
  if (unscraped.length) {
    const t = Date.now();
    console.log(`scraping ${unscraped.length} people in one batch per actor…`);
    const got = await scrapeBatch(unscraped);
    for (const [handle, r] of got) {
      if (r instanceof Error) console.log(`  ✗ scrape @${handle}: ${r.message}`);
      else cache[handle] = r;
    }
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(cache));
    console.log(`scraped in ${((Date.now() - t) / 1000).toFixed(0)}s`);
  }

  await pool(todo, ANALYZE_CONCURRENCY, async (e) => {
    const sources = cache[parseInstagram(e.instagram)!.handle];
    if (!sources) return;
    const t = Date.now();
    try {
      const p = await analyzePerson(e.linkedin, e.instagram, () => {}, { origin: "seed", avatar: saveAvatar, sources });
      people.set(p.id, p);
      dirty = true;
      console.log(`  ✓ ${p.name} (${((Date.now() - t) / 1000).toFixed(0)}s) — ${p.analysis?.headline}`);
    } catch (err) {
      console.log(`  ✗ ${e.name}: ${err instanceof Error ? err.message : err}`);
    }
  });
  save();
}

function ready() {
  return [...people.values()].filter((p) => p.status === "ready" && p.analysis);
}

async function speedAll() {
  const ps = ready();
  const pairs: [Person, Person][] = [];
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) if (!dates.get(pairId("speed", ps[i].id, ps[j].id))?.scoreB) pairs.push([ps[i], ps[j]]);
  console.log(`speed dates: ${pairs.length} to run (${ps.length} people)`);
  let n = 0;
  await pool(pairs, Number(process.env.DATE_CONCURRENCY || 40), async ([x, y]) => {
    try {
      const d = await speedDate(x, y);
      dates.set(d.id, d);
      dirty = true;
      if (++n % 10 === 0) console.log(`  ${n}/${pairs.length}  latest: ${x.name} × ${y.name} → ${d.scoreA?.overall}/${d.scoreB?.overall}`);
    } catch (err) {
      console.log(`  ✗ ${x.name} × ${y.name}: ${err instanceof Error ? err.message : err}`);
    }
  });
  save();
}

async function fullAll() {
  const ps = ready();
  const byId = new Map(ps.map((p) => [p.id, p]));
  const speed = [...dates.values()].filter((d) => d.kind === "speed");
  const pairs = pickFullDates(
    ps.map((p) => p.id),
    speed,
    FULL_DATES_PER_PERSON,
  ).filter(([a, b]) => !dates.get(pairId("full", a, b))?.scoreB);
  console.log(`full dates: ${pairs.length} to run`);
  let n = 0;
  await pool(pairs, Number(process.env.FULL_CONCURRENCY || 12), async ([a, b]) => {
    try {
      const sd = dates.get(pairId("speed", a, b));
      const d = await fullDate(byId.get(a)!, byId.get(b)!, sd);
      dates.set(d.id, d);
      dirty = true;
      console.log(`  ${++n}/${pairs.length} ${byId.get(a)!.name} × ${byId.get(b)!.name} @ ${d.venue} → ${d.scoreA?.overall}/${d.scoreB?.overall}`);
    } catch (err) {
      console.log(`  ✗ ${a} × ${b}: ${err instanceof Error ? err.message : err}`);
    }
  });
  save();
}

async function decideAll() {
  const ps = ready();
  const ds = [...dates.values()];
  console.log(`round 3: ${ps.length} agents make their final call`);
  await pool(ps, 12, async (p) => {
    try {
      const d = await decide(p, ps, ds);
      if (!d) return;
      p.decision = d;
      dirty = true;
      console.log(`  ${p.name} → ${ps.find((q) => q.id === d.order[0])?.name}`);
    } catch (err) {
      console.log(`  ✗ ${p.name}: ${err instanceof Error ? err.message : err}`);
    }
  });
  save();
}

async function main() {
  const step = process.argv[2] || "all";
  if (step === "all" || step === "analyze") await analyzeAll();
  if (step === "all" || step === "speed") await speedAll();
  if (step === "all" || step === "full") await fullAll();
  if (step === "all" || step === "decide") await decideAll();
  clearInterval(timer);
  save();
  const ds = [...dates.values()];
  console.log(
    `done: ${ready().length} people, ${ds.filter((d) => d.kind === "speed").length} speed dates, ${ds.filter((d) => d.kind === "full").length} full dates`,
  );
}

main().catch((e) => {
  console.error(e);
  save();
  process.exit(1);
});
