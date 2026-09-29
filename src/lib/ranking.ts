import type { DateRecord, Person, RankEntry, Scorecard } from "./types";

// How a ranking is computed for person P and candidate Q:
//   myView    = what P's agent concluded about Q  (full date 65% + speed date 35% when both exist)
//   theirView = what Q's agent concluded about P  (same blend)
//   fit       = 0.65 * myView + 0.35 * theirView  (+5 if both agents booked a second date)
// P's own needs dominate, but a match only works if it's mutual.

function sideOf(d: DateRecord, me: string): { mine?: Scorecard; theirs?: Scorecard; other: string } {
  return d.a === me ? { mine: d.scoreA, theirs: d.scoreB, other: d.b } : { mine: d.scoreB, theirs: d.scoreA, other: d.a };
}

function blend(speed?: number, full?: number) {
  if (full != null && speed != null) return 0.65 * full + 0.35 * speed;
  return full ?? speed ?? 0;
}

export function rankFor(personId: string, people: Person[], dates: DateRecord[]): RankEntry[] {
  const ids = new Set(people.map((p) => p.id));
  const byOther = new Map<string, { speed?: DateRecord; full?: DateRecord }>();
  for (const d of dates) {
    if (d.a !== personId && d.b !== personId) continue;
    const other = d.a === personId ? d.b : d.a;
    if (!ids.has(other)) continue;
    const slot = byOther.get(other) || {};
    slot[d.kind] = d;
    byOther.set(other, slot);
  }
  const out: RankEntry[] = [];
  for (const [other, { speed, full }] of byOther) {
    const s = speed && sideOf(speed, personId);
    const f = full && sideOf(full, personId);
    if (!s?.mine && !f?.mine) continue;
    const myView = blend(s?.mine?.overall, f?.mine?.overall);
    const theirView = blend(s?.theirs?.overall, f?.theirs?.overall);
    const latestMine = f?.mine || s?.mine;
    const latestTheirs = f?.theirs || s?.theirs;
    const mutual = !!(latestMine?.secondDate && latestTheirs?.secondDate);
    out.push({
      personId: other,
      fit: Math.round(0.65 * myView + 0.35 * theirView + (mutual ? 5 : 0)),
      myView: Math.round(myView),
      theirView: Math.round(theirView),
      mutual,
      fullDate: !!f?.mine,
      reason: latestMine?.verdict || "",
      highlight: latestMine?.highlight || "",
      dateIds: [full?.id, speed?.id].filter(Boolean) as string[],
    });
  }
  return out.sort((x, y) => y.fit - x.fit || y.myView - x.myView);
}

export function allRankings(people: Person[], dates: DateRecord[]) {
  const map: Record<string, RankEntry[]> = {};
  for (const p of people) map[p.id] = rankFor(p.id, people, dates);
  return map;
}
