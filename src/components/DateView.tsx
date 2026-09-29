"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FastForward, Headphones, Pause, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { firstName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { DateMessage, DateRecord, Scorecard } from "@/lib/types";

export type Mini = { id: string; name: string; avatar?: string; voice?: string };

export function MiniAvatar({ p, className }: { p: Mini; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-8 shrink-0 overflow-hidden rounded-full bg-accent", className)}>
      {p.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatar} alt={p.name} className="size-full object-cover" />
      ) : (
        <span className="m-auto text-[10px]">{p.name.slice(0, 2)}</span>
      )}
    </span>
  );
}

export function Bubble({ m, a, b, compact, speaking }: { m: DateMessage; a: Mini; b: Mini; compact?: boolean; speaking?: boolean }) {
  if (m.speaker === "host")
    return (
      <div className="animate-pop my-4 flex justify-center">
        <div className={cn("max-w-[92%] rounded-2xl border border-gold/25 bg-gold/10 px-4 py-2.5 text-center italic text-foreground/90", compact ? "text-xs" : "text-sm", speaking && "ring-2 ring-gold/60")}>
          <span className="mr-1.5 text-[10px] font-semibold not-italic uppercase tracking-widest text-gold">host</span>
          {m.text}
        </div>
      </div>
    );
  const isA = m.speaker === "a";
  const p = isA ? a : b;
  return (
    <div className={cn("animate-pop flex items-end gap-2", !isA && "flex-row-reverse")}>
      {!compact && <MiniAvatar p={p} />}
      <div className={cn("max-w-[80%]", !isA && "text-right")}>
        {!compact && <div className="mb-1 px-1 text-[11px] text-muted-foreground">{firstName(p.name)}&apos;s agent</div>}
        <div
          className={cn(
            "inline-block rounded-2xl px-3.5 py-2 text-left transition",
            compact ? "text-xs" : "text-[15px] leading-relaxed",
            isA ? "rounded-bl-md border border-primary/20 bg-primary/15" : "rounded-br-md border border-violet/25 bg-violet/15",
            speaking && "ring-2 ring-primary/70",
          )}
        >
          {m.text}
        </div>
      </div>
    </div>
  );
}

export function Typing({ who, side }: { who: Mini; side: "a" | "b" }) {
  return (
    <div className={cn("flex items-end gap-2", side === "b" && "flex-row-reverse")}>
      <MiniAvatar p={who} />
      <div className={cn("typing rounded-2xl px-3 py-2 text-lg leading-none", side === "a" ? "bg-primary/15" : "bg-violet/15")}>
        <span>•</span>
        <span>•</span>
        <span>•</span>
      </div>
    </div>
  );
}

export function ScoreCard({ s, me, other }: { s: Scorecard; me: Mini; other: Mini }) {
  const dims: [string, number][] = [
    ["Chemistry", s.chemistry],
    ["Values", s.valuesFit],
    ["Lifestyle", s.lifestyleFit],
    ["Shared interests", s.interestOverlap],
    ["Meets needs", s.needsMet],
  ];
  return (
    <Card className="animate-pop">
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <MiniAvatar p={me} className="size-9" />
          <div className="text-sm">
            <div className="font-medium">{firstName(me.name)}&apos;s agent, privately</div>
            <div className="text-xs text-muted-foreground">on {other.name}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="font-display text-4xl leading-none">{s.overall}</div>
            <div className={cn("text-[11px]", s.secondDate ? "text-primary" : "text-muted-foreground")}>{s.secondDate ? "♥ wants a 2nd date" : "no 2nd date"}</div>
          </div>
        </div>
        {s.reportToPrincipal && <p className="rounded-xl bg-muted/60 p-3 text-sm italic leading-relaxed">“{s.reportToPrincipal}”</p>}
        <div className="space-y-2">
          {dims.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr_20px] items-center gap-2 text-xs">
              <span className="text-muted-foreground">{k}</span>
              <Progress value={v * 10} className="h-1.5" />
              <span className="text-right tabular-nums">{v}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1.5 text-xs">
          <p>
            <span className="text-mint">Best moment</span> · {s.highlight}
          </p>
          <p>
            <span className="text-gold">Concern</span> · {s.concern}
          </p>
          <p className="font-medium">“{s.verdict}”</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- audio: one voice per agent, a narrator for the host ----

async function speak(m: DateMessage, a: Mini, b: Mini, signal: AbortSignal) {
  const voice = m.speaker === "host" ? "fable" : (m.speaker === "a" ? a : b).voice || (m.speaker === "a" ? "alloy" : "verse");
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: m.text, voice, role: m.speaker === "host" ? "host" : "agent" }),
    signal,
  });
  if (!res.ok) throw new Error((await res.text()) || "audio failed");
  return URL.createObjectURL(await res.blob());
}

export function DateReplay({ date, a, b }: { date: DateRecord; a: Mini; b: Mini }) {
  const total = date.messages.length;
  const [shown, setShown] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [listening, setListening] = useState(false);
  const [talking, setTalking] = useState(-1);
  const bottom = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const clips = useRef(new Map<number, Promise<string>>());
  const abort = useRef<AbortController | null>(null);
  const done = shown >= total;

  // text-only playback
  useEffect(() => {
    if (listening || done) return;
    const next = date.messages[shown];
    const wait = (next.speaker === "host" ? 1400 : Math.min(2600, 700 + next.text.length * 18)) / speed;
    const t = setTimeout(() => setShown((n) => n + 1), wait);
    return () => clearTimeout(t);
  }, [shown, done, speed, listening, date.messages]);

  // audio playback: fetch line i (and prefetch i+1), play, advance on end
  useEffect(() => {
    if (!listening || shown >= total) return;
    const ctrl = abort.current!;
    const clip = (i: number) => {
      if (!clips.current.has(i) && i < total) clips.current.set(i, speak(date.messages[i], a, b, ctrl.signal));
      return clips.current.get(i)!;
    };
    let alive = true;
    clip(shown)
      .then((url) => {
        if (!alive) return;
        clip(shown + 1)?.catch(() => {});
        const el = new Audio(url);
        el.playbackRate = speed;
        audio.current = el;
        setTalking(shown);
        el.onended = () => {
          if (!alive) return;
          setShown((n) => n + 1);
          if (shown + 1 >= total) {
            setListening(false);
            setTalking(-1);
          }
        };
        return el.play();
      })
      .catch((e) => {
        if (!alive || ctrl.signal.aborted) return;
        toast.error(`Audio stopped: ${String(e.message || e).slice(0, 80)}`);
        setListening(false);
      });
    return () => {
      alive = false;
      audio.current?.pause();
    };
  }, [listening, shown, total, speed, a, b, date.messages]);

  useEffect(() => {
    if (shown > 0) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [shown]);

  function listen() {
    if (listening) {
      abort.current?.abort();
      audio.current?.pause();
      setListening(false);
      setTalking(-1);
      return;
    }
    abort.current = new AbortController();
    clips.current = new Map();
    if (done) setShown(0);
    setListening(true);
  }

  const next = date.messages[shown];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={listen} className={cn("rounded-full", listening ? "bg-secondary text-foreground" : "bg-sunset text-white")}>
          {listening ? <Pause /> : <Headphones />} {listening ? "Stop listening" : "Listen to the date"}
        </Button>
        <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setShown(0)}>
          <RotateCcw /> Replay
        </Button>
        <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setShown(total)} disabled={listening}>
          Skip to end
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))}>
          <FastForward /> {speed}×
        </Button>
        <Badge variant="outline" className="ml-auto font-normal text-muted-foreground">
          {Math.min(shown, total)}/{total}
        </Badge>
      </div>

      <Card>
        <CardContent className="space-y-3 sm:p-6">
          {date.messages.slice(0, shown).map((m, i) => (
            <Bubble key={i} m={m} a={a} b={b} speaking={i === talking} />
          ))}
          {!done && next && next.speaker !== "host" && <Typing who={next.speaker === "a" ? a : b} side={next.speaker} />}
          <div ref={bottom} />
        </CardContent>
      </Card>

      {done && date.scoreA && date.scoreB && (
        <div className="mt-8">
          <h2 className="mb-4 flex items-center gap-2 font-display text-3xl">
            <Sparkles className="size-5 text-primary" /> After the date, each agent reports back
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <ScoreCard s={date.scoreA} me={a} other={b} />
            <ScoreCard s={date.scoreB} me={b} other={a} />
          </div>
          <div className="mt-4 flex gap-4 text-sm">
            <Link href={`/p/${a.id}#ranking`} className="text-primary hover:underline">
              {firstName(a.name)}&apos;s ranking →
            </Link>
            <Link href={`/p/${b.id}#ranking`} className="text-primary hover:underline">
              {firstName(b.name)}&apos;s ranking →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
