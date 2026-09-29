import { throwCurveball } from "@/lib/curveball";
import { sse } from "@/lib/sse";
import { getDate, getPerson, listCurveballs, saveCurveball, underCap } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json(await listCurveballs(id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { twist = "" } = (await req.json().catch(() => ({}))) as { twist?: string };
  const clean = twist.replace(/\s+/g, " ").trim().slice(0, 160);
  if (clean.length < 4) return Response.json({ error: "Give the host a real twist to work with." }, { status: 400 });

  const date = await getDate(id);
  if (!date) return Response.json({ error: "Date not found" }, { status: 404 });
  const [a, b] = await Promise.all([getPerson(date.a), getPerson(date.b)]);
  if (!a?.analysis || !b?.analysis) return Response.json({ error: "Missing people" }, { status: 404 });

  if (!(await underCap("curveballs"))) return Response.json({ error: "The host is exhausted for today. Try again tomorrow." }, { status: 429 });

  return sse(async (send) => {
    const cb = await throwCurveball(date, a, b, clean, send);
    await saveCurveball(id, cb);
    send({ type: "saved", curveball: cb });
  });
}
