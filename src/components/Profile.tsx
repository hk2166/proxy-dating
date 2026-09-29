import { Check, CircleAlert, HeartHandshake, MessageCircleQuestion, X } from "lucide-react";
import { SourceTag } from "@/components/bits";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { firstName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { Analysis, Evidence, Person, ReadingNote } from "@/lib/types";

function Quotes({ evidence }: { evidence: Evidence[] }) {
  if (!evidence?.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {evidence.slice(0, 2).map((e, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <SourceTag source={e.source} />
          <span className="italic">“{e.quote}”</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-display text-3xl font-normal">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Traits({ items }: { items: Analysis["hobbies"] }) {
  return (
    <ul className="space-y-4">
      {items.map((t) => (
        <li key={t.name}>
          <div className="font-medium">{t.name}</div>
          <div className="text-sm text-muted-foreground">{t.detail}</div>
          <Quotes evidence={t.evidence} />
        </li>
      ))}
    </ul>
  );
}

function List({ items, icon: Icon, tone }: { items: string[]; icon: typeof Check; tone: string }) {
  return (
    <ul className="space-y-2.5 text-sm">
      {items.map((x) => (
        <li key={x} className="flex gap-2">
          <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

export function AnalysisView({ person, a }: { person: Person; a: Analysis }) {
  const first = firstName(person.name);
  return (
    <div className="space-y-4">
      <Section title={`What ${first} needs`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {a.needs.map((n) => (
            <div key={n.need} className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="font-medium">{n.need}</div>
              <p className="mt-1 text-sm text-muted-foreground">{n.why}</p>
              <Quotes evidence={n.evidence} />
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Hobbies">
          <Traits items={a.hobbies} />
        </Section>
        <Section title="Interests">
          <Traits items={a.interests} />
        </Section>
        <Section title="Values">
          <Traits items={a.values} />
        </Section>
        <Section title="Personality">
          <div className="space-y-4">
            {a.personality.map((t) => (
              <div key={t.trait}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium">{t.trait}</span>
                  <span className="tabular-nums text-muted-foreground">{Math.round(t.score)}</span>
                </div>
                <Progress value={t.score} className="h-1.5" />
                <div className="mt-1 text-xs text-muted-foreground">{t.note}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="How they live">
        <dl className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["Base", a.lifestyle.base],
              ["Pace", a.lifestyle.pace],
              ["Social", a.lifestyle.social],
              ["Travel", a.lifestyle.travel],
              ["Health", a.lifestyle.health],
              ["Work / life", a.lifestyle.workLife],
              ["Talks like", a.communicationStyle],
              ["Shows care by", a.howTheyShowCare],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className={k.startsWith("Talks") || k.startsWith("Shows") ? "sm:col-span-3 lg:col-span-1" : ""}>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <div className="grid gap-4 md:grid-cols-3">
        <Section title="Green flags">
          <List items={a.greenFlags} icon={Check} tone="text-mint" />
        </Section>
        <Section title="Friction">
          <List items={a.frictionPoints} icon={CircleAlert} tone="text-gold" />
        </Section>
        <Section title="Dealbreakers">
          <List items={a.dealbreakers} icon={X} tone="text-destructive" />
        </Section>
      </div>

      <Section title="Who fits them">
        <p className="text-sm">{a.idealPartner}</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Dates they&apos;d love</div>
            <List items={a.idealDates} icon={HeartHandshake} tone="text-primary" />
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Ask them about</div>
            <List items={a.conversationHooks} icon={MessageCircleQuestion} tone="text-violet" />
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-muted/50 p-4 text-sm">
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">How the agent talks on their behalf</div>
          {a.agentVoice}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={a.identityCheck.sameLikely ? "secondary" : "destructive"}>
            {a.identityCheck.sameLikely ? "✓ both links look like the same person" : "⚠ links may be different people"}
          </Badge>
          <Badge variant="outline">confidence {Math.round(a.confidence.overall)}/100</Badge>
        </div>
      </Section>
    </div>
  );
}

const TONE: Record<ReadingNote["category"], string> = {
  hobby: "bg-primary/15 text-primary",
  interest: "bg-violet/15 text-violet",
  value: "bg-mint/15 text-mint",
  need: "bg-primary/15 text-primary",
  lifestyle: "bg-muted text-muted-foreground",
  personality: "bg-violet/15 text-violet",
  career: "bg-muted text-muted-foreground",
  relationship: "bg-gold/15 text-gold",
};

export function ReadingLog({ notes, animate }: { notes: ReadingNote[]; animate?: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(["linkedin", "instagram"] as const).map((src) => {
        const ns = notes.filter((n) => n.source === src);
        return (
          <Card key={src}>
            <CardHeader className="flex flex-row items-center gap-2">
              <SourceTag source={src} />
              <CardTitle className="text-base">Reading {src === "linkedin" ? "LinkedIn" : "Instagram"}</CardTitle>
              <span className="ml-auto text-xs text-muted-foreground">{ns.length} notes</span>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2.5">
                {ns.map((n, i) => (
                  <li
                    key={i}
                    className={cn("rounded-xl border bg-muted/30 p-3", animate && "animate-pop")}
                    style={animate ? { animationDelay: `${i * 90}ms` } : undefined}
                  >
                    <div className="text-xs italic text-muted-foreground">“{n.signal}”</div>
                    <div className="mt-1.5 flex items-start gap-2 text-sm">
                      <span className="text-primary">→</span>
                      <span className="flex-1">{n.inference}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", TONE[n.category])}>{n.category}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function SourcesView({ person }: { person: Person }) {
  const s = person.sources;
  if (!s) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <SourceTag source="linkedin" /> What the scraper got
          </div>
          <div>{s.linkedin.headline}</div>
          {s.linkedin.location && <div className="text-xs text-muted-foreground">{s.linkedin.location}</div>}
          {s.linkedin.about && <p className="line-clamp-5 whitespace-pre-line text-muted-foreground">{s.linkedin.about}</p>}
          <ul className="space-y-1 pt-1">
            {s.linkedin.experience.slice(0, 6).map((e, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium">{e.title}</span> · {e.company} <span className="text-muted-foreground">{e.dates}</span>
              </li>
            ))}
          </ul>
          {s.linkedin.posts.length > 0 && <div className="text-xs text-muted-foreground">+ {s.linkedin.posts.length} recent posts</div>}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <SourceTag source="instagram" /> @{s.instagram.username} · {s.instagram.followers?.toLocaleString() ?? "?"} followers
          </div>
          {s.instagram.biography && <p className="whitespace-pre-line text-muted-foreground">{s.instagram.biography}</p>}
          <ul className="space-y-1.5 pt-1">
            {s.instagram.posts.slice(0, 6).map((p, i) => (
              <li key={i} className="line-clamp-2 text-xs">
                {p.location && <span className="font-medium">📍 {p.location} · </span>}
                {p.caption || p.alt || "(no caption)"}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
