"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bubble, MiniAvatar, ScoreCard, Typing, type Mini } from "@/components/DateView";
import { JoinForm } from "@/components/JoinForm";
import { ReadingLog } from "@/components/Profile";
import { SourceBadge, Tag } from "@/components/ui";
import type { DateMessage, Person, RankEntry, ReadingNote, Scorecard, Sources } from "@/lib/types";
import { firstName } from "@/lib/names";

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
  error?: string;
};

const STEP_LABEL: Record<StepKey, string> = {
  scrape: "Scraping the public LinkedIn + Instagram",
  "read-linkedin": "Agent reads LinkedIn",
  "read-instagram": "Agent reads Instagram",
  synthesize: "Agent writes the profile: needs, hobbies, interests…",
};

async function stream(url: string, body: unknown, onEvent: (e: Record<string, unknown>) => void) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || `Request failed (${res.status})`);
  }
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
  const [focus, setFocus] = useState<string>("");
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
      if (type === "date:start") {
        const d = e.date as LiveDate;
        next[d.id] = { ...d, messages: [] };
      } else if (type === "date:message") {
        const id = e.dateId as string;
        if (next[id]) next[id] = { ...next[id], messages: [...next[id].messages, e.message as DateMessage] };
      } else if (type === "date:venue") {
        const id = e.dateId as string;
        if (next[id]) next[id] = { ...next[id], venue: e.venue as string };
      } else if (type === "date:score") {
        const id = e.dateId as string;
        if (next[id]) next[id] = { ...next[id], [e.side === "a" ? "scoreA" : "scoreB"]: e.score as Scorecard };
      } else if (type === "date:end") {
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
      if (done.reading && !notes.length) setNotes(done.reading);
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
  const speed = all.filter((d) => d.kind === "speed");
  const full = all.filter((d) => d.kind === "full");
  const mini = (id: string): Mini => pool[id] || { id, name: id };

  if (phase === "idle")
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-5xl">Add a real person</h1>
        <p className="mb-6 mt-2 text-muted">
          Paste their LinkedIn and their public Instagram. We scrape both, their agent reads them and writes the profile, then it
          speed-dates every agent in the pool and goes on full dates with the best mutual matches — live, in front of you.
        </p>
        <JoinForm />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Stage header */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {(
          [
            ["analyzing", "1 · Read"],
            ["profile", "2 · Profile"],
            ["speed", "3 · Speed dates"],
            ["full", "4 · Full dates"],
            ["done", "5 · Ranking"],
          ] as const
        ).map(([k, label], i, arr) => {
          const order = ["analyzing", "profile", "speed", "full", "done"];
          const cur = order.indexOf(phase === "error" ? "analyzing" : phase);
          const idx = order.indexOf(k);
          return (
            <span key={k} className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 ${idx < cur ? "bg-ink text-paper" : idx === cur ? "bg-rose text-white" : "border border-line text-muted"}`}>{label}</span>
              {i < arr.length - 1 && <span className="text-line">—</span>}
            </span>
          );
        })}
      </div>

      {phase === "error" && (
        <div className="mb-6 rounded-2xl border border-rose/40 bg-rose-soft p-4 text-sm">
          <div className="font-semibold text-rose">Something went wrong</div>
          <div className="mt-1">{error}</div>
          <Link href="/join" className="mt-2 inline-block underline">
            Try other links
          </Link>
        </div>
      )}

      {/* 1. Reading */}
      {(phase === "analyzing" || (!existing && notes.length > 0)) && (
        <section className="mb-10">
          <h2 className="mb-3 font-display text-3xl">The agent is reading {person?.name || sources?.linkedin.fullName || "them"}</h2>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {(Object.keys(STEP_LABEL) as StepKey[]).map((k) => {
              const s = steps[k];
              return (
                <div key={k} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${s?.status === "done" ? "border-green/30 bg-green/5" : s ? "border-rose/30 bg-rose-soft/40" : "border-line bg-card text-muted"}`}>
                  <span className="w-5 text-center">{s?.status === "done" ? "✓" : s ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-rose border-t-transparent" /> : "○"}</span>
                  <div className="min-w-0">
                    <div className="font-medium">{STEP_LABEL[k]}</div>
                    {s?.detail && <div className="truncate text-xs text-muted">{s.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {sources && (
            <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="animate-pop rounded-xl border border-line bg-card p-3">
                <div className="flex items-center gap-2 font-semibold">
                  <SourceBadge source="linkedin" /> {sources.linkedin.fullName}
                </div>
                <div className="text-muted">{sources.linkedin.headline}</div>
                <div className="mt-1 text-xs text-muted">
                  {sources.linkedin.experience.slice(0, 3).map((e) => `${e.title} @ ${e.company}`).join(" · ")}
                </div>
              </div>
              <div className="animate-pop rounded-xl border border-line bg-card p-3">
                <div className="flex items-center gap-2 font-semibold">
                  <SourceBadge source="instagram" /> @{sources.instagram.username}
                </div>
                <div className="line-clamp-2 text-muted">{sources.instagram.biography}</div>
                <div className="mt-1 text-xs text-muted">{sources.instagram.posts.length} recent posts read, including photos</div>
              </div>
            </div>
          )}
          {notes.length > 0 && <ReadingLog notes={notes} animate />}
        </section>
      )}

      {/* 2. Profile */}
      {person?.analysis && (
        <section className="mb-10 animate-pop rounded-3xl border border-line bg-card p-6">
          <div className="flex flex-wrap items-center gap-4">
            {me && <MiniAvatar p={me} size={72} />}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">Profile written by the agent</div>
              <h2 className="font-display text-4xl">{person.name}</h2>
              <p>{person.analysis.headline}</p>
            </div>
            <Link href={`/p/${person.id}`} className="rounded-xl border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper">
              Full profile page →
            </Link>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Needs</div>
              <ul className="space-y-1.5 text-sm">
                {person.analysis.needs.map((n) => (
                  <li key={n.need}>
                    <span className="text-rose">♥</span> {n.need}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Hobbies</div>
              <div className="flex flex-wrap gap-1.5">
                {person.analysis.hobbies.map((h) => (
                  <Tag key={h.name} tone="rose">
                    {h.name}
                  </Tag>
                ))}
              </div>
              <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Interests</div>
              <div className="flex flex-wrap gap-1.5">
                {person.analysis.interests.map((h) => (
                  <Tag key={h.name} tone="plum">
                    {h.name}
                  </Tag>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Values</div>
              <div className="flex flex-wrap gap-1.5">
                {person.analysis.values.map((h) => (
                  <Tag key={h.name} tone="green">
                    {h.name}
                  </Tag>
                ))}
              </div>
              <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Ideal partner</div>
              <p className="text-sm">{person.analysis.idealPartner}</p>
            </div>
          </div>
          {phase === "profile" && (
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              {existing && person.origin === "seed" ? (
                <>
                  <span className="text-sm text-muted">
                    {firstName(person.name)} is part of the finished demo: their agent has already dated everyone.
                  </span>
                  <Link href={`/p/${person.id}#ranking`} className="rounded-xl bg-rose px-4 py-2 text-sm font-semibold text-white hover:bg-ink">
                    See their ranking →
                  </Link>
                  <Link href={`/dates?kind=full&p=${person.id}`} className="text-sm underline">
                    Watch their dates
                  </Link>
                </>
              ) : existing ? (
                <>
                  <span className="text-sm text-muted">This person already has an agent.</span>
                  <button onClick={() => goDating(person.id)} className="rounded-xl bg-rose px-4 py-2 text-sm font-semibold text-white hover:bg-ink">
                    Send the agent dating live →
                  </button>
                  <Link href={`/p/${person.id}#ranking`} className="text-sm underline">
                    or see the existing ranking
                  </Link>
                </>
              ) : (
                <span className="text-sm text-muted">Sending {firstName(person.name)}&apos;s agent to speed dating…</span>
              )}
            </div>
          )}
        </section>
      )}

      {/* 3. Speed dates */}
      {speed.length > 0 && me && (
        <section className="mb-10">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <h2 className="font-display text-3xl">Round 1 · {firstName(person?.name || "")}&apos;s agent speed-dates everyone</h2>
            <span className="text-sm text-muted">
              {speed.filter((d) => d.done).length}/{speed.length} finished
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {speed
              .slice()
              .sort((x, y) => x.id.localeCompare(y.id))
              .map((d) => {
                const other = mini(d.a === person!.id ? d.b : d.a);
                const mine = d.a === person!.id ? d.scoreA : d.scoreB;
                const theirs = d.a === person!.id ? d.scoreB : d.scoreA;
                const nextSpeaker = d.messages.length % 2 === 0 ? d.messages[0]?.speaker ?? "a" : d.messages[0]?.speaker === "a" ? "b" : "a";
                return (
                  <div key={d.id} className="flex h-72 flex-col rounded-2xl border border-line bg-card p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <MiniAvatar p={other} size={26} />
                      <span className="truncate font-semibold">{other.name}</span>
                      {d.done && mine && theirs ? (
                        <span className="ml-auto flex items-center gap-1 text-xs">
                          <span className="rounded-full bg-rose-soft px-2 py-0.5 font-semibold text-rose">{mine.overall}</span>
                          <span className="rounded-full bg-plum-soft px-2 py-0.5 font-semibold text-plum">{theirs.overall}</span>
                          {mine.secondDate && theirs.secondDate && <span className="text-rose">♥</span>}
                        </span>
                      ) : (
                        <span className="ml-auto text-xs text-muted">{d.messages.length < 6 ? "talking…" : "scoring…"}</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                      {d.messages.map((m, i) => (
                        <Bubble key={i} m={m} a={mini(d.a)} b={mini(d.b)} compact />
                      ))}
                      {!d.done && d.messages.length < 6 && (
                        <div className="scale-75 origin-left">
                          <Typing who={mini(nextSpeaker === "a" ? d.a : d.b)} side={nextSpeaker as "a" | "b"} />
                        </div>
                      )}
                    </div>
                    {d.done && mine && <div className="mt-2 line-clamp-2 border-t border-line pt-2 text-xs italic text-ink/75">“{mine.verdict}”</div>}
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* 4. Full dates */}
      {full.length > 0 && me && (
        <section className="mb-10">
          <h2 className="mb-3 font-display text-3xl">Round 2 · Full dates with the top mutual matches</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {full.map((d) => {
              const other = mini(d.a === person!.id ? d.b : d.a);
              return (
                <button
                  key={d.id}
                  onClick={() => setFocus(d.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${focus === d.id ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}
                >
                  <MiniAvatar p={other} size={22} /> {other.name}
                  {!d.done && <span className="h-2 w-2 animate-pulse rounded-full bg-rose" />}
                </button>
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

      {/* 5. Ranking */}
      {phase === "done" && person && (
        <section className="mb-10 animate-pop rounded-3xl border border-rose/30 bg-card p-6">
          <h2 className="font-display text-4xl">Who fits {firstName(person.name)} best</h2>
          {note && (
            <div className="mt-3 rounded-xl bg-rose-soft/70 p-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-rose">The agent&apos;s final call</div>
              <p className="italic">“{note}”</p>
            </div>
          )}
          <p className="mt-3 text-sm text-muted">
            The agent reviewed every date and ranked its shortlist itself (★). Fit score = 65% {firstName(person.name)}&apos;s agent + 35% the
            other agent, +5 if both want a second date after a full date.
          </p>
          <ol className="mt-4 divide-y divide-line">
            {ranking.slice(0, 10).map((r, i) => {
              const q = mini(r.personId);
              return (
                <li key={r.personId} className="flex items-center gap-3 py-2.5">
                  <span className={`w-7 text-center font-display text-2xl ${i < 3 ? "text-rose" : "text-muted"}`}>{i + 1}</span>
                  <MiniAvatar p={q} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${q.id}`} className="font-semibold hover:text-rose">
                      {q.name}
                    </Link>
                    <div className="truncate text-xs text-muted">“{r.reason}”</div>
                  </div>
                  {r.agentRank === 1 && <span className="text-rose" title="The agent's own pick">★</span>}
                  <span className="rounded-full bg-rose-soft px-2.5 py-0.5 font-semibold tabular-nums text-rose">{r.fit}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex gap-3">
            <Link href={`/p/${person.id}`} className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-rose">
              Open {firstName(person.name)}&apos;s profile page →
            </Link>
            <Link href="/rankings" className="rounded-xl border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper">
              All rankings
            </Link>
          </div>
        </section>
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
    <div className="rounded-3xl border border-line bg-card p-4 sm:p-6">
      <div className="mb-3 text-center">
        <div className="text-xs uppercase tracking-widest text-muted">
          {a.name} × {b.name}
        </div>
        <div className="font-display text-3xl">{d.venue || "Planning the date…"}</div>
      </div>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
        {d.messages.map((m, i) => (
          <Bubble key={i} m={m} a={a} b={b} />
        ))}
        {!d.done && d.venue && d.messages.length < 15 && <Typing who={nextSpeaker === "a" ? a : b} side={nextSpeaker} />}
        <div ref={end} />
      </div>
      {d.scoreA && d.scoreB && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ScoreCard s={d.scoreA} me={a} other={b} big />
          <ScoreCard s={d.scoreB} me={b} other={a} big />
        </div>
      )}
    </div>
  );
}
