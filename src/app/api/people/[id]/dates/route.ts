import { runFullRound, runSpeedRound } from "@/lib/pipeline";
import { sse } from "@/lib/sse";

export const runtime = "nodejs";
export const maxDuration = 300;

// Send this person's agent out dating. round=speed → speed-date everyone;
// round=full → full dates with the top mutual matches. Streams every line live.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { round = "speed", k = 3 } = (await req.json().catch(() => ({}))) as { round?: "speed" | "full"; k?: number };
  return sse(async (send) => {
    if (round === "full") await runFullRound(id, Math.min(Math.max(1, k), 4), send);
    else await runSpeedRound(id, send);
  });
}
