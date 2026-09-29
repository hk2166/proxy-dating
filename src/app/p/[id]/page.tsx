import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { FitPill, PersonAvatar, SourceTag } from "@/components/bits";
import { AnalysisView, ReadingLog, SourcesView } from "@/components/Profile";
import { RankingList } from "@/components/RankingList";
import { RemoveButton } from "@/components/RemoveButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { firstName } from "@/lib/names";
import { loadWorld } from "@/lib/world";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await loadWorld();
  const person = w.byId.get(id);
  if (!person?.analysis) notFound();
  const a = person.analysis;
  const first = firstName(person.name);
  const ranking = w.rankings[id] || [];
  const pick = ranking[0] && w.byId.get(ranking[0].personId);
  const dates = w.dates.filter((d) => d.a === id || d.b === id).sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "full" ? -1 : 1));

  return (
    <div>
      <section className="relative overflow-hidden border-b">
        {person.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatar} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-25 blur-3xl" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-background" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[260px_1fr]">
          <div className="self-start overflow-hidden rounded-3xl border shadow-2xl">
            {person.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={person.avatar} alt={person.name} className="aspect-[4/5] w-full object-cover" />
            ) : (
              <div className="grid aspect-[4/5] place-items-center bg-muted font-display text-6xl">{first[0]}</div>
            )}
          </div>
          <div className="self-end">
            <div className="flex flex-wrap items-center gap-2">
              {person.origin === "live" && <Badge className="bg-mint text-black">joined live</Badge>}
              <Badge variant="outline" className="font-normal text-muted-foreground">
                read from 2 public sources
              </Badge>
            </div>
            <h1 className="mt-3 font-display text-6xl leading-none sm:text-7xl">{person.name}</h1>
            <p className="mt-3 max-w-2xl text-lg">{a.headline}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {a.vibe.map((v) => (
                <Badge key={v} className="bg-primary/15 font-normal text-primary">
                  {v}
                </Badge>
              ))}
            </div>
            <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">{a.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm" className="rounded-full">
                <a href={person.linkedinUrl} target="_blank" rel="noreferrer">
                  <SourceTag source="linkedin" /> LinkedIn
                </a>
              </Button>
              <Button asChild variant="secondary" size="sm" className="rounded-full">
                <a href={person.instagramUrl} target="_blank" rel="noreferrer">
                  <SourceTag source="instagram" /> Instagram
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <Tabs defaultValue="profile" className="min-w-0">
          <TabsList className="mb-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="reading">How the agent read {first}</TabsTrigger>
            <TabsTrigger value="dates">Dates ({dates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <AnalysisView person={person} a={a} />
          </TabsContent>

          <TabsContent value="reading" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Before dating for {first}, the agent read each source and wrote down what it saw and what it concluded. The profile was built
              only from these notes and the two sources.
            </p>
            {person.reading && <ReadingLog notes={person.reading} />}
            <SourcesView person={person} />
          </TabsContent>

          <TabsContent value="dates" className="space-y-2">
            {dates.length === 0 && (
              <Card>
                <CardContent className="text-sm text-muted-foreground">
                  No dates yet.{" "}
                  <Link className="text-primary underline" href={`/join?id=${person.id}`}>
                    Send {first}&apos;s agent out →
                  </Link>
                </CardContent>
              </Card>
            )}
            {dates.map((d) => {
              const other = w.byId.get(d.a === id ? d.b : d.a);
              const mine = d.a === id ? d.scoreA : d.scoreB;
              const theirs = d.a === id ? d.scoreB : d.scoreA;
              if (!other) return null;
              return (
                <Link key={d.id} href={`/dates/${d.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3 transition hover:border-primary/40">
                  <PersonAvatar person={other} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {other.name}
                      <Badge variant={d.kind === "full" ? "default" : "secondary"} className={d.kind === "full" ? "bg-violet/20 text-violet" : ""}>
                        {d.kind === "full" ? "full date" : "speed date"}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{d.kind === "full" ? d.venue : mine?.verdict}</div>
                  </div>
                  {mine && <FitPill fit={mine.overall} />}
                  {theirs && <FitPill fit={theirs.overall} />}
                </Link>
              );
            })}
          </TabsContent>
        </Tabs>

        <aside id="ranking" className="scroll-mt-20 space-y-3">
          {person.decision && pick && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
                  <Star className="size-3.5 fill-primary" /> The agent&apos;s final call
                </div>
                <div className="flex items-center gap-3">
                  <PersonAvatar person={pick} className="size-12" />
                  <div>
                    <div className="text-xs text-muted-foreground">picks</div>
                    <div className="font-display text-2xl leading-none">{pick.name}</div>
                  </div>
                </div>
                <p className="text-sm italic leading-relaxed">“{person.decision.note}”</p>
              </CardContent>
            </Card>
          )}
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="font-display text-3xl font-normal">Who fits {first} best</CardTitle>
              <p className="text-xs text-muted-foreground">
                The agent ranked its shortlist itself (★). Fit = 65% its view + 35% the other agent&apos;s, +5 if both want more after a full date.
              </p>
            </CardHeader>
            <CardContent>
              {ranking.length ? (
                <ScrollArea className="h-[60vh] pr-3">
                  <RankingList entries={ranking} byId={w.byId} />
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">No dates yet, so no ranking.</p>
              )}
            </CardContent>
          </Card>
          <div className="text-right">
            <RemoveButton id={person.id} name={person.name} />
          </div>
        </aside>
      </div>
    </div>
  );
}
