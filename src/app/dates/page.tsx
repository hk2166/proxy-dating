import Link from "next/link";
import { Avatar, FitBadge, SectionTitle, Tag } from "@/components/ui";
import { mutualScore } from "@/lib/dating";
import { loadWorld } from "@/lib/world";

export const dynamic = "force-dynamic";

export default async function DatesPage({ searchParams }: { searchParams: Promise<{ kind?: string; p?: string }> }) {
  const { kind = "full", p } = await searchParams;
  const w = await loadWorld();
  const list = w.dates
    .filter((d) => d.kind === kind && d.scoreA && d.scoreB)
    .filter((d) => !p || d.a === p || d.b === p)
    .sort((x, y) => mutualScore(y) - mutualScore(x));
  const counts = { full: w.dates.filter((d) => d.kind === "full").length, speed: w.dates.filter((d) => d.kind === "speed").length };
  const who = p && w.byId.get(p);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionTitle kicker="The dates" title={who ? `${who.name}'s dates` : "Every date the agents went on"}>
        Round 1: every pair of agents speed-dates (6 lines, then two private scorecards). Round 2: each person&apos;s top mutual
        matches go on a full date run by a Date Host. Sorted by mutual score.
      </SectionTitle>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {(["full", "speed"] as const).map((k) => (
          <Link
            key={k}
            href={`/dates?kind=${k}${p ? `&p=${p}` : ""}`}
            className={`rounded-full border px-3.5 py-1.5 ${kind === k ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink"}`}
          >
            {k === "full" ? `Full dates (${counts.full})` : `Speed dates (${counts.speed})`}
          </Link>
        ))}
        {who && (
          <Link href={`/dates?kind=${kind}`} className="text-muted hover:text-ink">
            ✕ clear filter
          </Link>
        )}
      </div>

      <div className={`grid gap-3 ${kind === "full" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {list.map((d) => {
          const a = w.byId.get(d.a)!;
          const b = w.byId.get(d.b)!;
          const both = d.scoreA!.secondDate && d.scoreB!.secondDate;
          return (
            <Link key={d.id} href={`/dates/${d.id}`} className="rounded-2xl border border-line bg-card p-4 transition hover:border-ink">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <Avatar person={a} size={32} />
                  <Avatar person={b} size={32} />
                </div>
                <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {a.name} × {b.name}
                </div>
                <FitBadge fit={d.scoreA!.overall} />
                <FitBadge fit={d.scoreB!.overall} />
              </div>
              {d.kind === "full" && <div className="mt-2 font-display text-xl">{d.venue}</div>}
              <p className="mt-1 line-clamp-2 text-sm text-muted">“{d.messages.find((m) => m.speaker !== "host")?.text}”</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {both ? <Tag tone="rose">♥ mutual yes</Tag> : d.scoreA!.secondDate || d.scoreB!.secondDate ? <Tag tone="plum">one-sided</Tag> : <Tag>no spark</Tag>}
              </div>
            </Link>
          );
        })}
      </div>
      {list.length === 0 && <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">No dates yet.</div>}
    </div>
  );
}
