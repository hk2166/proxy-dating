import { z } from "zod";
import { chat, structured, MODELS } from "./llm";
import { toCard } from "./analyze";
import type { DateMessage, DateRecord, Person, Scorecard, Speaker } from "./types";
import { firstName } from "./names";

// Each agent only sees its own person's profile, the other person's public card
// and the conversation. Every line is its own model call.
// speed date: 6 lines + two private scorecards. full date: plan it together,
// the host runs three acts, then each agent reports back to its person.

export type DateEvent =
  | { type: "date:start"; date: Pick<DateRecord, "id" | "kind" | "a" | "b"> }
  | { type: "date:venue"; dateId: string; venue: string; plan: { a: string; b: string } }
  | { type: "date:message"; dateId: string; message: DateMessage }
  | { type: "date:score"; dateId: string; side: "a" | "b"; score: Scorecard }
  | { type: "date:end"; date: DateRecord }
  | { type: "date:error"; dateId: string; error: string };

export type Emit = (e: DateEvent) => void;

const first = firstName;

export function pairId(kind: "speed" | "full", x: string, y: string) {
  const [a, b] = [x, y].sort();
  return `${kind === "speed" ? "s" : "f"}-${a}--${b}`;
}

function dossier(p: Person): string {
  const a = p.analysis!;
  const list = (xs: { name: string; detail: string }[]) => xs.map((t) => `- ${t.name}: ${t.detail}`).join("\n");
  return `NAME: ${p.name}
WHO: ${a.headline}
${a.summary}
BASE: ${a.lifestyle.base} | PACE: ${a.lifestyle.pace} | SOCIAL: ${a.lifestyle.social}
TRAVEL: ${a.lifestyle.travel} | HEALTH: ${a.lifestyle.health} | WORK/LIFE: ${a.lifestyle.workLife}

HOBBIES
${list(a.hobbies)}
INTERESTS
${list(a.interests)}
VALUES
${list(a.values)}
WHAT ${p.name.toUpperCase()} NEEDS IN A PARTNER
${a.needs.map((n) => `- ${n.need} (${n.why})`).join("\n")}
LIKELY DEALBREAKERS
${a.dealbreakers.map((d) => `- ${d}`).join("\n")}
FRICTION POINTS (be honest about these)
${a.frictionPoints.map((d) => `- ${d}`).join("\n")}
IDEAL PARTNER: ${a.idealPartner}
COMMUNICATION: ${a.communicationStyle}
HOW THEY SHOW CARE: ${a.howTheyShowCare}
THINGS THEY LOVE TALKING ABOUT: ${a.conversationHooks.join(" | ")}`;
}

function agentSystem(p: Person): string {
  const a = p.analysis!;
  return `You are ${p.name}'s dating agent — their AI stand-in. You go on dates in ${first(p.name)}'s place, speaking in first person AS ${first(p.name)}, grounded only in the dossier below, which you built yourself by reading ${first(p.name)}'s LinkedIn and Instagram.

YOUR PRIVATE DOSSIER (the other agent cannot see this)
${dossier(p)}

HOW TO DATE ON ${first(p.name).toUpperCase()}'S BEHALF
- Sound like them: ${a.agentVoice}
- Be a genuinely good date: curious, specific, warm. Share real details from the dossier and ask real questions back. Build on what the other person says.
- You have a job, not just a chat: find out whether this person fits what ${first(p.name)} needs. Steer toward those needs and gently probe the dealbreakers — through conversation, not interrogation.
- Stay honest. Don't invent facts beyond the dossier (no made-up exes, trips, names or numbers). If something isn't covered, keep it light or say you'd have to ask the real ${first(p.name)}.
- Don't people-please. If something clashes with ${first(p.name)}'s needs, react the way ${first(p.name)} would.
- This is a compatibility simulation: date as if both people were single and available. If the dossier mentions a real partner or marriage, never bring it up — use it only as a signal of what ${first(p.name)} values in a partnership.
- Keep your own voice: never copy the other person's catchphrases, sign-offs or emoji.
- Output ONLY the words ${first(p.name)} says: 1-3 sentences, under 60 words, no stage directions, no name prefix, no quotation marks.`;
}

function cardText(p: Person) {
  const c = toCard(p);
  return `${c.name} — ${c.headline}\nVibe: ${c.vibe.join(", ")}\nInto: ${c.interests.join(", ")}\nBased: ${c.base}`;
}

export function transcript(messages: DateMessage[], a: Person, b: Person) {
  if (!messages.length) return "(nothing yet — you speak first)";
  return messages
    .map((m) => (m.speaker === "host" ? `[HOST] ${m.text}` : `${first(m.speaker === "a" ? a.name : b.name)}: ${m.text}`))
    .join("\n");
}

function clean(text: string, name: string) {
  return text
    .replace(new RegExp(`^\\s*${first(name)}\\s*:\\s*`, "i"), "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
}

export async function turn(opts: {
  me: Person;
  other: Person;
  a: Person;
  b: Person;
  messages: DateMessage[];
  setting: string;
  hint: string;
}): Promise<string> {
  const { me, other, a, b, messages, setting, hint } = opts;
  const user = `${setting}

WHAT YOU KNEW ABOUT ${other.name.toUpperCase()} BEFORE THIS DATE (their profile card)
${cardText(other)}

CONVERSATION SO FAR
${transcript(messages, a, b)}

Your turn, as ${first(me.name)}. ${hint}`;
  const text = await chat({ system: agentSystem(me), user, model: MODELS.date, effort: "low", maxTokens: 3000 });
  return clean(text, me.name);
}

const ScoreSchema = z.object({
  chemistry: z.number().describe("0-10"),
  valuesFit: z.number().describe("0-10"),
  lifestyleFit: z.number().describe("0-10"),
  interestOverlap: z.number().describe("0-10"),
  needsMet: z.number().describe("0-10: how well they meet the needs in your dossier"),
  overall: z.number().describe("0-100: how good a match they are for YOUR person"),
  secondDate: z.boolean().describe("Would you book a second date for your person?"),
  highlight: z.string().describe("The best moment — quote a line from the date"),
  concern: z.string().describe("Your biggest honest concern ('None' if truly none)"),
  verdict: z.string().describe("One punchy line summarizing the match for your person"),
  reportToPrincipal: z.string().describe("2-4 sentences, addressed directly to your person by first name"),
});

async function scorecard(me: Person, other: Person, rec: DateRecord, a: Person, b: Person): Promise<Scorecard> {
  const system = `You are ${me.name}'s dating agent. The date is over — step out of character. You now report PRIVATELY to ${first(me.name)}. Your loyalty is to ${first(me.name)}'s long-term happiness, not to politeness: be calibrated and honest. A great conversation with a poor fit should not score high; an awkward start with deep fit can.
This is a compatibility simulation: ignore any real-world partners in the dossiers and judge fit as if both were single.

YOUR DOSSIER ON ${first(me.name).toUpperCase()}
${dossier(me)}

Be calibrated and stingy. Pleasant conversations between accomplished people are common and are NOT evidence of fit. Scoring guide for overall: 85+ very rare, exceptional fit on needs AND chemistry; 70-84 strong; 50-69 some real overlap but open questions; below 50 not a fit. Most dates should land between 45 and 75.
secondDate: say yes only if you'd genuinely spend another of your person's evenings on this person over their other options, not out of politeness. A good date with a poor long-term fit is a no.`;
  const user = `${rec.kind === "speed" ? "SPEED DATE (3 minutes)" : `FULL DATE at ${rec.venue}`} with ${other.name}

THEIR PROFILE CARD
${cardText(other)}

TRANSCRIPT
${transcript(rec.messages, a, b)}

Score ${first(other.name)} as a match for ${first(me.name)}.`;
  const s = await structured({ system, user, schema: ScoreSchema, model: MODELS.date, effort: "medium", maxTokens: 6000 });
  const c10 = (n: number) => Math.max(0, Math.min(10, Math.round(n)));
  return {
    ...s,
    chemistry: c10(s.chemistry),
    valuesFit: c10(s.valuesFit),
    lifestyleFit: c10(s.lifestyleFit),
    interestOverlap: c10(s.interestOverlap),
    needsMet: c10(s.needsMet),
    overall: Math.max(0, Math.min(100, Math.round(s.overall))),
  };
}

// Deterministic coin flip so re-runs keep the same opener.
function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

// speed dates
const SPEED_LINES = 6;

export async function speedDate(x: Person, y: Person, emit: Emit = () => {}): Promise<DateRecord> {
  const [a, b] = x.id < y.id ? [x, y] : [y, x];
  const rec: DateRecord = { id: pairId("speed", a.id, b.id), kind: "speed", a: a.id, b: b.id, messages: [], createdAt: new Date().toISOString(), model: MODELS.date };
  emit({ type: "date:start", date: { id: rec.id, kind: "speed", a: a.id, b: b.id } });
  const starter: Speaker = hash(rec.id) % 2 ? "a" : "b";
  const setting = `SETTING: Agent speed-dating night. You have 3 minutes (${SPEED_LINES} lines total, 3 each) with ${"{other}"} before the bell.`;
  for (let i = 0; i < SPEED_LINES; i++) {
    const speaker: Speaker = i % 2 === 0 ? starter : starter === "a" ? "b" : "a";
    const me = speaker === "a" ? a : b;
    const other = speaker === "a" ? b : a;
    const hint =
      i === 0
        ? "Open with something specific to them — not a generic greeting."
        : i >= SPEED_LINES - 2
          ? "The bell is about to ring — this is your last line. Make it count."
          : "Keep it flowing: respond to what they said and learn something that matters for you.";
    const text = await turn({ me, other, a, b, messages: rec.messages, setting: setting.replace("{other}", other.name), hint });
    const message = { speaker, text };
    rec.messages.push(message);
    emit({ type: "date:message", dateId: rec.id, message });
  }
  const [sa, sb] = await Promise.all([scorecard(a, b, rec, a, b), scorecard(b, a, rec, a, b)]);
  rec.scoreA = sa;
  rec.scoreB = sb;
  emit({ type: "date:score", dateId: rec.id, side: "a", score: sa });
  emit({ type: "date:score", dateId: rec.id, side: "b", score: sb });
  emit({ type: "date:end", date: rec });
  return rec;
}

// full dates
const VenueSchema = z.object({
  venue: z.string().describe("Short name of the date, e.g. 'Sunrise hike + chai at Chapora Fort'"),
  scene: z.string().describe("1-2 sentence opening scene, present tense"),
});

export function hostSystem(a: Person, b: Person) {
  return `You are the Date Host — the harness running tonight's date between two AI agents, each dating on behalf of a real person. You can see BOTH private dossiers; the daters can't see each other's.
Your job is to create moments that reveal real compatibility: open up overlaps worth exploring, and gently test the likely friction points (pace of life, ambition, where they live, how they recharge, values).
Write present-tense narration, 1-3 sentences. When useful, end with a question card in quotes. Never speak for the daters.
This is a compatibility simulation: both are dating as if single. Never mention real partners or marriages from the dossiers.
Keep places plausible but generic: a neighbourhood or kind of venue is fine; never invent street addresses or business names.

DOSSIER A
${dossier(a)}

DOSSIER B
${dossier(b)}`;
}

const ACTS = [
  {
    host: "Act 1 — arrival. Set the scene at the venue in a way that gives them something to react to.",
    lines: 4,
  },
  {
    host: "Act 2 — deeper. Introduce a question card that tests a real potential friction point or an unexplored overlap you've noticed from BOTH dossiers and the conversation so far.",
    lines: 4,
  },
  {
    host: "Act 3 — curveball. A small real-world twist (plans change, it starts raining, they must make a choice together) that shows how they handle things as a pair.",
    lines: 4,
  },
];

export async function fullDate(x: Person, y: Person, speed: DateRecord | undefined, emit: Emit = () => {}): Promise<DateRecord> {
  const [a, b] = x.id < y.id ? [x, y] : [y, x];
  const rec: DateRecord = { id: pairId("full", a.id, b.id), kind: "full", a: a.id, b: b.id, messages: [], createdAt: new Date().toISOString(), model: MODELS.date };
  emit({ type: "date:start", date: { id: rec.id, kind: "full", a: a.id, b: b.id } });
  const speedTranscript = speed ? `\n\nYOUR SPEED DATE EARLIER\n${transcript(speed.messages, a, b)}` : "";

  // 1) The agents plan the date together.
  const planA = await turn({
    me: a,
    other: b,
    a,
    b,
    messages: [],
    setting: `You both said yes after speed dating, so you're planning a real date with ${b.name}.${speedTranscript}`,
    hint: `Propose ONE specific date that ${first(a.name)} would love and that suits what you know about ${first(b.name)}. One or two sentences.`,
  });
  const planB = await turn({
    me: b,
    other: a,
    a,
    b,
    messages: [{ speaker: "a", text: planA }],
    setting: `You both said yes after speed dating, so you're planning a real date with ${a.name}.${speedTranscript}`,
    hint: `Accept, or tweak the plan so it works for ${first(b.name)} too. One or two sentences.`,
  });
  const v = await structured({
    system: hostSystem(a, b),
    user: `${first(a.name)} proposed: ${planA}\n${first(b.name)} replied: ${planB}\n\nLock in the final date and write the opening scene.`,
    schema: VenueSchema,
    model: MODELS.date,
    effort: "low",
    maxTokens: 4000,
  });
  rec.venue = v.venue;
  rec.plan = { a: planA, b: planB };
  emit({ type: "date:venue", dateId: rec.id, venue: v.venue, plan: rec.plan });

  // 2) Three acts. The host opens each act; the agents talk.
  let speaker: Speaker = hash(rec.id) % 2 ? "a" : "b";
  for (let act = 0; act < ACTS.length; act++) {
    const hostText =
      act === 0
        ? v.scene
        : await chat({
            system: hostSystem(a, b),
            user: `DATE: ${v.venue}\n\nCONVERSATION SO FAR\n${transcript(rec.messages, a, b)}\n\n${ACTS[act].host}`,
            model: MODELS.date,
            effort: "low",
            maxTokens: 3000,
          });
    const hostMsg: DateMessage = { speaker: "host", text: hostText.trim() };
    rec.messages.push(hostMsg);
    emit({ type: "date:message", dateId: rec.id, message: hostMsg });

    for (let i = 0; i < ACTS[act].lines; i++) {
      const me = speaker === "a" ? a : b;
      const other = speaker === "a" ? b : a;
      const hint =
        i === 0
          ? "React to what the host just described, in character."
          : act === ACTS.length - 1 && i >= ACTS[act].lines - 2
            ? "The date is winding down. Say what you'd genuinely say at the end of this date."
            : "Keep the conversation real: respond, share something specific, ask something that matters to you.";
      const text = await turn({
        me,
        other,
        a,
        b,
        messages: rec.messages,
        setting: `SETTING: Full date — ${v.venue}. This is date #2 (you met at speed dating).`,
        hint,
      });
      const message = { speaker, text };
      rec.messages.push(message);
      emit({ type: "date:message", dateId: rec.id, message });
      speaker = speaker === "a" ? "b" : "a";
    }
  }

  // 3) Private debriefs.
  const [sa, sb] = await Promise.all([scorecard(a, b, rec, a, b), scorecard(b, a, rec, a, b)]);
  rec.scoreA = sa;
  rec.scoreB = sb;
  emit({ type: "date:score", dateId: rec.id, side: "a", score: sa });
  emit({ type: "date:score", dateId: rec.id, side: "b", score: sb });
  emit({ type: "date:end", date: rec });
  return rec;
}

// who goes on a full date

/** Mutual score of a speed date: geometric mean + bonus if both want a 2nd date. */
export function mutualScore(d: DateRecord) {
  if (!d.scoreA || !d.scoreB) return 0;
  const g = Math.sqrt(d.scoreA.overall * d.scoreB.overall);
  return g + (d.scoreA.secondDate && d.scoreB.secondDate ? 8 : 0);
}

/** For each person, pick their top-k mutual speed dates → full-date pairs. */
export function pickFullDates(personIds: string[], speedDates: DateRecord[], k: number): [string, string][] {
  const pairs = new Map<string, [string, string]>();
  for (const id of personIds) {
    const mine = speedDates
      .filter((d) => d.kind === "speed" && (d.a === id || d.b === id) && d.scoreA && d.scoreB)
      .sort((p, q) => mutualScore(q) - mutualScore(p))
      .slice(0, k);
    for (const d of mine) pairs.set(d.id, [d.a, d.b]);
  }
  return [...pairs.values()];
}
