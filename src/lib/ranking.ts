import type { DateRecord, Person, RankEntry, Scorecard } from "./types";

// How a ranking is computed for person P and candidate Q:
//   myView    = what P's agent concluded about Q  (full date 65% + speed date 35% when both exist)
//   theirView = what Q's agent concluded about P  (same blend)
//   fit       = 0.65 * myView + 0.35 * theirView  (+5 if both agents want a second date after a full date)
// P's own needs dominate, but a match only works if it's mutual.

// Different models score on different curves (one hands out 60s, another 80s),
// so each scorecard is mapped onto the overall distribution before blending.
function calibrator(dates: DateRecord[]) {
  const by = new Map<string, number[]>();
  const all: number[] = [];
  for (const d of dates)
    for (const s of [d.scoreA, d.scoreB]) {
      if (!s) continue;
      const m = s.model || d.model || "?";
      by.set(m, [...(by.get(m) || []), s.overall]);
      all.push(s.overall);
    }
  const stats = (xs: number[]) => {
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) || 1;
    return { mean, sd };
  };
  const g = all.length ? stats(all) : { mean: 0, sd: 1 };
  const per = new Map([...by].filter(([, xs]) => xs.length >= 30).map(([m, xs]) => [m, stats(xs)]));
  if (per.size < 2) return (s: Scorecard) => s.overall;
  return (s: Scorecard, d?: DateRecord) => {
    const m = per.get(s.model || d?.model || "?");
    return m ? Math.max(0, Math.min(100, g.mean + ((s.overall - m.mean) / m.sd) * g.sd)) : s.overall;
  };
}

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
  const cal = calibrator(dates);
  const score = (sc: Scorecard | undefined, d?: DateRecord) => (sc ? cal(sc, d) : undefined);
  const out: RankEntry[] = [];
  for (const [other, { speed, full }] of byOther) {
    const s = speed && sideOf(speed, personId);
    const f = full && sideOf(full, personId);
    if (!s?.mine && !f?.mine) continue;
    const myView = blend(score(s?.mine, speed), score(f?.mine, full));
    const theirView = blend(score(s?.theirs, speed), score(f?.theirs, full));
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
