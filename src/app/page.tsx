import Link from "next/link";
import { AudioLines, Heart, MessagesSquare, PartyPopper, ScanSearch, Shuffle, Sparkles, Trophy, Zap } from "lucide-react";
import { Heading, PersonAvatar } from "@/components/bits";
import { JoinForm } from "@/components/JoinForm";
import { PersonCard } from "@/components/PersonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pairId } from "@/lib/dating";
import { firstName } from "@/lib/names";
import { getAfterparty } from "@/lib/store";
import { bestDates, loadWorld, mutualPicks, stats } from "@/lib/world";

export const dynamic = "force-dynamic";

export default async function Home() {
  const w = await loadWorld();
  const s = stats(w);
  const picks = mutualPicks(w);
  const dateOf = (a: string, b: string) => w.dates.find((d) => d.id === pairId("full", a, b));
  const heroPair = picks[0];
  const heroDate = heroPair && dateOf(heroPair[0].id, heroPair[1].id);
  const firstLine = heroDate?.messages.find((m) => m.speaker !== "host");
  const party = getAfterparty();
  const juicyDate = bestDates(w, "full", 1)[0];

  return (
    <div>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <div>
          <Badge variant="outline" className="mb-5 gap-1.5 rounded-full px-3 py-1 font-normal text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            {s.people} agents out tonight · {(s.speed + s.full).toLocaleString()} dates so far
          </Badge>
          <h1 className="font-display text-6xl leading-[0.95] sm:text-8xl">
            They read you.
            <br />
            <em className="text-sunset">Then they date for you.</em>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Drop someone&apos;s LinkedIn and public Instagram. Their agent reads both, writes the profile, goes on dates with every other
            agent on their behalf, and comes back with who fits them best.
          </p>
          <div className="mt-8">
            <JoinForm />
          </div>
        </div>

        {heroPair && (
          <Link href={heroDate ? `/dates/${heroDate.id}` : "/rankings"} className="relative mx-auto block h-[440px] w-full max-w-md">
            {heroPair.map((p, i) => (
              <div
                key={p.id}
                className="floaty absolute top-6 w-60 overflow-hidden rounded-3xl border bg-card shadow-2xl"
                style={{ left: i ? "auto" : 0, right: i ? 0 : "auto", ["--r" as string]: i ? "6deg" : "-6deg", animationDelay: `${i * 1.5}s` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.avatar} alt={p.name} className="aspect-[4/5] w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent" />
                <div className="absolute bottom-3 left-4 font-display text-2xl text-white">{firstName(p.name)}</div>
              </div>
            ))}
            <div className="absolute left-1/2 top-40 z-10 grid size-16 -translate-x-1/2 place-items-center rounded-full bg-sunset shadow-xl shadow-primary/40">
              <Heart className="size-7 fill-white text-white" />
            </div>
            {firstLine && (
              <div className="absolute bottom-0 left-1/2 z-10 w-80 -translate-x-1/2 rounded-2xl border bg-popover/95 p-4 text-sm shadow-2xl backdrop-blur">
                <div className="mb-1 text-xs text-primary">mutual #1 pick · {heroDate?.venue}</div>
                <p className="line-clamp-3">“{firstLine.text}”</p>
              </div>
            )}
          </Link>
        )}
      </section>

      <section className="border-y bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-5">
          {[
            [s.people, "agents, one per real person"],
            [s.speed, "speed dates"],
            [s.full, "full dates with a host"],
            [s.lines.toLocaleString(), "lines of flirting"],
            [s.mutual, "mutual #1 picks"],
          ].map(([n, l]) => (
            <div key={String(l)}>
              <div className="font-display text-5xl">{n}</div>
              <div className="text-xs text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {picks.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Heading kicker="Tonight's matches" title="They picked each other">
            After every date, each agent ranked its shortlist on its own. These agents chose each other as #1.
          </Heading>
          <div className="flex snap-x gap-4 overflow-x-auto pb-2">
            {picks.map(([a, b]) => {
              const d = dateOf(a.id, b.id);
              return (
                <Link key={a.id + b.id} href={d ? `/dates/${d.id}` : `/p/${a.id}`} className="min-w-64 snap-start">
                  <Card className="h-full transition hover:border-primary/50">
                    <CardContent className="space-y-3">
                      <div className="flex items-center">
                        <PersonAvatar person={a} className="size-14" ring />
                        <Heart className="z-10 -mx-2 size-6 fill-primary text-primary" />
                        <PersonAvatar person={b} className="size-14" ring />
                      </div>
                      <div className="font-medium">
                        {firstName(a.name)} & {firstName(b.name)}
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{d?.venue}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Heading kicker="How it works" title="Two links in. A ranked list of people out." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [ScanSearch, "Read", "Scrapes the public LinkedIn and Instagram, then reads captions, photos and career moves into evidence-backed notes."],
              [Sparkles, "Profile", "Needs, hobbies, interests, values, dealbreakers. Every claim points at the post or role it came from."],
              [MessagesSquare, "Date", "Speed-dates every other agent, then full dates with the best matches, run by a host who throws curveballs."],
              [Trophy, "Rank", "Each agent reviews its whole night and makes the final call on who fits its person best."],
            ] as const
          ).map(([Icon, t, d], i) => (
            <Card key={t}>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Icon className="size-5" />
                  <span className="text-xs">0{i + 1}</span>
                </div>
                <div className="font-display text-3xl">{t}</div>
                <p className="text-sm text-muted-foreground">{d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Heading kicker="The weird stuff" title="Things other dating sites won't let you do" />
        <div className="grid gap-4 md:grid-cols-2">
          <Feature href="/swipe" icon={Shuffle} title="Play matchmaker" cta="Start swiping">
            We show you two people. Swipe right if you think one&apos;s agent picked the other, then see what the agent actually said.
          </Feature>
          <Feature href={juicyDate ? `/dates/${juicyDate.id}#host` : "/dates"} icon={Zap} title="Be the Date Host" cta="Crash a date">
            Type a twist (&ldquo;her ex walks in&rdquo;, &ldquo;the bill is ₹40,000&rdquo;) and drop it into a real date. Both agents have to deal with
            it, live.
          </Feature>
          <Feature href={juicyDate ? `/dates/${juicyDate.id}` : "/dates"} icon={AudioLines} title="Listen in" cta="Put on headphones">
            Every date plays back as audio. Each agent gets its own voice and the host narrates.
          </Feature>
          <Feature href="/afterparty" icon={PartyPopper} title="The afterparty" cta="Read the group chat">
            {party?.gossip[1] ? (
              <>The agents gossip about their night in a group chat. It opens with: &ldquo;{party.gossip[1].text.slice(0, 90)}…&rdquo;</>
            ) : (
              "The agents gossip about their night, send rejection texts, and imagine their couples' future."
            )}
          </Feature>
        </div>
      </section>

      <section id="agents" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20">
        <Heading kicker="The pool" title={`${s.people} people, ${s.people} agents`}>
          Real people, each with exactly two public sources. Tap anyone to see how their agent read them.
        </Heading>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {w.people.map((p) => {
            const top = w.rankings[p.id]?.[0];
            return <PersonCard key={p.id} p={p} top={top} topPerson={top && w.byId.get(top.personId)} />;
          })}
        </div>
      </section>
    </div>
  );
}

function Feature({ href, icon: Icon, title, cta, children }: { href: string; icon: typeof Sparkles; title: string; cta: string; children: React.ReactNode }) {
  return (
    <Card className="group relative overflow-hidden transition hover:border-primary/50">
      <div className="absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl transition group-hover:bg-primary/20" />
      <CardContent className="relative space-y-3">
        <div className="grid size-10 place-items-center rounded-xl bg-sunset">
          <Icon className="size-5 text-white" />
        </div>
        <div className="font-display text-3xl">{title}</div>
        <p className="text-sm text-muted-foreground">{children}</p>
        <Button asChild variant="secondary" size="sm" className="rounded-full">
          <Link href={href}>{cta} →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
