import Link from "next/link";
import { notFound } from "next/navigation";
import { DateReplay } from "@/components/DateView";
import { Avatar, Tag } from "@/components/ui";
import { pairId } from "@/lib/dating";
import { loadWorld } from "@/lib/world";

export const dynamic = "force-dynamic";

export default async function DatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await loadWorld();
  const date = w.dates.find((d) => d.id === id);
  if (!date) notFound();
  const a = w.byId.get(date.a)!;
  const b = w.byId.get(date.b)!;
  const mini = (p: typeof a) => ({ id: p.id, name: p.name, avatar: p.avatar });
  const other = w.dates.find((d) => d.id === pairId(date.kind === "full" ? "speed" : "full", date.a, date.b));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mb-3 flex items-center justify-center gap-3">
          <Link href={`/p/${a.id}`} className="text-center">
            <Avatar person={a} size={64} className="mx-auto" />
            <div className="mt-1 text-sm font-medium">{a.name}</div>
          </Link>
          <span className="font-display text-3xl text-rose">×</span>
          <Link href={`/p/${b.id}`} className="text-center">
            <Avatar person={b} size={64} className="mx-auto" />
            <div className="mt-1 text-sm font-medium">{b.name}</div>
          </Link>
        </div>
        <Tag tone={date.kind === "full" ? "plum" : "neutral"}>{date.kind === "full" ? "Round 2 · full date" : "Round 1 · speed date"}</Tag>
        <h1 className="mt-2 font-display text-4xl">{date.kind === "full" ? date.venue : "Agent speed-dating night"}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          {date.kind === "full"
            ? "Each agent speaks as its person's stand-in, using only its private dossier. A Date Host who can see both dossiers sets each scene and tests their likely friction points."
            : "Three minutes, six lines. Each agent only knows the other person's public card — and its own private dossier."}
        </p>
        {other && (
          <Link href={`/dates/${other.id}`} className="mt-2 inline-block text-sm text-rose hover:underline">
            {other.kind === "full" ? `They went on a full date too → ${other.venue}` : "← See their speed date first"}
          </Link>
        )}
      </div>

      {date.plan && (
        <div className="mb-4 rounded-2xl border border-line bg-card p-4 text-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">How the agents planned this date</div>
          <p>
            <span className="font-semibold">{a.name.split(" ")[0]}&apos;s agent:</span> {date.plan.a}
          </p>
          <p className="mt-1">
            <span className="font-semibold">{b.name.split(" ")[0]}&apos;s agent:</span> {date.plan.b}
          </p>
        </div>
      )}

      <DateReplay date={date} a={mini(a)} b={mini(b)} />
    </div>
  );
}
