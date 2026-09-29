"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { SourceTag } from "@/components/bits";
import { Bubble, MiniAvatar, ScoreCard, Typing, type Mini } from "@/components/DateView";
import { JoinForm } from "@/components/JoinForm";
import { ReadingLog } from "@/components/Profile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { firstName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { DateMessage, Person, RankEntry, ReadingNote, Scorecard, Sources } from "@/lib/types";

type Phase = "idle" | "analyzing" | "profile" | "speed" | "full" | "done" | "error";
type StepKey = "scrape" | "read-linkedin" | "read-instagram" | "synthesize";
type LiveDate = {
  id: string;
  kind: "speed" | "full";
  a: string;
  b: string;
  venue?: string;
  messages: DateMessage[];
  scoreA?: Scorecard;
  scoreB?: Scorecard;
  done?: boolean;
};

const STEPS: Record<StepKey, string> = {
  scrape: "Scraping LinkedIn + Instagram",
  "read-linkedin": "Reading LinkedIn",
  "read-instagram": "Reading Instagram",
  synthesize: "Writing the profile",
};
const PHASES = [
  ["analyzing", "Read"],
  ["profile", "Profile"],
  ["speed", "Speed dates"],
  ["full", "Full dates"],
  ["done", "Ranking"],
] as const;

async function stream(url: string, body: unknown, onEvent: (e: Record<string, unknown>) => void) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || `Request failed (${res.status})`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of chunk.split("\n")) if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)));
    }
  }
}

export function JoinFlow() {
  const params = useSearchParams();
  const li = params.get("li") || "";
  const ig = params.get("ig") || "";
  const existingId = params.get("id") || "";

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [steps, setSteps] = useState<Partial<Record<StepKey, { status: "start" | "done"; detail?: string }>>>({});
  const [sources, setSources] = useState<Sources | null>(null);
  const [notes, setNotes] = useState<ReadingNote[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [existing, setExisting] = useState(false);
  const [pool, setPool] = useState<Record<string, Mini>>({});
  const [dates, setDates] = useState<Record<string, LiveDate>>({});
  const [focus, setFocus] = useState("");
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [note, setNote] = useState("");
  const started = useRef(false);

  async function loadPool() {
    const list = (await fetch("/api/people").then((r) => r.json())) as Mini[];
    setPool(Object.fromEntries(list.map((p) => [p.id, p])));
  }

  function onDateEvent(e: Record<string, unknown>) {
    const type = e.type as string;
    if (type === "error") throw new Error(e.error as string);
    setDates((prev) => {
      const next = { ...prev };
      const id = e.dateId as string;
      if (type === "date:start") {
        const d = e.date as LiveDate;
        next[d.id] = { ...d, messages: [] };
      } else if (type === "date:message" && next[id]) next[id] = { ...next[id], messages: [...next[id].messages, e.message as DateMessage] };
      else if (type === "date:venue" && next[id]) next[id] = { ...next[id], venue: e.venue as string };
      else if (type === "date:score" && next[id]) next[id] = { ...next[id], [e.side === "a" ? "scoreA" : "scoreB"]: e.score as Scorecard };
      else if (type === "date:end") {
        const d = e.date as LiveDate;
        if (next[d.id]) next[d.id] = { ...next[d.id], done: true };
      }
      return next;
    });
    if (type === "date:start" && (e.date as LiveDate).kind === "full") setFocus((f) => f || (e.date as LiveDate).id);
  }

  async function goDating(id: string) {
    try {
      await loadPool();
      setPhase("speed");
      await stream(`/api/people/${id}/dates`, { round: "speed" }, onDateEvent);
      setPhase("full");
      await stream(`/api/people/${id}/dates`, { round: "full", k: 3 }, onDateEvent);
      const data = await fetch(`/api/people/${id}`).then((r) => r.json());
      setRanking(data.ranking || []);
      setNote(data.person?.decision?.note || "");
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  async function analyze() {
    setPhase("analyzing");
    try {
      let p: Person | null = null;
      let wasExisting = false;
      await stream("/api/people", { linkedin: li, instagram: ig }, (e) => {
        if (e.type === "step") setSteps((s) => ({ ...s, [e.step as StepKey]: { status: e.status as "start" | "done", detail: e.detail as string } }));
        if (e.type === "sources") setSources(e.sources as Sources);
        if (e.type === "notes") setNotes((n) => [...n, ...(e.notes as ReadingNote[])]);
        if (e.type === "person") {
          p = e.person as Person;
          wasExisting = !!e.existing;
        }
        if (e.type === "error") throw new Error(e.error as string);
      });
      if (!p) throw new Error("Analysis did not finish");
      const done = p as Person;
      setPerson(done);
      if (done.reading) setNotes(done.reading);
      if (done.sources) setSources(done.sources);
      setExisting(wasExisting);
      setPhase("profile");
      await loadPool();
      if (!wasExisting) setTimeout(() => goDating(done.id), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  useEffect(() => {
    if (started.current) return;
    if (existingId) {
      started.current = true;
      fetch(`/api/people/${existingId}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.person) throw new Error("Person not found");
          setPerson(d.person);
          setNotes(d.person.reading || []);
          setSources(d.person.sources || null);
          setExisting(true);
          setPhase("profile");
          loadPool();
        })
        .catch((err) => {
          setError(String(err.message || err));
          setPhase("error");
        });
    } else if (li && ig) {
      started.current = true;
      void Promise.resolve().then(analyze);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = person ? pool[person.id] || { id: person.id, name: person.name, avatar: person.avatar } : null;
  const all = Object.values(dates);
  const speed = all.filter((d) => d.kind === "speed").sort((x, y) => x.id.localeCompare(y.id));
  const full = all.filter((d) => d.kind === "full");
  const mini = (id: string): Mini => pool[id] || { id, name: id };
  const first = person ? firstName(person.name) : "";

  if (phase === "idle")
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-6xl leading-none">Add a real person</h1>
        <p className="mb-8 mt-4 text-muted-foreground">
          Paste their LinkedIn and public Instagram. We scrape both, their agent reads them and writes the profile, then it speed-dates every agent
          in the pool and goes on full dates with the best matches, live, while you watch.
        </p>
        <JoinForm />
      </div>
    );

  const cur = PHASES.findIndex(([k]) => k === (phase === "error" ? "analyzing" : phase));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center gap-2 text-sm">
        {PHASES.map(([k, label], i) => (
          <Badge
            key={k}
            variant={i === cur ? "default" : "outline"}
            className={cn("rounded-full px-3 py-1", i < cur && "bg-secondary text-foreground", i === cur && "bg-sunset text-white")}
          >
            {i < cur && <Check />} {i + 1}. {label}
          </Badge>
        ))}
      </div>

      {phase === "error" && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Something broke</AlertTitle>
          <AlertDescription>
            {error}{" "}
            <Link href="/join" className="underline">
              Try other links
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {(phase === "analyzing" || (!existing && notes.length > 0)) && (
        <section className="mb-12 space-y-4">
          <h2 className="font-display text-4xl">The agent is reading {person?.name || sources?.linkedin.fullName || "them"}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(STEPS) as StepKey[]).map((k) => {
              const s = steps[k];
              return (
                <div
                  key={k}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 text-sm",
                    s?.status === "done" ? "border-mint/30 bg-mint/5" : s ? "border-primary/30 bg-primary/5" : "text-muted-foreground",
                  )}
                >
                  {s?.status === "done" ? <Check className="size-4 text-mint" /> : s ? <Loader2 className="size-4 animate-spin text-primary" /> : <span className="size-4 rounded-full border" />}
                  <div className="min-w-0">
                    <div className="font-medium">{STEPS[k]}</div>
                    {s?.detail && <div className="truncate text-xs text-muted-foreground">{s.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {sources && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Card className="animate-pop">
                <CardContent className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <SourceTag source="linkedin" /> {sources.linkedin.fullName}
                  </div>
                  <div className="text-muted-foreground">{sources.linkedin.headline}</div>
                </CardContent>
              </Card>
              <Card className="animate-pop">
                <CardContent className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <SourceTag source="instagram" /> @{sources.instagram.username}
                  </div>
                  <div className="line-clamp-2 text-muted-foreground">{sources.instagram.biography}</div>
                </CardContent>
              </Card>
            </div>
          )}
          {notes.length > 0 && <ReadingLog notes={notes} animate />}
        </section>
      )}

      {person?.analysis && (
        <Card className="animate-pop mb-12 overflow-hidden border-primary/30 py-0">
          <CardContent className="grid gap-6 p-0 md:grid-cols-[220px_1fr]">
            {me?.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatar} alt={person.name} className="h-full max-h-80 w-full object-cover" />
            )}
            <div className="space-y-4 p-6">
              <div className="text-xs uppercase tracking-widest text-primary">Profile written by the agent</div>
              <h2 className="font-display text-5xl leading-none">{person.name}</h2>
              <p>{person.analysis.headline}</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Needs</div>
                  <ul className="space-y-1 text-sm">
                    {person.analysis.needs.map((n) => (
                      <li key={n.need}>♥ {n.need}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Hobbies</div>
                  <div className="flex flex-wrap gap-1">
                    {person.analysis.hobbies.map((h) => (
                      <Badge key={h.name} className="bg-primary/15 font-normal text-primary">
                        {h.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Interests</div>
                  <div className="flex flex-wrap gap-1">
                    {person.analysis.interests.map((h) => (
                      <Badge key={h.name} className="bg-violet/15 font-normal text-violet">
                        {h.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Ideal partner</div>
                  <p className="text-sm text-muted-foreground">{person.analysis.idealPartner}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <Button asChild variant="secondary" className="rounded-full">
                  <Link href={`/p/${person.id}`}>Full profile page →</Link>
                </Button>
                {phase === "profile" &&
                  (existing && person.origin === "seed" ? (
                    <>
                      <span className="text-sm text-muted-foreground">{first} is in the finished demo. Their agent already dated everyone.</span>
                      <Button asChild className="rounded-full bg-sunset text-white">
                        <Link href={`/p/${person.id}#ranking`}>See their ranking</Link>
                      </Button>
                    </>
                  ) : existing ? (
                    <Button onClick={() => goDating(person.id)} className="rounded-full bg-sunset text-white">
                      Send the agent out again
                    </Button>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Sending {first}&apos;s agent to speed dating…
                    </span>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {speed.length > 0 && me && (
        <section className="mb-12">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <h2 className="font-display text-4xl">Round 1 · {first}&apos;s agent speed-dates everyone</h2>
            <span className="text-sm text-muted-foreground">
              {speed.filter((d) => d.done).length}/{speed.length}
            </span>
          </div>
          <Progress value={(speed.filter((d) => d.done).length / speed.length) * 100} className="mb-4 h-1" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {speed.map((d) => {
              const other = mini(d.a === person!.id ? d.b : d.a);
              const mine = d.a === person!.id ? d.scoreA : d.scoreB;
              const theirs = d.a === person!.id ? d.scoreB : d.scoreA;
              const opener = d.messages[0]?.speaker === "b" ? "b" : "a";
              const nextSpeaker: "a" | "b" = d.messages.length % 2 === 0 ? opener : opener === "a" ? "b" : "a";
              return (
                <Card key={d.id} className="h-72 gap-2 py-3">
                  <CardContent className="flex h-full flex-col px-3">
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <MiniAvatar p={other} className="size-6" />
                      <span className="truncate font-medium">{other.name}</span>
                      {d.done && mine && theirs ? (
                        <span className="ml-auto flex gap-1 text-xs">
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 font-semibold text-primary">{mine.overall}</span>
                          <span className="rounded-full bg-violet/20 px-2 py-0.5 font-semibold text-violet">{theirs.overall}</span>
                        </span>
                      ) : (
                        <span className="ml-auto text-xs text-muted-foreground">{d.messages.length < 6 ? "talking…" : "scoring…"}</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                      {d.messages.map((m, i) => (
                        <Bubble key={i} m={m} a={mini(d.a)} b={mini(d.b)} compact />
                      ))}
                      {!d.done && d.messages.length < 6 && (
                        <div className="origin-left scale-75">
                          <Typing who={mini(nextSpeaker === "a" ? d.a : d.b)} side={nextSpeaker} />
                        </div>
                      )}
                    </div>
                    {d.done && mine && <div className="mt-2 line-clamp-2 border-t pt-2 text-xs italic text-muted-foreground">“{mine.verdict}”</div>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {full.length > 0 && me && (
        <section className="mb-12">
          <h2 className="mb-3 font-display text-4xl">Round 2 · Full dates with the best matches</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {full.map((d) => {
              const other = mini(d.a === person!.id ? d.b : d.a);
              return (
                <Button key={d.id} variant={focus === d.id ? "default" : "secondary"} size="sm" className="rounded-full" onClick={() => setFocus(d.id)}>
                  <MiniAvatar p={other} className="size-5" /> {other.name}
                  {!d.done && <span className="size-2 animate-pulse rounded-full bg-primary" />}
                </Button>
              );
            })}
          </div>
          {full
            .filter((d) => d.id === focus)
            .map((d) => (
              <LiveFullDate key={d.id} d={d} a={mini(d.a)} b={mini(d.b)} />
            ))}
        </section>
      )}

      {phase === "done" && person && (
        <Card className="animate-pop border-primary/30">
          <CardContent className="space-y-4">
            <h2 className="font-display text-5xl">Who fits {first} best</h2>
            {note && (
              <div className="rounded-2xl bg-primary/10 p-4">
                <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-widest text-primary">
                  <Star className="size-3.5 fill-primary" /> The agent&apos;s final call
                </div>
                <p className="italic">“{note}”</p>
              </div>
            )}
            <ol className="divide-y">
              {ranking.slice(0, 10).map((r, i) => {
                const q = mini(r.personId);
                return (
                  <li key={r.personId} className="flex items-center gap-3 py-2.5">
                    <span className={cn("w-7 text-center font-display text-3xl", i < 3 ? "text-primary" : "text-muted-foreground")}>{i + 1}</span>
                    <MiniAvatar p={q} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/p/${q.id}`} className="font-medium hover:text-primary">
                        {q.name}
                      </Link>
                      <div className="truncate text-xs text-muted-foreground">“{r.reason}”</div>
                    </div>
                    {r.agentRank === 1 && <Star className="size-4 fill-primary text-primary" />}
                    <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-primary">{r.fit}</span>
                  </li>
                );
              })}
            </ol>
            <div className="flex gap-2">
              <Button asChild className="rounded-full bg-sunset text-white">
                <Link href={`/p/${person.id}`}>Open {first}&apos;s profile →</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-full">
                <Link href="/rankings">All rankings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LiveFullDate({ d, a, b }: { d: LiveDate; a: Mini; b: Mini }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [d.messages.length]);
  const last = d.messages[d.messages.length - 1];
  const nextSpeaker: "a" | "b" = last?.speaker === "a" ? "b" : "a";
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {a.name} × {b.name}
          </div>
          <div className="font-display text-4xl">{d.venue || "Planning the date…"}</div>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {d.messages.map((m, i) => (
            <Bubble key={i} m={m} a={a} b={b} />
          ))}
          {!d.done && d.venue && d.messages.length < 15 && <Typing who={nextSpeaker === "a" ? a : b} side={nextSpeaker} />}
          <div ref={end} />
        </div>
        {d.scoreA && d.scoreB && (
          <div className="grid gap-3 md:grid-cols-2">
            <ScoreCard s={d.scoreA} me={a} other={b} />
            <ScoreCard s={d.scoreB} me={b} other={a} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
