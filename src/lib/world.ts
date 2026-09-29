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

export function stats(w: World) {
  const speed = w.dates.filter((d) => d.kind === "speed").length;
  const full = w.dates.filter((d) => d.kind === "full").length;
  const lines = w.dates.reduce((n, d) => n + d.messages.length, 0);
  const mutual = w.dates.filter((d) => d.kind === "full" && d.scoreA?.secondDate && d.scoreB?.secondDate).length;
  return { people: w.people.length, speed, full, lines, mutual };
}

export function bestDates(w: World, kind: "full" | "speed", n: number) {
  return w.dates
    .filter((d) => d.kind === kind && d.scoreA && d.scoreB)
    .sort((a, b) => mutualScore(b) - mutualScore(a))
    .slice(0, n);
}
