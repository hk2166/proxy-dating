import { readInstagram, readLinkedIn, synthesize } from "./analyze";
import { fullDate, pickFullDates, speedDate, type Emit } from "./dating";
import { decide } from "./decide";
import { scrapeBoth } from "./scrape";
import { SUPPORTS_VISION } from "./llm";
import { getPerson, listDates, listPeople, saveDate, savePerson } from "./store";
import type { DateRecord, Person, ReadingNote, Sources } from "./types";
import { parseInstagram, parseLinkedIn } from "./urls";

export type PipelineEvent =
  | { type: "step"; step: "scrape" | "read-linkedin" | "read-instagram" | "synthesize"; status: "start" | "done"; detail?: string }
  | { type: "sources"; sources: Sources }
  | { type: "notes"; notes: ReadingNote[] }
  | { type: "person"; person: Person }
  | { type: "error"; error: string };

export async function toDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return undefined;
    const type = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 400_000) return undefined;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export async function analyzePerson(
  linkedinUrl: string,
  instagramUrl: string,
  emit: (e: PipelineEvent) => void,
  opts: { origin?: "seed" | "live"; avatar?: (p: Person) => Promise<string | undefined>; sources?: Sources } = {},
): Promise<Person> {
  const li = parseLinkedIn(linkedinUrl);
  const ig = parseInstagram(instagramUrl);
  if (!li) throw new Error("Please paste a LinkedIn profile link like linkedin.com/in/username");
  if (!ig) throw new Error("Please paste an Instagram profile link like instagram.com/username");

  emit({ type: "step", step: "scrape", status: "start", detail: `${li.url} + ${ig.url}` });
  const sources = opts.sources ?? (await scrapeBoth(li.url, ig.url));
  emit({ type: "sources", sources });
  emit({
    type: "step",
    step: "scrape",
    status: "done",
    detail: `LinkedIn: ${sources.linkedin.experience.length} roles, ${sources.linkedin.posts.length} posts · Instagram: ${sources.instagram.posts.length} posts`,
  });

  const person: Person = {
    id: ig.handle.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name: sources.linkedin.fullName || sources.instagram.fullName || ig.handle,
    linkedinUrl: li.url,
    instagramUrl: ig.url,
    origin: opts.origin || "live",
    createdAt: new Date().toISOString(),
    sources,
    status: "reading",
  };
  person.avatar = opts.avatar ? await opts.avatar(person) : await toDataUrl(sources.instagram.profilePic);

  emit({ type: "step", step: "read-linkedin", status: "start" });
  emit({ type: "step", step: "read-instagram", status: "start" });
  const [liNotes, igNotes] = await Promise.all([
    readLinkedIn(sources.linkedin).then((n) => {
      emit({ type: "notes", notes: n });
      emit({ type: "step", step: "read-linkedin", status: "done", detail: `${n.length} notes` });
      return n;
    }),
    readInstagram(sources.instagram).then((n) => {
      emit({ type: "notes", notes: n });
      emit({
        type: "step",
        step: "read-instagram",
        status: "done",
        detail: `${n.length} notes from ${sources.instagram.posts.length} posts${SUPPORTS_VISION ? " and their photos" : " (captions + image descriptions)"}`,
      });
      return n;
    }),
  ]);
  person.reading = [...liNotes, ...igNotes];

  emit({ type: "step", step: "synthesize", status: "start" });
  person.analysis = await synthesize(sources, person.reading);
  person.status = "ready";
  emit({ type: "step", step: "synthesize", status: "done" });
  return person;
}

export async function createLivePerson(linkedinUrl: string, instagramUrl: string, emit: (e: PipelineEvent) => void) {
  const person = await analyzePerson(linkedinUrl, instagramUrl, emit);
  const existing = await getPerson(person.id);
  if (existing?.origin === "seed") {
    // Re-analysis of a seed person: keep the seed record, just return it.
    emit({ type: "person", person: existing });
    return existing;
  }
  await savePerson(person);
  emit({ type: "person", person });
  return person;
}

const MAX_POOL = Number(process.env.MAX_SPEED_DATES || 30);

export async function runSpeedRound(personId: string, emit: Emit) {
  const people = (await listPeople()).filter((p) => p.status === "ready" && p.analysis);
  const me = people.find((p) => p.id === personId);
  if (!me) throw new Error("Person not found or not analyzed yet");
  const others = people
    .filter((p) => p.id !== personId)
    .sort((x, y) => (x.origin === y.origin ? 0 : x.origin === "seed" ? -1 : 1))
    .slice(0, MAX_POOL);
  const results = await Promise.allSettled(
    others.map(async (o) => {
      const d = await speedDate(me, o, emit);
      await saveDate(d);
      return d;
    }),
  );
  return results.filter((r): r is PromiseFulfilledResult<DateRecord> => r.status === "fulfilled").map((r) => r.value);
}

export async function runFullRound(personId: string, k: number, emit: Emit) {
  const people = await listPeople();
  const byId = new Map(people.map((p) => [p.id, p]));
  const dates = await listDates();
  const speed = dates.filter((d) => d.kind === "speed");
  const pairs = pickFullDates([personId], speed, k);
  const results = await Promise.allSettled(
    pairs.map(async ([a, b]) => {
      const sd = speed.find((d) => (d.a === a && d.b === b) || (d.a === b && d.b === a));
      const d = await fullDate(byId.get(a)!, byId.get(b)!, sd, emit);
      await saveDate(d);
      return d;
    }),
  );
  const done = results.filter((r): r is PromiseFulfilledResult<DateRecord> => r.status === "fulfilled").map((r) => r.value);
  await decideFor(personId);
  return done;
}

export async function decideFor(personId: string) {
  const [people, dates] = await Promise.all([listPeople(), listDates()]);
  const me = people.find((p) => p.id === personId);
  if (!me || me.origin !== "live") return null;
  const decision = await decide(
    me,
    people.filter((p) => p.status === "ready"),
    dates,
  );
  if (decision) await savePerson({ ...me, decision });
  return decision;
}
