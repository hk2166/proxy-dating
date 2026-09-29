import Link from "next/link";
import { notFound } from "next/navigation";
import { Heart } from "lucide-react";
import { PersonAvatar } from "@/components/bits";
import { CurveballPanel } from "@/components/CurveballPanel";
import { DateReplay } from "@/components/DateView";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { pairId } from "@/lib/dating";
import { firstName } from "@/lib/names";
import { loadWorld } from "@/lib/world";

export const dynamic = "force-dynamic";

export default async function DatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await loadWorld();
  const date = w.dates.find((d) => d.id === id);
  if (!date) notFound();
  const a = w.byId.get(date.a)!;
  const b = w.byId.get(date.b)!;
  const mini = (p: typeof a) => ({ id: p.id, name: p.name, avatar: p.avatar, voice: p.voice });
  const sibling = w.dates.find((d) => d.id === pairId(date.kind === "full" ? "speed" : "full", date.a, date.b));
  const mutual = w.rankings[a.id]?.[0]?.personId === b.id && w.rankings[b.id]?.[0]?.personId === a.id;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-4">
          <Link href={`/p/${a.id}`} className="text-center">
            <PersonAvatar person={a} className="mx-auto size-20 ring-2 ring-primary/40" />
            <div className="mt-2 text-sm font-medium">{a.name}</div>
          </Link>
          <div className="grid size-11 place-items-center rounded-full bg-sunset shadow-lg shadow-primary/30">
            <Heart className="size-5 fill-white text-white" />
          </div>
          <Link href={`/p/${b.id}`} className="text-center">
            <PersonAvatar person={b} className="mx-auto size-20 ring-2 ring-violet/40" />
            <div className="mt-2 text-sm font-medium">{b.name}</div>
          </Link>
        </div>
        <div className="flex justify-center gap-2">
          <Badge variant="secondary">{date.kind === "full" ? "Round 2 · full date" : "Round 1 · speed date"}</Badge>
          {mutual && <Badge className="bg-sunset text-white">mutual #1 pick</Badge>}
        </div>
        <h1 className="mt-3 font-display text-5xl leading-tight">{date.kind === "full" ? date.venue : "Agent speed-dating night"}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          {date.kind === "full"
            ? "Each agent speaks for its person using only its private profile. The host can see both profiles, sets each scene and pokes at their likely friction points."
            : "Six lines. Each agent knows only the other person's public card, plus its own private profile."}
        </p>
        {sibling && (
          <Link href={`/dates/${sibling.id}`} className="mt-2 inline-block text-sm text-primary hover:underline">
            {sibling.kind === "full" ? `They went on a full date too → ${sibling.venue}` : "← See their speed date first"}
          </Link>
        )}
      </div>

      {date.plan && (
        <Card className="mb-4">
          <CardContent className="space-y-1.5 text-sm">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">How the agents planned it</div>
            <p>
              <span className="font-medium text-primary">{firstName(a.name)}&apos;s agent:</span> {date.plan.a}
            </p>
            <p>
              <span className="font-medium text-violet">{firstName(b.name)}&apos;s agent:</span> {date.plan.b}
            </p>
          </CardContent>
        </Card>
      )}

      <DateReplay date={date} a={mini(a)} b={mini(b)} />

      <div className="mt-10">
        <CurveballPanel dateId={date.id} a={mini(a)} b={mini(b)} />
      </div>
    </div>
  );
}
