import { z } from "zod";
import { hostSystem, transcript, turn } from "./dating";
import { chat, structured, MODELS } from "./llm";
import { firstName } from "./names";
import type { Curveball, DateMessage, DateRecord, Person } from "./types";

type Emit = (e: { type: string; [k: string]: unknown }) => void;

const Reaction = z.object({
  delta: z.number().describe("-10..10: how much this moment changed your read on them"),
  line: z.string().describe("one short line to your person about what you just saw"),
});

// A visitor plays Date Host: their twist lands mid-date and both agents have to deal with it.
export async function throwCurveball(date: DateRecord, a: Person, b: Person, twist: string, emit: Emit): Promise<Curveball> {
  const recent = date.messages.slice(-8);

  const scene = await chat({
    system: hostSystem(a, b),
    user: `DATE: ${date.venue || "speed date"}\n\nRECENT\n${transcript(recent, a, b)}\n\nA member of the audience hands you this twist: "${twist}"

Turn it into one vivid beat of narration (1-2 sentences, present tense) that drops into the date right now. Keep it PG-13 and kind to both people. If the twist is cruel, sexual or about real-world scandals, swap it for a harmless chaotic twist instead.`,
    model: MODELS.date,
    maxTokens: 1500,
  });

  const messages: DateMessage[] = [{ speaker: "host", text: scene.trim() }];
  emit({ type: "message", message: messages[0] });

  let speaker: "a" | "b" = Math.random() < 0.5 ? "a" : "b";
  for (let i = 0; i < 4; i++) {
    const me = speaker === "a" ? a : b;
    const text = await turn({
      me,
      other: speaker === "a" ? b : a,
      a,
      b,
      messages: [...recent, ...messages],
      setting: `SETTING: ${date.venue || "Speed date"}. Something unexpected just happened.`,
      hint: i === 0 ? "React to what just happened, in character. Be honest about how you'd actually handle it." : "Keep dealing with it together. Stay yourself.",
    });
    const m = { speaker, text };
    messages.push(m);
    emit({ type: "message", message: m });
    speaker = speaker === "a" ? "b" : "a";
  }

  const react = async (me: Person, other: Person) => {
    const r = await structured({
      system: `You are ${me.name}'s dating agent. Quick private gut check after a surprise moment on the date.`,
      user: `TWIST: ${scene}\n\n${transcript(messages, a, b)}\n\nDid how ${firstName(other.name)} handled that make them a better or worse match for ${firstName(me.name)}?`,
      schema: Reaction,
      model: MODELS.date,
      effort: "low",
      maxTokens: 2000,
    });
    return { delta: Math.max(-10, Math.min(10, Math.round(r.delta))), line: r.line };
  };
  const [ra, rb] = await Promise.all([react(a, b), react(b, a)]);

  const out: Curveball = { id: `${Date.now().toString(36)}`, twist, scene: scene.trim(), messages, react: { a: ra, b: rb }, at: new Date().toISOString() };
  emit({ type: "react", react: out.react });
  return out;
}
