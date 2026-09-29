import { allRankings } from "./ranking";
import { mutualScore } from "./dating";
import { listDates, listPeople } from "./store";
import type { DateRecord, Person, RankEntry } from "./types";

export interface World {
  people: Person[];
  byId: Map<string, Person>;
  dates: DateRecord[];
  rankings: Record<string, RankEntry[]>;
}

export async function loadWorld(): Promise<World> {
  const [all, dates] = await Promise.all([listPeople(), listDates()]);
  const people = all.filter((p) => p.status === "ready" && p.analysis);
  return { people, byId: new Map(people.map((p) => [p.id, p])), dates, rankings: allRankings(people, dates) };
}

/** Pairs where each agent's final #1 pick (Round 3) is the other person. */
export function mutualPicks(w: World): [Person, Person][] {
  const top = (p: Person) => w.rankings[p.id]?.[0]?.personId;
  const out: [Person, Person][] = [];
  for (const p of w.people) {
    const q = w.byId.get(top(p) || "");
    if (q && top(q) === p.id && p.id < q.id) out.push([p, q]);
  }
  return out;
}

export function stats(w: World) {
  const speed = w.dates.filter((d) => d.kind === "speed").length;
  const full = w.dates.filter((d) => d.kind === "full").length;
  const lines = w.dates.reduce((n, d) => n + d.messages.length, 0);
  return { people: w.people.length, speed, full, lines, mutual: mutualPicks(w).length };
}

export function bestDates(w: World, kind: "full" | "speed", n: number) {
  return w.dates
    .filter((d) => d.kind === kind && d.scoreA && d.scoreB)
    .sort((a, b) => mutualScore(b) - mutualScore(a))
    .slice(0, n);
}
