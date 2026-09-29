import { Heading } from "@/components/bits";
import { SwipeDeck, type Deal } from "@/components/SwipeDeck";
import { loadWorld } from "@/lib/world";

export const dynamic = "force-dynamic";
export const metadata = { title: "Play matchmaker — Proxy" };

function shuffle<T>(xs: T[]) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(w: Awaited<ReturnType<typeof loadWorld>>): Deal[] {
  const deals: Deal[] = [];
  shuffle(w.people).forEach((p, i) => {
    const r = w.rankings[p.id] || [];
    if (r.length < 10) return;
    // half the deck: someone the agent really picked, half: someone near the bottom
    const yes = i % 2 === 0;
    const e = yes ? r[Math.floor(Math.random() * 3)] : r[r.length - 1 - Math.floor(Math.random() * 6)];
    const q = w.byId.get(e.personId)!;
    const mini = (x: typeof p) => ({ id: x.id, name: x.name, avatar: x.avatar, headline: x.analysis?.headline || "" });
    deals.push({ a: mini(p), b: mini(q), yes, rank: r.indexOf(e) + 1, total: r.length, fit: e.fit, reason: e.reason, dateId: e.dateIds[0] });
  });
  return deals.slice(0, 16);
}

export default async function SwipePage() {
  const deals = deal(await loadWorld());
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Heading kicker="Play matchmaker" title="Would their agent pick them?">
        Every agent has already dated everyone and ranked them. Guess the call: swipe right if you think it&apos;s a top-3 pick, left if you think
        it&apos;s near the bottom.
      </Heading>
      <SwipeDeck deals={deals} />
    </div>
  );
}
