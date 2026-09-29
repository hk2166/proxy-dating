import Link from "next/link";
import { Star } from "lucide-react";
import { FitPill, PersonAvatar } from "@/components/bits";
import { cn } from "@/lib/utils";
import type { Person, RankEntry } from "@/lib/types";

export function RankingList({ entries, byId, limit }: { entries: RankEntry[]; byId: Map<string, Person>; limit?: number }) {
  return (
    <ol className="divide-y">
      {(limit ? entries.slice(0, limit) : entries).map((r, i) => {
        const p = byId.get(r.personId);
        if (!p) return null;
        return (
          <li key={r.personId} className="py-3">
            <div className="flex items-center gap-2.5">
              <span className={cn("w-6 text-center font-display text-2xl", i < 3 ? "text-primary" : "text-muted-foreground")}>{i + 1}</span>
              <Link href={`/p/${p.id}`}>
                <PersonAvatar person={p} className="size-9" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/p/${p.id}`} className="flex items-center gap-1 truncate text-sm font-medium hover:text-primary">
                  {p.name}
                  {r.agentRank === 1 && <Star className="size-3.5 fill-primary text-primary" />}
                </Link>
                <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                  <span>mine {r.myView}</span>
                  <span>theirs {r.theirView}</span>
                  {r.fullDate && <span className="text-violet">full date</span>}
                </div>
              </div>
              <FitPill fit={r.fit} />
            </div>
            {r.reason && (
              <Link href={`/dates/${r.dateIds[0]}`} className="ml-8 mt-1.5 block text-xs leading-relaxed text-muted-foreground hover:text-foreground">
                “{r.reason}” <span className="text-primary">→ date</span>
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
