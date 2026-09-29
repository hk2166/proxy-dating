"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DateMessage, DateRecord, Scorecard } from "@/lib/types";

export type Mini = { id: string; name: string; avatar?: string };

export function MiniAvatar({ p, size = 32 }: { p: Mini; size?: number }) {
  if (p.avatar)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.avatar} alt={p.name} className="shrink-0 rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />;
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-plum-soft text-xs font-semibold text-plum" style={{ width: size, height: size }}>
      {p.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")}
    </div>
  );
}

export function Bubble({ m, a, b, compact = false }: { m: DateMessage; a: Mini; b: Mini; compact?: boolean }) {
  if (m.speaker === "host")
    return (
      <div className="animate-pop my-3 flex justify-center">
        <div className={`max-w-[92%] rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-center italic text-ink/85 ${compact ? "text-xs" : "text-sm"}`}>
          <span className="mr-1 text-[10px] font-bold not-italic uppercase tracking-widest text-gold">Host</span>
          {m.text}
        </div>
      </div>
    );
  const isA = m.speaker === "a";
  const p = isA ? a : b;
  return (
    <div className={`animate-pop flex items-end gap-2 ${isA ? "" : "flex-row-reverse"}`}>
      {!compact && <MiniAvatar p={p} size={30} />}
      <div className={`max-w-[80%] ${isA ? "" : "text-right"}`}>
        {!compact && <div className="mb-0.5 px-1 text-[11px] text-muted">{p.name.split(" ")[0]}&apos;s agent</div>}
        <div
          className={`inline-block rounded-2xl px-3.5 py-2 text-left ${compact ? "text-xs" : "text-[15px]"} ${
            isA ? "rounded-bl-sm bg-rose-soft" : "rounded-br-sm bg-plum-soft"
          }`}
        >
          {m.text}
        </div>
      </div>
    </div>
  );
}

export function Typing({ who, side }: { who: Mini; side: "a" | "b" }) {
  return (
    <div className={`flex items-end gap-2 ${side === "a" ? "" : "flex-row-reverse"}`}>
      <MiniAvatar p={who} size={30} />
      <div className={`typing rounded-2xl px-3 py-2 text-lg leading-none ${side === "a" ? "bg-rose-soft" : "bg-plum-soft"}`}>
        <span>•</span>
        <span>•</span>
        <span>•</span>
      </div>
    </div>
  );
}

export function ScoreCard({ s, me, other, big = false }: { s: Scorecard; me: Mini; other: Mini; big?: boolean }) {
  const dims: [string, number][] = [
    ["Chemistry", s.chemistry],
    ["Values", s.valuesFit],
    ["Lifestyle", s.lifestyleFit],
    ["Shared interests", s.interestOverlap],
    ["Meets needs", s.needsMet],
  ];
  return (
    <div className="animate-pop rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <MiniAvatar p={me} size={28} />
        <div className="text-sm">
          <div className="font-semibold">{me.name.split(" ")[0]}&apos;s agent reports back</div>
          <div className="text-xs text-muted">private scorecard on {other.name}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-display text-3xl leading-none">{s.overall}</div>
          <div className={`text-[11px] font-semibold ${s.secondDate ? "text-rose" : "text-muted"}`}>{s.secondDate ? "♥ wants 2nd date" : "no 2nd date"}</div>
        </div>
      </div>
      {s.reportToPrincipal && big && <p className="mt-3 rounded-xl bg-paper p-3 text-sm italic">“{s.reportToPrincipal}”</p>}
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {dims.map(([k, v]) => (
          <div key={k} className="text-center">
            <div className="h-12 overflow-hidden rounded bg-line/60">
              <div className="w-full rounded bg-rose/80" style={{ height: `${v * 10}%`, marginTop: `${100 - v * 10}%` }} />
            </div>
            <div className="mt-1 text-[10px] leading-tight text-muted">{k}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1 text-xs">
        <div>
          <span className="font-semibold text-green">Best moment:</span> {s.highlight}
        </div>
        <div>
          <span className="font-semibold text-gold">Concern:</span> {s.concern}
        </div>
        <div className="font-medium">“{s.verdict}”</div>
      </div>
    </div>
  );
}

export function DateReplay({ date, a, b, autoplay = true }: { date: DateRecord; a: Mini; b: Mini; autoplay?: boolean }) {
  const total = date.messages.length;
  const [shown, setShown] = useState(autoplay ? 0 : total);
  const [speed, setSpeed] = useState(1);
  const bottom = useRef<HTMLDivElement>(null);
  const playing = shown < total;

  useEffect(() => {
    if (!playing) return;
    const next = date.messages[shown];
    const delay = (next.speaker === "host" ? 1400 : Math.min(2600, 700 + next.text.length * 18)) / speed;
    const t = setTimeout(() => setShown((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [shown, playing, speed, date.messages]);

  useEffect(() => {
    if (autoplay && shown > 0) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [shown, autoplay]);

  const next = date.messages[shown];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => setShown(0)} className="rounded-lg border border-line bg-card px-3 py-1 hover:border-ink">
          ↺ Replay
        </button>
        <button onClick={() => setShown(total)} className="rounded-lg border border-line bg-card px-3 py-1 hover:border-ink">
          Skip to end
        </button>
        <button onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))} className="rounded-lg border border-line bg-card px-3 py-1 hover:border-ink">
          {speed}× speed
        </button>
        <span className="ml-auto text-xs text-muted">
          {Math.min(shown, total)}/{total} lines
        </span>
      </div>
      <div className="space-y-3 rounded-3xl border border-line bg-card p-4 sm:p-6">
        {date.messages.slice(0, shown).map((m, i) => (
          <Bubble key={i} m={m} a={a} b={b} />
        ))}
        {playing && next && next.speaker !== "host" && <Typing who={next.speaker === "a" ? a : b} side={next.speaker} />}
        <div ref={bottom} />
      </div>
      {!playing && date.scoreA && date.scoreB && (
        <div className="mt-6">
          <h2 className="mb-3 font-display text-3xl">After the date: each agent reports privately to its person</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <ScoreCard s={date.scoreA} me={a} other={b} big />
            <ScoreCard s={date.scoreB} me={b} other={a} big />
          </div>
          <div className="mt-4 flex gap-3 text-sm">
            <Link href={`/p/${a.id}#ranking`} className="text-rose hover:underline">
              {a.name.split(" ")[0]}&apos;s ranking →
            </Link>
            <Link href={`/p/${b.id}#ranking`} className="text-rose hover:underline">
              {b.name.split(" ")[0]}&apos;s ranking →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
