import { createLivePerson } from "@/lib/pipeline";
import { sse } from "@/lib/sse";
import { allowLiveRun, getPerson, listPeople } from "@/lib/store";
import { parseInstagram, parseLinkedIn } from "@/lib/urls";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const people = await listPeople();
  return Response.json(
    people.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, origin: p.origin, headline: p.analysis?.headline, status: p.status })),
  );
}

// Paste a LinkedIn + Instagram link → scrape → agent reads → profile. Streams progress.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { linkedin?: string; instagram?: string; force?: boolean };
  const li = parseLinkedIn(body.linkedin || "");
  const ig = parseInstagram(body.instagram || "");
  if (!li || !ig) {
    return Response.json(
      { error: "Paste a LinkedIn profile link (linkedin.com/in/…) and a public Instagram profile link (instagram.com/…)" },
      { status: 400 },
    );
  }
  return sse(async (send) => {
    const id = ig.handle.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const existing = await getPerson(id);
    if (existing?.status === "ready" && !body.force) {
      send({ type: "step", step: "scrape", status: "done", detail: "Already analyzed — loading the existing agent" });
      send({ type: "person", person: existing, existing: true });
      return;
    }
    if (!(await allowLiveRun())) throw new Error("The demo has hit today's limit for new people. Please try again tomorrow, or browse the existing agents.");
    await createLivePerson(li.url, ig.url, send);
  });
}
