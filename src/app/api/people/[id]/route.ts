import { allRankings } from "@/lib/ranking";
import { getPerson, listDates, listPeople, removePerson } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) return Response.json({ error: "Not found" }, { status: 404 });
  const [people, dates] = await Promise.all([listPeople(), listDates()]);
  return Response.json({ person, ranking: allRankings([person, ...people.filter((p) => p.id !== id)], dates)[id] });
}

// Opt-out: remove this person (and every date they went on) from the site.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await removePerson(id);
  return Response.json({ ok: true });
}
