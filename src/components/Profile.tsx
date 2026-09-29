import type { Analysis, Evidence, Person, ReadingNote } from "@/lib/types";
import { Bar, SourceBadge, Tag } from "./ui";

function Quotes({ evidence }: { evidence: Evidence[] }) {
  if (!evidence?.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {evidence.slice(0, 2).map((e, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-muted">
          <SourceBadge source={e.source} />
          <span className="italic">“{e.quote}”</span>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-line bg-card p-5">
      <h3 className="mb-3 font-display text-2xl">{title}</h3>
      {children}
    </section>
  );
}

export function AnalysisView({ person, a }: { person: Person; a: Analysis }) {
  const first = person.name.split(" ")[0];
  return (
    <div className="space-y-4">
      <Block title={`What ${first} needs in a partner`} id="needs">
        <div className="grid gap-3 sm:grid-cols-2">
          {a.needs.map((n) => (
            <div key={n.need} className="rounded-xl bg-rose-soft/60 p-3">
              <div className="font-semibold">{n.need}</div>
              <p className="mt-1 text-sm text-ink/80">{n.why}</p>
              <Quotes evidence={n.evidence} />
            </div>
          ))}
        </div>
      </Block>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Hobbies" id="hobbies">
          <TraitList items={a.hobbies} />
        </Block>
        <Block title="Interests" id="interests">
          <TraitList items={a.interests} />
        </Block>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Values">
          <TraitList items={a.values} />
        </Block>
        <Block title="Personality">
          <div className="space-y-3">
            {a.personality.map((t) => (
              <div key={t.trait}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{t.trait}</span>
                  <span className="tabular-nums text-muted">{Math.round(t.score)}</span>
                </div>
                <Bar value={t.score} tone="plum" />
                <div className="mt-1 text-xs text-muted">{t.note}</div>
              </div>
            ))}
          </div>
        </Block>
      </div>

      <Block title="Lifestyle">
        <dl className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Base", a.lifestyle.base],
              ["Pace", a.lifestyle.pace],
              ["Social", a.lifestyle.social],
              ["Travel", a.lifestyle.travel],
              ["Health & fitness", a.lifestyle.health],
              ["Work / life", a.lifestyle.workLife],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{k}</dt>
              <dd className="text-sm">{v}</dd>
            </div>
          ))}
          <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">How they communicate</dt>
              <dd className="text-sm">{a.communicationStyle}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">How they show care</dt>
              <dd className="text-sm">{a.howTheyShowCare}</dd>
            </div>
          </div>
        </dl>
      </Block>

      <div className="grid gap-4 md:grid-cols-3">
        <Block title="Green flags">
          <List items={a.greenFlags} mark="✓" color="text-green" />
        </Block>
        <Block title="Friction points">
          <List items={a.frictionPoints} mark="~" color="text-gold" />
        </Block>
        <Block title="Dealbreakers">
          <List items={a.dealbreakers} mark="✕" color="text-rose" />
        </Block>
      </div>

      <Block title="Who fits them">
        <p className="text-sm">{a.idealPartner}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Dates they&apos;d love</div>
            <List items={a.idealDates} mark="♥" color="text-rose" />
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Ask them about</div>
            <List items={a.conversationHooks} mark="?" color="text-plum" />
          </div>
        </div>
      </Block>

      <Block title="How the agent will talk on their behalf">
        <p className="text-sm">{a.agentVoice}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <Tag tone={a.identityCheck.sameLikely ? "green" : "rose"}>
            {a.identityCheck.sameLikely ? "✓ Both links look like the same person" : "⚠ Links may be different people"}
          </Tag>
          <Tag tone="plum">Analysis confidence {Math.round(a.confidence.overall)}/100</Tag>
        </div>
        <p className="mt-2 text-xs text-muted">
          {a.identityCheck.note} {a.confidence.note}
        </p>
      </Block>
    </div>
  );
}

function TraitList({ items }: { items: Analysis["hobbies"] }) {
  return (
    <ul className="space-y-3">
      {items.map((t) => (
        <li key={t.name}>
          <div className="font-medium">{t.name}</div>
          <div className="text-sm text-ink/80">{t.detail}</div>
          <Quotes evidence={t.evidence} />
        </li>
      ))}
    </ul>
  );
}

function List({ items, mark, color }: { items: string[]; mark: string; color: string }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((x) => (
        <li key={x} className="flex gap-2">
          <span className={`font-bold ${color}`}>{mark}</span>
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

const CAT_TONE: Record<ReadingNote["category"], "rose" | "plum" | "green" | "neutral"> = {
  hobby: "rose",
  interest: "plum",
  value: "green",
  need: "rose",
  lifestyle: "neutral",
  personality: "plum",
  career: "neutral",
  relationship: "rose",
};

export function ReadingLog({ notes, animate = false }: { notes: ReadingNote[]; animate?: boolean }) {
  const groups: ["linkedin" | "instagram", string][] = [
    ["linkedin", "Reading LinkedIn"],
    ["instagram", "Reading Instagram"],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map(([src, label]) => {
        const ns = notes.filter((n) => n.source === src);
        return (
          <div key={src} className="rounded-2xl border border-line bg-card p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <SourceBadge source={src} /> {label}
              <span className="ml-auto text-xs font-normal text-muted">{ns.length} notes</span>
            </div>
            <ol className="space-y-2.5">
              {ns.map((n, i) => (
                <li key={i} className={`rounded-xl border border-line/70 bg-paper p-3 ${animate ? "animate-pop" : ""}`} style={animate ? { animationDelay: `${i * 90}ms` } : undefined}>
                  <div className="text-xs italic text-muted">“{n.signal}”</div>
                  <div className="mt-1 flex items-start gap-2 text-sm">
                    <span className="text-rose">→</span>
                    <span className="flex-1">{n.inference}</span>
                    <Tag tone={CAT_TONE[n.category]}>{n.category}</Tag>
                  </div>
                </li>
              ))}
            </ol>
          </div>
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
      <div className="rounded-2xl border border-line bg-card p-4 text-sm">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <SourceBadge source="linkedin" /> What the scraper got from LinkedIn
        </div>
        <div className="font-medium">{s.linkedin.headline}</div>
        {s.linkedin.location && <div className="text-xs text-muted">{s.linkedin.location}</div>}
        {s.linkedin.about && <p className="mt-2 line-clamp-6 whitespace-pre-line text-muted">{s.linkedin.about}</p>}
        <ul className="mt-3 space-y-1">
          {s.linkedin.experience.slice(0, 6).map((e, i) => (
            <li key={i} className="text-xs">
              <span className="font-medium">{e.title}</span> · {e.company} <span className="text-muted">{e.dates}</span>
            </li>
          ))}
        </ul>
        {s.linkedin.posts.length > 0 && <div className="mt-2 text-xs text-muted">+ {s.linkedin.posts.length} recent posts</div>}
      </div>
      <div className="rounded-2xl border border-line bg-card p-4 text-sm">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <SourceBadge source="instagram" /> What the scraper got from Instagram
        </div>
        <div className="font-medium">
          @{s.instagram.username} · {s.instagram.followers?.toLocaleString() ?? "?"} followers
        </div>
        {s.instagram.biography && <p className="mt-1 whitespace-pre-line text-muted">{s.instagram.biography}</p>}
        <ul className="mt-3 space-y-1.5">
          {s.instagram.posts.slice(0, 6).map((p, i) => (
            <li key={i} className="line-clamp-2 text-xs">
              {p.location && <span className="font-medium">📍 {p.location} · </span>}
              {p.caption || p.alt || "(no caption)"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
