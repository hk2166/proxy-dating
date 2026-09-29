import { z } from "zod";
import { structured, MODELS } from "./llm";
import { rankFor } from "./ranking";
import type { DateRecord, Decision, Person, Scorecard } from "./types";
import { firstName } from "./names";

// After all the dates, the agent looks at its top 8 side by side and makes the final call.
// The formula only shortlists.

const SHORTLIST = 8;

const DecisionSchema = z.object({
  ranking: z
    .array(z.object({ personId: z.string(), reason: z.string().describe("One specific sentence: why this position") }))
    .describe("Every shortlisted candidate exactly once, best fit first"),
  note: z.string().describe("2-3 sentences addressed to your person by first name, naming your pick and why"),
});

const first = firstName;

function sideOf(d: DateRecord, me: string): { mine?: Scorecard; theirs?: Scorecard } {
  return d.a === me ? { mine: d.scoreA, theirs: d.scoreB } : { mine: d.scoreB, theirs: d.scoreA };
}

export async function decide(person: Person, people: Person[], dates: DateRecord[]): Promise<Decision | null> {
  const a = person.analysis;
  if (!a) return null;
  const byId = new Map(people.map((p) => [p.id, p]));
  const shortlist = rankFor(person.id, people, dates, { useDecision: false }).slice(0, SHORTLIST);
  if (shortlist.length < 2) return null;

  const blocks = shortlist.map((r) => {
    const q = byId.get(r.personId)!;
    const mine = dates.filter((d) => (d.a === person.id && d.b === q.id) || (d.b === person.id && d.a === q.id));
    const lines = mine
      .sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "full" ? -1 : 1))
      .map((d) => {
        const { mine: m, theirs: t } = sideOf(d, person.id);
        return `  ${d.kind === "full" ? `FULL DATE (${d.venue})` : "SPEED DATE"}: my score ${m?.overall} — "${m?.verdict}" | concern: ${m?.concern} | their agent scored ${first(person.name)} ${t?.overall} — "${t?.verdict}"`;
      })
      .join("\n");
    return `id=${q.id} | ${q.name} — ${q.analysis?.headline}\n${lines}`;
  });

  const system = `You are ${person.name}'s dating agent. You have now dated every other agent on ${first(person.name)}'s behalf. Time to commit to a final ranking of the shortlist below.
Weigh what ${first(person.name)} actually needs over surface chemistry, and remember a match only works if it's mutual — the other agent's view of ${first(person.name)} matters. Be decisive and specific; reference what happened on the dates.

WHAT ${first(person.name).toUpperCase()} NEEDS
${a.needs.map((n) => `- ${n.need}`).join("\n")}
DEALBREAKERS: ${a.dealbreakers.join("; ")}
IDEAL PARTNER: ${a.idealPartner}`;

  const out = await structured({
    system,
    user: `SHORTLIST (formula order — you may reorder)\n\n${blocks.join("\n\n")}\n\nReturn the final ranking using the exact ids.`,
    schema: DecisionSchema,
    model: MODELS.date,
    effort: "medium",
    maxTokens: 8000,
  });

  const valid = new Set(shortlist.map((r) => r.personId));
  const seen = new Set<string>();
  const order: string[] = [];
  const reasons: Record<string, string> = {};
  for (const r of out.ranking) {
    if (!valid.has(r.personId) || seen.has(r.personId)) continue;
    seen.add(r.personId);
    order.push(r.personId);
    reasons[r.personId] = r.reason;
  }
  for (const r of shortlist) if (!seen.has(r.personId)) order.push(r.personId); // anything the agent skipped keeps formula order
  return { order, reasons, note: out.note, model: MODELS.date, at: new Date().toISOString() };
}
