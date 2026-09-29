import { z } from "zod";
import { transcript } from "./dating";
import { chat, structured, MODELS } from "./llm";
import { firstName } from "./names";
import type { Afterparty, DateRecord, Person, RankEntry } from "./types";

const KIND = `Playful and affectionate, never mean. No insults about anyone's looks, character, money or real relationships. Only talk about what happened on the dates.`;

function nightOf(p: Person, byId: Map<string, Person>, dates: DateRecord[], ranking: RankEntry[]) {
  const mine = (d: DateRecord) => (d.a === p.id ? d.scoreA : d.scoreB);
  const fulls = dates
    .filter((d) => d.kind === "full" && (d.a === p.id || d.b === p.id))
    .map((d) => `- full date with ${byId.get(d.a === p.id ? d.b : d.a)?.name} at ${d.venue}: "${mine(d)?.verdict}"`);
  const pick = ranking[0] && byId.get(ranking[0].personId);
  const worst = ranking.at(-1) && byId.get(ranking.at(-1)!.personId);
  return [
    ...fulls,
    pick && `- your final pick: ${pick.name} ("${ranking[0].reason}")`,
    worst && `- your least compatible: ${worst.name} ("${ranking.at(-1)!.reason}")`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function gossip(people: Person[], byId: Map<string, Person>, dates: DateRecord[], rankings: Record<string, RankEntry[]>, crowd: string[]) {
  const log: Afterparty["gossip"] = [{ from: "host", text: "Afterparty's open 🍸 Humans are asleep. How did everyone's night go?" }];
  const order = [...crowd, ...crowd.slice().reverse(), ...crowd.slice(0, 4)];

  for (const id of order) {
    const p = byId.get(id)!;
    const chatSoFar = log
      .slice(-12)
      .map((m) => `${m.from === "host" ? "Host" : firstName(byId.get(m.from)!.name) + "'s agent"}: ${m.text}`)
      .join("\n");
    const text = await chat({
      system: `You are ${p.name}'s dating agent, hanging out in the agents' group chat after a whole night of dating on your human's behalf.
Your vibe: ${p.analysis!.agentVoice}
${KIND}
Reply like a real text message: ONE short paragraph, max 30 words. React to the last message, tease the other agents a little, spill one specific thing about your night. Emoji only if it fits you. No name prefix.`,
      user: `YOUR NIGHT\n${nightOf(p, byId, dates, rankings[id] || [])}\n\nGROUP CHAT\n${chatSoFar}\n\nYour message:`,
      model: MODELS.date,
      maxTokens: 1500,
    });
    log.push({ from: id, text: text.replace(/^[^:]{0,40}agent:\s*/i, "").trim() });
  }
  return log;
}

async function rejection(p: Person, other: Person, dates: DateRecord[]) {
  const d = dates.find((x) => x.kind === "speed" && ((x.a === p.id && x.b === other.id) || (x.b === p.id && x.a === other.id)));
  const [a, b] = d && d.a === p.id ? [p, other] : [other, p];
  const text = await chat({
    system: `You are ${p.name}'s dating agent. Write the "let's just be friends" text you'd send to ${other.name}'s agent after their speed date. 2-3 sentences, warm, specific, a little funny, honest about why it's not a match. ${KIND} No name prefix, no sign-off.`,
    user: d ? `THE SPEED DATE\n${transcript(d.messages, a, b)}` : `You never really clicked with ${other.name}.`,
    model: MODELS.date,
    maxTokens: 1500,
  });
  return { from: p.id, to: other.id, text: text.trim() };
}

const Captions = z.object({ captions: z.array(z.object({ when: z.string(), text: z.string() })) });

async function future(a: Person, b: Person, dates: DateRecord[]) {
  const d = dates.find((x) => x.kind === "full" && ((x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id)));
  const out = await structured({
    system: `You write fake future Instagram captions for a couple two dating agents just matched. Ground them in the couple's actual shared interests and their first date. Playful and specific. No weddings, proposals or babies. ${KIND}`,
    user: `${a.name}: ${a.analysis!.headline}\n${b.name}: ${b.analysis!.headline}\nFirst date: ${d?.venue}\n\nWrite exactly 3 captions: "1 year later", "3 years later", "5 years later".`,
    schema: Captions,
    model: MODELS.date,
    effort: "low",
    maxTokens: 3000,
  });
  const captions = out.captions.slice(0, 3).map((c) => ({ when: c.when, text: c.text.replace(/^\s*\d+\s+years?\s+later\s*[:—-]\s*/i, "") }));
  return { a: a.id, b: b.id, captions };
}

export async function makeAfterparty(people: Person[], dates: DateRecord[], rankings: Record<string, RankEntry[]>, pairs: [Person, Person][]): Promise<Afterparty> {
  const byId = new Map(people.map((p) => [p.id, p]));
  const top = (id: string) => rankings[id]?.[0]?.personId;
  const unrequited = people.filter((p) => top(p.id) && top(top(p.id)!) !== p.id).map((p) => p.id);
  const crowd = [...new Set([...pairs.flat().map((p) => p.id), ...unrequited])].slice(0, 10);

  const [chatLog, rejections, futures] = await Promise.all([
    gossip(people, byId, dates, rankings, crowd),
    Promise.all(
      people.map((p) => {
        const worst = rankings[p.id]?.at(-1);
        return worst ? rejection(p, byId.get(worst.personId)!, dates) : null;
      }),
    ),
    Promise.all(pairs.map(([a, b]) => future(a, b, dates))),
  ]);
  return { gossip: chatLog, rejections: rejections.filter(Boolean) as Afterparty["rejections"], futures };
}
