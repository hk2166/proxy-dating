import Link from "next/link";
import { JoinForm } from "@/components/JoinForm";
import { Avatar, FitBadge, SectionTitle, Tag } from "@/components/ui";
import { pairId } from "@/lib/dating";
import { bestDates, loadWorld, mutualPicks, stats } from "@/lib/world";

export const dynamic = "force-dynamic";

export default async function Home() {
  const w = await loadWorld();
  const s = stats(w);
  const featured = bestDates(w, "full", 6);
  const picks = mutualPicks(w);
  const hero = picks.map(([a, b]) => w.dates.find((d) => d.id === pairId("full", a.id, b.id))).find(Boolean) || featured[0];
  const heroA = hero && w.byId.get(hero.a);
  const heroB = hero && w.byId.get(hero.b);

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-10 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-rose" /> {s.people} agents · {s.speed + s.full} dates so far
          </div>
          <h1 className="font-display text-5xl leading-[1.02] sm:text-7xl">
            They read you.
            <br />
            <em className="text-rose">Then they date for you.</em>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Paste someone&apos;s LinkedIn and public Instagram. Their agent reads both, writes their profile (needs, hobbies,
            interests), goes on dates with every other agent on their behalf, and ranks who fits them best.
          </p>
          <div className="mt-7">
            <JoinForm />
          </div>
        </div>

        {hero && heroA && heroB && (
          <Link href={`/dates/${hero.id}`} className="group block self-center rounded-3xl border border-line bg-card p-5 shadow-sm transition hover:shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex -space-x-3">
                <Avatar person={heroA} size={44} />
                <Avatar person={heroB} size={44} />
              </div>
              <Tag tone="rose">{picks.length ? "A mutual #1 pick" : "Top date of the night"}</Tag>
            </div>
            <div className="text-sm text-muted">
              {heroA.name} × {heroB.name}
            </div>
            <div className="font-display text-2xl">{hero.venue}</div>
            <div className="mt-4 space-y-2">
              {hero.messages
                .filter((m) => m.speaker !== "host")
                .slice(0, 4)
                .map((m, i) => (
                  <div key={i} className={`flex ${m.speaker === "a" ? "" : "justify-end"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.speaker === "a" ? "rounded-bl-sm bg-rose-soft" : "rounded-br-sm bg-plum-soft"
                      }`}
                    >
                      <span className="line-clamp-3">{m.text}</span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-4 text-sm font-medium text-rose group-hover:underline">Watch the whole date →</div>
          </Link>
        )}
      </section>

      {/* Stats */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-5">
          {[
            [s.people, "agents, one per real person"],
            [s.speed, "speed dates (every pair)"],
            [s.full, "full dates with a host"],
            [s.lines.toLocaleString(), "lines of agent conversation"],
            [s.mutual, "mutual #1 picks"],
          ].map(([n, l]) => (
            <div key={String(l)}>
              <div className="font-display text-4xl">{n}</div>
              <div className="text-xs text-muted">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <SectionTitle kicker="How it works" title="From two links to a ranked list of matches" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1 · Read", "The agent scrapes the public LinkedIn and Instagram, then reads each one — captions, photos, career moves — writing evidence-backed notes."],
            ["2 · Profile", "It turns the notes into a profile: needs, hobbies, interests, values, personality, dealbreakers. Every claim cites its source."],
            ["3 · Date", "Agents speed-date every other agent, then go on full dates with their best mutual matches — a Date Host runs the evening and throws curveballs."],
            ["4 · Rank", "After each date, each agent privately reports back to its person. Then each agent reviews all its dates and commits to a final ranking of who fits its person best."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line bg-card p-5">
              <div className="font-display text-2xl">{t}</div>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agents */}
      <section id="agents" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-14">
        <SectionTitle kicker="The pool" title={`${s.people} people, ${s.people} agents`}>
          Real people, found by us, each with exactly two public sources. Open any profile to see how their agent read them.
        </SectionTitle>
        {w.people.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">
            No agents yet. Run <code>npm run seed</code> or add a person above.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {w.people.map((p) => {
            const top = w.rankings[p.id]?.[0];
            const topP = top && w.byId.get(top.personId);
            return (
              <Link key={p.id} href={`/p/${p.id}`} className="group flex flex-col rounded-2xl border border-line bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <Avatar person={p} size={52} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{p.name}</span>
                      {p.origin === "live" && <Tag tone="green">joined live</Tag>}
                    </div>
                    <div className="line-clamp-2 text-sm text-muted">{p.analysis?.headline}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.analysis?.vibe.slice(0, 3).map((v) => (
                    <Tag key={v}>{v}</Tag>
                  ))}
                </div>
                {topP && (
                  <div className="mt-auto flex items-center gap-2 border-t border-line pt-3 text-sm">
                    <span className="text-muted">Best fit</span>
                    <Avatar person={topP} size={22} />
                    <span className="truncate font-medium">{topP.name}</span>
                    <span className="ml-auto">
                      <FitBadge fit={top.fit} />
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured dates */}
      {featured.length > 0 && (
        <section className="border-t border-line bg-card">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <SectionTitle kicker="Tonight's best dates" title="Watch the agents date">
              Full dates between top mutual matches. Each agent speaks for its person; the host sets scenes and throws curveballs.
            </SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((d) => {
                const a = w.byId.get(d.a)!;
                const b = w.byId.get(d.b)!;
                return (
                  <Link key={d.id} href={`/dates/${d.id}`} className="rounded-2xl border border-line bg-paper p-4 transition hover:shadow-md">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        <Avatar person={a} size={34} />
                        <Avatar person={b} size={34} />
                      </div>
                      <div className="min-w-0 text-sm font-medium">
                        <div className="truncate">
                          {a.name} × {b.name}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 font-display text-xl leading-tight">{d.venue}</div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted">“{d.scoreA?.verdict}”</p>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <FitBadge fit={d.scoreA!.overall} />
                      <FitBadge fit={d.scoreB!.overall} />
                      {d.scoreA?.secondDate && d.scoreB?.secondDate && <Tag tone="rose">♥ both want a 2nd date</Tag>}
                      {w.rankings[d.a]?.[0]?.personId === d.b && w.rankings[d.b]?.[0]?.personId === d.a && <Tag tone="plum">mutual #1 pick</Tag>}
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-6 flex gap-3">
              <Link href="/dates" className="rounded-xl border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper">
                All dates
              </Link>
              <Link href="/rankings" className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-rose">
                See the rankings
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
