import Link from "next/link";
import { Avatar, FitBadge, SectionTitle, Tag } from "@/components/ui";
import { bestDates, loadWorld } from "@/lib/world";

export const dynamic = "force-dynamic";

// Sequential scale, one hue (rose), light → dark.
function cellColor(fit: number) {
  const t = Math.max(0, Math.min(1, (fit - 30) / 60));
  return `color-mix(in oklab, var(--rose) ${Math.round(8 + t * 92)}%, white)`;
}

export default async function RankingsPage() {
  const w = await loadWorld();
  const people = w.people;
  const couples = bestDates(w, "full", 8).filter((d) => d.scoreA?.secondDate && d.scoreB?.secondDate);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SectionTitle kicker="The rankings" title="Who fits each person best">
        For every person, their agent&apos;s private scorecards from every date become a ranking. Fit = 65% their own agent&apos;s view +
        35% the other agent&apos;s view (a match has to be mutual), +5 when both booked a second date.
      </SectionTitle>

      {couples.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-3 font-display text-2xl">Mutual matches of the night</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {couples.map((d) => {
              const a = w.byId.get(d.a)!;
              const b = w.byId.get(d.b)!;
              return (
                <Link key={d.id} href={`/dates/${d.id}`} className="rounded-2xl border border-rose/30 bg-rose-soft/50 p-4 hover:border-rose">
                  <div className="flex -space-x-2">
                    <Avatar person={a} size={40} />
                    <Avatar person={b} size={40} />
                  </div>
                  <div className="mt-2 text-sm font-semibold">
                    {a.name.split(" ")[0]} ♥ {b.name.split(" ")[0]}
                  </div>
                  <div className="text-xs text-muted">{d.venue}</div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-12">
        <h3 className="mb-3 font-display text-2xl">Top 3 for everyone</h3>
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          {people.map((p) => {
            const r = w.rankings[p.id] || [];
            return (
              <div key={p.id} className="grid items-center gap-3 border-b border-line p-3 last:border-0 sm:grid-cols-[220px_1fr]">
                <Link href={`/p/${p.id}#ranking`} className="flex items-center gap-2 hover:text-rose">
                  <Avatar person={p} size={36} />
                  <span className="truncate font-semibold">{p.name}</span>
                </Link>
                <div className="grid gap-2 sm:grid-cols-3">
                  {r.slice(0, 3).map((e, i) => {
                    const q = w.byId.get(e.personId)!;
                    return (
                      <Link key={e.personId} href={`/dates/${e.dateIds[0]}`} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5 hover:border-ink">
                        <span className="font-display text-lg text-rose">{i + 1}</span>
                        <Avatar person={q} size={24} />
                        <span className="min-w-0 flex-1 truncate text-sm">{q.name}</span>
                        {e.mutual && <span className="text-rose" title="Both agents want a second date">♥</span>}
                        <FitBadge fit={e.fit} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-1 font-display text-2xl">The full fit matrix</h3>
        <p className="mb-3 text-sm text-muted">
          Row = the person being matched, column = candidate. Darker = better fit for the row person. Hover a cell for details, click to open the date.
        </p>
        <div className="mb-3 flex items-center gap-2 text-xs text-muted">
          <span>fit 30</span>
          <div className="h-2 w-40 rounded" style={{ background: `linear-gradient(to right, ${cellColor(30)}, ${cellColor(90)})` }} />
          <span>90+</span>
          <Tag tone="rose">♥ = mutual second date</Tag>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-line bg-card p-3 scrollbar-thin">
          <table className="border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr>
                <th />
                {people.map((p) => (
                  <th key={p.id} className="p-0">
                    <Link href={`/p/${p.id}`} title={p.name}>
                      <Avatar person={p} size={26} className="mx-auto" />
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
                    <th className="pr-2 text-left text-xs font-medium whitespace-nowrap">
                      <Link href={`/p/${row.id}#ranking`} className="hover:text-rose">
                        {row.name}
                      </Link>
                    </th>
                    {people.map((col) => {
                      if (col.id === row.id) return <td key={col.id} className="h-7 w-7 rounded bg-line/40" />;
                      const e = byCand.get(col.id);
                      if (!e) return <td key={col.id} className="h-7 w-7 rounded bg-paper" />;
                      return (
                        <td key={col.id} className="h-7 w-7 p-0">
                          <Link
                            href={`/dates/${e.dateIds[0]}`}
                            title={`${row.name} → ${col.name}: fit ${e.fit} (their agent ${e.theirView})${e.mutual ? " · mutual" : ""}\n“${e.reason}”`}
                            className="flex h-7 w-7 items-center justify-center rounded text-[9px] font-semibold text-white/90 outline-offset-1 hover:outline hover:outline-2 hover:outline-ink"
                            style={{ background: cellColor(e.fit) }}
                          >
                            {e.mutual ? "♥" : ""}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
