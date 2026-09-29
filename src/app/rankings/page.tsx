import Link from "next/link";
import { Heart, Star } from "lucide-react";
import { FitPill, Heading, PersonAvatar } from "@/components/bits";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pairId } from "@/lib/dating";
import { firstName } from "@/lib/names";
import { loadWorld, mutualPicks } from "@/lib/world";

export const dynamic = "force-dynamic";

// one hue, light → dark
const cell = (fit: number) => `color-mix(in oklab, var(--primary) ${Math.round(10 + Math.max(0, Math.min(1, (fit - 55) / 35)) * 85)}%, var(--card))`;

export default async function RankingsPage() {
  const w = await loadWorld();
  const people = w.people;
  const ids = new Set(w.dates.map((d) => d.id));
  const couples = mutualPicks(w).map(([a, b]) => {
    const full = pairId("full", a.id, b.id);
    return { a, b, href: `/dates/${ids.has(full) ? full : pairId("speed", a.id, b.id)}`, venue: w.dates.find((d) => d.id === full)?.venue };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Heading kicker="The rankings" title="Who fits each person best">
        Every date ends with two private scorecards. Fit = 65% the person&apos;s own agent + 35% the other agent (it has to be mutual). Then each
        agent reviews its shortlist and makes the final call on the order.
      </Heading>

      {couples.length > 0 && (
        <section className="mb-12">
          <h3 className="mb-1 font-display text-3xl">Mutual #1 picks</h3>
          <p className="mb-4 text-sm text-muted-foreground">Both agents, independently, chose each other.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {couples.map(({ a, b, href, venue }) => (
              <Link key={a.id + b.id} href={href}>
                <Card className="h-full border-primary/30 bg-primary/5 transition hover:border-primary">
                  <CardContent className="space-y-2">
                    <div className="flex items-center">
                      <PersonAvatar person={a} className="size-12" ring />
                      <Heart className="z-10 -mx-1.5 size-5 fill-primary text-primary" />
                      <PersonAvatar person={b} className="size-12" ring />
                    </div>
                    <div className="font-medium">
                      {firstName(a.name)} & {firstName(b.name)}
                    </div>
                    {venue && <div className="text-xs text-muted-foreground">{venue}</div>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-12">
        <h3 className="mb-4 font-display text-3xl">Top 3 for everyone</h3>
        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {people.map((p) => (
              <div key={p.id} className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[220px_1fr]">
                <Link href={`/p/${p.id}#ranking`} className="flex items-center gap-2 hover:text-primary">
                  <PersonAvatar person={p} className="size-9" />
                  <span className="truncate font-medium">{p.name}</span>
                </Link>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(w.rankings[p.id] || []).slice(0, 3).map((e, i) => {
                    const q = w.byId.get(e.personId)!;
                    return (
                      <Link key={e.personId} href={`/dates/${e.dateIds[0]}`} className="flex items-center gap-2 rounded-xl border bg-muted/30 px-2.5 py-1.5 hover:border-primary/40">
                        <span className="font-display text-xl text-primary">{i + 1}</span>
                        <PersonAvatar person={q} className="size-6" />
                        <span className="min-w-0 flex-1 truncate text-sm">{q.name}</span>
                        {i === 0 && e.agentRank === 1 && <Star className="size-3.5 fill-primary text-primary" />}
                        <FitPill fit={e.fit} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <h3 className="mb-1 font-display text-3xl">The whole fit matrix</h3>
        <p className="mb-3 text-sm text-muted-foreground">Row = person being matched, column = candidate. Brighter = better fit for the row. Hover a cell, click to open the date.</p>
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>55</span>
          <div className="h-2 w-40 rounded" style={{ background: `linear-gradient(to right, ${cell(55)}, ${cell(90)})` }} />
          <span>90+</span>
        </div>
        <Card className="overflow-x-auto p-3">
          <table className="border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th />
                {people.map((p) => (
                  <th key={p.id} className="p-0">
                    <Link href={`/p/${p.id}`} title={p.name}>
                      <PersonAvatar person={p} className="mx-auto size-6" />
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((row) => {
                const byCand = new Map((w.rankings[row.id] || []).map((e) => [e.personId, e]));
                return (
                  <tr key={row.id}>
                    <th className="whitespace-nowrap pr-2 text-left text-xs font-normal text-muted-foreground">
                      <Link href={`/p/${row.id}#ranking`} className="hover:text-foreground">
                        {row.name}
                      </Link>
                    </th>
                    {people.map((col) => {
                      const e = byCand.get(col.id);
                      if (col.id === row.id || !e) return <td key={col.id} className="size-7 rounded bg-muted/40" />;
                      return (
                        <td key={col.id} className="p-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={`/dates/${e.dateIds[0]}`}
                                className="flex size-7 items-center justify-center rounded text-[10px] text-white hover:outline hover:outline-2 hover:outline-foreground"
                                style={{ background: cell(e.fit) }}
                              >
                                {e.agentRank === 1 ? "★" : ""}
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-64">
                              <div className="font-medium">
                                {firstName(row.name)} → {col.name}: {e.fit}
                              </div>
                              <div className="opacity-80">{e.reason}</div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
