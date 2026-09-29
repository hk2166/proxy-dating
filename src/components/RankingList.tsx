import Link from "next/link";
import type { Person, RankEntry } from "@/lib/types";
import { Avatar, FitBadge } from "./ui";

export function RankingList({ entries, byId, limit }: { entries: RankEntry[]; byId: Map<string, Person>; limit?: number }) {
  const list = limit ? entries.slice(0, limit) : entries;
  return (
    <ol className="divide-y divide-line">
      {list.map((r, i) => {
        const p = byId.get(r.personId);
        if (!p) return null;
        return (
          <li key={r.personId} className="py-3">
            <div className="flex items-center gap-2.5">
              <span className={`w-6 text-center font-display text-xl ${i < 3 ? "text-rose" : "text-muted"}`}>{i + 1}</span>
              <Link href={`/p/${p.id}`}>
                <Avatar person={p} size={34} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/p/${p.id}`} className="block truncate text-sm font-semibold hover:text-rose">
                  {p.name}
                </Link>
                <div className="flex flex-wrap gap-x-2 text-[11px] text-muted">
                  <span>my agent {r.myView}</span>
                  <span>their agent {r.theirView}</span>
                  {r.agentRank === 1 && <span className="font-semibold text-rose">★ agent&apos;s pick</span>}
                  {r.fullDate && <span className="text-plum">full date</span>}
                  {r.mutual && <span className="text-rose">♥ both want more</span>}
                </div>
              </div>
              <FitBadge fit={r.fit} />
            </div>
            {r.reason && (
              <Link href={`/dates/${r.dateIds[0]}`} className="ml-8 mt-1 block text-xs text-ink/75 hover:text-rose">
                “{r.reason}” <span className="text-muted">→ date</span>
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
