import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Person } from "@/lib/types";

type Who = Pick<Person, "name" | "avatar">;

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

export function PersonAvatar({ person, className, ring }: { person: Who; className?: string; ring?: boolean }) {
  return (
    <span className={cn("relative inline-flex size-10 shrink-0 overflow-hidden rounded-full bg-accent", ring && "ring-2 ring-background", className)}>
      {person.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatar} alt={person.name} className="size-full object-cover" />
      ) : (
        <span className="m-auto text-xs">{initials(person.name)}</span>
      )}
    </span>
  );
}

export function FitPill({ fit, className }: { fit: number; className?: string }) {
  const tone =
    fit >= 82 ? "bg-sunset text-white" : fit >= 72 ? "bg-primary/20 text-primary" : fit >= 60 ? "bg-violet/20 text-violet" : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex min-w-10 justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", tone, className)}>{fit}</span>;
}

export function SourceTag({ source }: { source: "linkedin" | "instagram" }) {
  return source === "linkedin" ? (
    <span className="inline-flex h-4 items-center rounded bg-[#0a66c2] px-1 text-[9px] font-bold text-white">in</span>
  ) : (
    <span className="inline-flex h-4 items-center rounded bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] px-1 text-[9px] font-bold text-white">
      IG
    </span>
  );
}

export function PersonChip({ person, sub }: { person: Pick<Person, "id" | "name" | "avatar">; sub?: string }) {
  return (
    <Link href={`/p/${person.id}`} className="flex min-w-0 items-center gap-2 hover:text-primary">
      <PersonAvatar person={person} className="size-7" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{person.name}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </Link>
  );
}

export function Heading({ kicker, title, children }: { kicker?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {kicker && <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-primary">{kicker}</div>}
      <h2 className="font-display text-4xl leading-tight sm:text-5xl">{title}</h2>
      {children && <p className="mt-3 max-w-2xl text-muted-foreground">{children}</p>}
    </div>
  );
}
