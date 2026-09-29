import Link from "next/link";
import { Heart } from "lucide-react";
import { FitPill, Heading, PersonAvatar } from "@/components/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mutualScore } from "@/lib/dating";
import { cn } from "@/lib/utils";
import { loadWorld } from "@/lib/world";

export const dynamic = "force-dynamic";

export default async function DatesPage({ searchParams }: { searchParams: Promise<{ kind?: string; p?: string }> }) {
  const { kind = "full", p } = await searchParams;
  const w = await loadWorld();
  const list = w.dates
    .filter((d) => d.kind === kind && d.scoreA && d.scoreB && (!p || d.a === p || d.b === p))
    .sort((x, y) => mutualScore(y) - mutualScore(x));
  const count = (k: string) => w.dates.filter((d) => d.kind === k).length;
  const who = p ? w.byId.get(p) : undefined;
  const q = (k: string) => `/dates?kind=${k}${p ? `&p=${p}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Heading kicker="The dates" title={who ? `${who.name}'s dates` : "Every date the agents went on"}>
        Round 1: every pair of agents speed-dates, six lines each. Round 2: each person&apos;s best matches go on a full date run by a host.
        Sorted by how much both sides liked it.
      </Heading>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["full", "speed"] as const).map((k) => (
          <Button key={k} asChild size="sm" variant={kind === k ? "default" : "secondary"} className="rounded-full">
            <Link href={q(k)}>
              {k === "full" ? "Full dates" : "Speed dates"} · {count(k)}
            </Link>
          </Button>
        ))}
        {who && (
          <Button asChild size="sm" variant="ghost" className="rounded-full">
            <Link href={`/dates?kind=${kind}`}>✕ everyone</Link>
          </Button>
        )}
      </div>

      <div className={cn("grid gap-3", kind === "full" ? "md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {list.map((d) => {
          const a = w.byId.get(d.a)!;
          const b = w.byId.get(d.b)!;
          const opener = d.messages.find((m) => m.speaker !== "host")?.text;
          return (
            <Link key={d.id} href={`/dates/${d.id}`}>
              <Card className="h-full transition hover:border-primary/40">
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-3">
                      <PersonAvatar person={a} ring />
                      <PersonAvatar person={b} ring />
                    </div>
                    <div className="min-w-0 flex-1 truncate text-sm font-medium">
                      {a.name} × {b.name}
                    </div>
                    <FitPill fit={d.scoreA!.overall} />
                    <FitPill fit={d.scoreB!.overall} />
                  </div>
                  {d.kind === "full" && <div className="font-display text-2xl leading-tight">{d.venue}</div>}
                  {opener && <p className="line-clamp-2 text-sm text-muted-foreground">“{opener}”</p>}
                  {d.kind === "full" && d.scoreA!.secondDate && d.scoreB!.secondDate && (
                    <Badge className="bg-primary/15 font-normal text-primary">
                      <Heart className="fill-primary" /> both want more
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      {list.length === 0 && <p className="py-20 text-center text-muted-foreground">No dates yet.</p>}
    </div>
  );
}
