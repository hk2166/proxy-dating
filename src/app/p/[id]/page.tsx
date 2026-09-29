import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisView, ReadingLog, SourcesView } from "@/components/Profile";
import { RankingList } from "@/components/RankingList";
import { RemoveButton } from "@/components/RemoveButton";
import { Avatar, FitBadge, SourceBadge, Tag } from "@/components/ui";
import { loadWorld } from "@/lib/world";
import { firstName } from "@/lib/names";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await loadWorld();
  const person = w.byId.get(id);
  if (!person || !person.analysis) notFound();
  const a = person.analysis;
  const first = firstName(person.name);
  const ranking = w.rankings[id] || [];
  const myDates = w.dates
    .filter((d) => d.a === id || d.b === id)
    .sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "full" ? -1 : 1));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-6 rounded-3xl border border-line bg-card p-6 sm:flex-row sm:items-start">
        <Avatar person={person} size={112} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-4xl sm:text-5xl">{person.name}</h1>
            {person.origin === "live" && <Tag tone="green">joined live</Tag>}
          </div>
          <p className="mt-1 text-lg">{a.headline}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {a.vibe.map((v) => (
              <Tag key={v} tone="rose">
                {v}
              </Tag>
            ))}
          </div>
          <p className="mt-4 max-w-3xl text-ink/80">{a.summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 hover:border-ink">
              <SourceBadge source="linkedin" /> LinkedIn
            </a>
            <a href={person.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 hover:border-ink">
              <SourceBadge source="instagram" /> Instagram
            </a>
            <span className="text-xs text-muted">The only two sources this agent was allowed to use.</span>
          </div>
        </div>
      </div>

      <nav className="sticky top-[53px] z-20 -mx-4 mt-4 flex gap-4 overflow-x-auto border-b border-line bg-paper/90 px-4 py-2 text-sm backdrop-blur">
        <a href="#needs" className="text-muted hover:text-ink">Profile</a>
        <a href="#reading" className="text-muted hover:text-ink">How the agent read {first}</a>
        <a href="#dates" className="text-muted hover:text-ink">Dates ({myDates.length})</a>
        <a href="#ranking" className="text-muted hover:text-ink">Ranking</a>
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <AnalysisView person={person} a={a} />

          <section id="reading" className="scroll-mt-28">
            <h2 className="font-display text-3xl">How the agent read {first}</h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              Before dating on {first}&apos;s behalf, the agent read each source and wrote these notes: what it saw → what it concluded. The
              profile above was synthesized only from these notes and the raw sources.
            </p>
            {person.reading && <ReadingLog notes={person.reading} />}
            <div className="mt-4">
              <SourcesView person={person} />
            </div>
          </section>

          <section id="dates" className="scroll-mt-28">
            <h2 className="mb-4 font-display text-3xl">{first}&apos;s dates</h2>
            {myDates.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">
                No dates yet. <Link className="text-rose underline" href={`/join?id=${person.id}`}>Send {first}&apos;s agent dating →</Link>
              </div>
            )}
            <div className="grid gap-2">
              {myDates.map((d) => {
                const otherId = d.a === id ? d.b : d.a;
                const other = w.byId.get(otherId);
                const mine = d.a === id ? d.scoreA : d.scoreB;
                const theirs = d.a === id ? d.scoreB : d.scoreA;
                if (!other) return null;
                return (
                  <Link key={d.id} href={`/dates/${d.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 hover:border-ink">
                    <Avatar person={other} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {other.name}
                        <Tag tone={d.kind === "full" ? "plum" : "neutral"}>{d.kind === "full" ? "full date" : "speed date"}</Tag>
                      </div>
                      <div className="truncate text-xs text-muted">{d.kind === "full" ? d.venue : mine?.verdict}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted">
                      {mine && <FitBadge fit={mine.overall} />}
                      {theirs && <FitBadge fit={theirs.overall} />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <aside id="ranking" className="scroll-mt-28">
          <div className="rounded-2xl border border-line bg-card p-4 lg:sticky lg:top-28">
            <div className="font-display text-2xl">Who fits {first} best</div>
            {person.decision && (
              <div className="mt-2 rounded-xl bg-rose-soft/70 p-3 text-sm">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-rose">The agent&apos;s final call</div>
                <p className="italic">“{person.decision.note}”</p>
              </div>
            )}
            <p className="mb-2 mt-2 text-xs text-muted">
              After all its dates, {first}&apos;s agent ranked its shortlist itself. Fit score = 65% its own view + 35% the other
              agent&apos;s view, +5 if both want a second date after a full date.
            </p>
            {ranking.length ? (
              <div className="max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
                <RankingList entries={ranking} byId={w.byId} />
              </div>
            ) : (
              <div className="py-6 text-sm text-muted">No dates yet — ranking appears after the agent dates.</div>
            )}
          </div>
          <div className="mt-3 text-right">
            <RemoveButton id={person.id} name={person.name} />
          </div>
        </aside>
      </div>
    </div>
  );
}
