import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FitPill, PersonAvatar } from "@/components/bits";
import type { Person, RankEntry } from "@/lib/types";

// Hinge-ish card: big photo, name over a gradient, vibes underneath.
export function PersonCard({ p, top, topPerson }: { p: Person; top?: RankEntry; topPerson?: Person }) {
  return (
    <Link href={`/p/${p.id}`} className="group block overflow-hidden rounded-3xl border bg-card transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        {p.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar} alt={p.name} className="size-full object-cover transition duration-500 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        {p.origin === "live" && <Badge className="absolute left-3 top-3 bg-mint text-black">joined live</Badge>}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="font-display text-3xl leading-none text-white">{p.name}</div>
          <p className="mt-1.5 line-clamp-2 text-sm text-white/75">{p.analysis?.headline}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {p.analysis?.vibe.slice(0, 3).map((v) => (
            <Badge key={v} variant="secondary" className="font-normal">
              {v}
            </Badge>
          ))}
        </div>
        {top && topPerson && (
          <div className="flex items-center gap-2 border-t pt-3 text-sm">
            <span className="text-muted-foreground">Agent&apos;s pick</span>
            <PersonAvatar person={topPerson} className="size-6" />
            <span className="truncate font-medium">{topPerson.name}</span>
            <FitPill fit={top.fit} className="ml-auto" />
          </div>
        )}
      </div>
    </Link>
  );
}
