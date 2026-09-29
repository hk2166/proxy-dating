import { underCap } from "@/lib/store";

export const runtime = "nodejs";

const VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"]);

const STYLE = {
  host: "Hushed, cinematic narrator, like a late-night nature documentary about romance. Slow, a little amused.",
  agent: "You're on a date. Natural, warm, playful, conversational. Not a presenter.",
};

export async function POST(req: Request) {
  const { text = "", voice = "alloy", role = "agent" } = (await req.json().catch(() => ({}))) as { text?: string; voice?: string; role?: string };
  if (!text.trim()) return new Response("no text", { status: 400 });
  if (!process.env.OPENAI_API_KEY) return new Response("audio needs an OpenAI key", { status: 501 });
  if (!(await underCap("tts"))) return new Response("audio limit reached for today", { status: 429 });

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.TTS_MODEL || "gpt-4o-mini-tts",
      voice: VOICES.has(voice) ? voice : "alloy",
      input: text.slice(0, 700),
      instructions: role === "host" ? STYLE.host : STYLE.agent,
      response_format: "mp3",
    }),
  });
  if (!res.ok || !res.body) return new Response(await res.text(), { status: 502 });
  return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=86400" } });
}
