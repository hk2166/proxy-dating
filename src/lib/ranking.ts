import type { DateRecord, Person, RankEntry, Scorecard } from "./types";

// How a ranking is computed for person P and candidate Q:
//   myView    = what P's agent concluded about Q  (full date 65% + speed date 35% when both exist)
//   theirView = what Q's agent concluded about P  (same blend)
//   fit       = 0.65 * myView + 0.35 * theirView  (+5 if both agents want a second date after a full date)
// P's own needs dominate, but a match only works if it's mutual.

function sideOf(d: DateRecord, me: string): { mine?: Scorecard; theirs?: Scorecard; other: string } {
  return d.a === me ? { mine: d.scoreA, theirs: d.scoreB, other: d.b } : { mine: d.scoreB, theirs: d.scoreA, other: d.a };
}

function blend(speed?: number, full?: number) {
  if (full != null && speed != null) return 0.65 * full + 0.35 * speed;
  return full ?? speed ?? 0;
}

export function rankFor(personId: string, people: Person[], dates: DateRecord[], opts: { useDecision?: boolean } = {}): RankEntry[] {
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
    // Only a full date's second-date call counts: after a 6-line speed date the agents
    // say "yes" almost every time, so that flag carries no signal.
    const mutual = !!(f?.mine?.secondDate && f?.theirs?.secondDate);
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
  out.sort((x, y) => y.fit - x.fit || y.myView - x.myView);

  // Round 3: the agent's own final ordering of its shortlist takes precedence.
  const decision = opts.useDecision === false ? undefined : people.find((p) => p.id === personId)?.decision;
  if (!decision) return out;
  const byId = new Map(out.map((e) => [e.personId, e]));
  const top: RankEntry[] = [];
  for (const id of decision.order) {
    const e = byId.get(id);
    if (e) top.push({ ...e, agentRank: top.length + 1, reason: decision.reasons[id] || e.reason });
  }
  const picked = new Set(top.map((e) => e.personId));
  return [...top, ...out.filter((e) => !picked.has(e.personId))];
}

export function allRankings(people: Person[], dates: DateRecord[]) {
  const map: Record<string, RankEntry[]> = {};
  for (const p of people) map[p.id] = rankFor(p.id, people, dates);
  return map;
}
