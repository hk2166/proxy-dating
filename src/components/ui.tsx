import Link from "next/link";
import type { Person } from "@/lib/types";

export function Avatar({ person, size = 48, className = "" }: { person: Pick<Person, "name" | "avatar">; size?: number; className?: string }) {
  const initials = person.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  if (person.avatar)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatar}
        alt={person.name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white ${className}`}
        style={{ width: size, height: size }}
      />
    );
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-plum-soft font-semibold text-plum ring-2 ring-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "rose" | "plum" | "green" }) {
  const tones = {
    neutral: "bg-white border-line text-ink",
    rose: "bg-rose-soft border-rose/20 text-rose",
    plum: "bg-plum-soft border-plum/15 text-plum",
    green: "bg-green/10 border-green/20 text-green",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function SourceBadge({ source }: { source: "linkedin" | "instagram" }) {
  return source === "linkedin" ? (
    <span className="inline-flex items-center rounded bg-[#0a66c2] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">in</span>
  ) : (
    <span className="inline-flex items-center rounded bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
      IG
    </span>
  );
}

export function Bar({ value, max = 100, tone = "rose" }: { value: number; max?: number; tone?: "rose" | "plum" | "gold" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = tone === "rose" ? "bg-rose" : tone === "plum" ? "bg-plum" : "bg-gold";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function FitBadge({ fit }: { fit: number }) {
  const tone = fit >= 80 ? "bg-rose text-white" : fit >= 65 ? "bg-rose-soft text-rose" : fit >= 50 ? "bg-plum-soft text-plum" : "bg-line text-muted";
  return <span className={`inline-flex min-w-11 justify-center rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${tone}`}>{fit}</span>;
}

export function PersonChip({ person, sub }: { person: Pick<Person, "id" | "name" | "avatar">; sub?: string }) {
  return (
    <Link href={`/p/${person.id}`} className="flex min-w-0 items-center gap-2 hover:text-rose">
      <Avatar person={person} size={28} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{person.name}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </Link>
  );
}

export function SectionTitle({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5">
      {kicker && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose">{kicker}</div>}
      <h2 className="font-display text-3xl sm:text-4xl">{title}</h2>
      {children && <p className="mt-2 max-w-2xl text-muted">{children}</p>}
    </div>
  );
}
