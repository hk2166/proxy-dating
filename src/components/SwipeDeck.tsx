"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { Heart, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { firstName } from "@/lib/names";
import { cn } from "@/lib/utils";

type P = { id: string; name: string; avatar?: string; headline: string };
export type Deal = { a: P; b: P; yes: boolean; rank: number; total: number; fit: number; reason: string; dateId: string };

const title = (score: number, n: number) => {
  if (n < 4) return "warming up";
  const r = score / n;
  if (r >= 0.85) return "certified cupid 💘";
  if (r >= 0.65) return "solid wingperson";
  if (r >= 0.45) return "coin-flip romantic";
  return "chaos matchmaker 🔥";
};

export function SwipeDeck({ deals }: { deals: Deal[] }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [score, setScore] = useState(0);
  const [last, setLast] = useState<{ d: Deal; guess: boolean } | null>(null);
  const over = i >= deals.length;

  const decide = useCallback(
    (guess: boolean) => {
      const d = deals[i];
      if (!d) return;
      setDir(guess ? 1 : -1);
      setLast({ d, guess });
      if (guess === d.yes) setScore((s) => s + 1);
      setI((n) => n + 1);
    },
    [deals, i],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decide(true);
      if (e.key === "ArrowLeft") decide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  const right = last && last.guess === last.d.yes;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[380px_1fr]">
      <div>
        <div className="relative mx-auto h-[480px] w-full max-w-[380px]">
          <AnimatePresence custom={dir}>
            {deals[i + 1] && <Behind key={`b${i + 1}`} d={deals[i + 1]} />}
            {deals[i] && <TopCard key={i} d={deals[i]} onSwipe={decide} />}
          </AnimatePresence>
          {over && (
            <Card className="absolute inset-0 grid place-items-center text-center">
              <CardContent className="space-y-3">
                <div className="font-display text-6xl">
                  {score}/{deals.length}
                </div>
                <div className="text-lg">{title(score, deals.length)}</div>
                <Button onClick={() => location.reload()} className="rounded-full bg-sunset text-white">
                  <RotateCcw /> Deal a new deck
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        {!over && (
          <div className="mt-5 flex justify-center gap-5">
            <Button size="icon" variant="secondary" className="size-14 rounded-full" onClick={() => decide(false)} aria-label="Not in their top 3">
              <X className="size-6" />
            </Button>
            <Button size="icon" className="size-14 rounded-full bg-sunset text-white" onClick={() => decide(true)} aria-label="Top 3 pick">
              <Heart className="size-6 fill-white" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Matchmaker score</span>
              <span className="font-display text-4xl">
                {score}
                <span className="text-muted-foreground">/{i}</span>
              </span>
            </div>
            <Progress value={(i / deals.length) * 100} className="h-1.5" />
            <div className="text-xs text-muted-foreground">
              {title(score, i)} · drag the card, tap the buttons or use ← →
            </div>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          {last && (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className={cn(right ? "border-mint/40" : "border-destructive/40")}>
                <CardContent className="space-y-3">
                  <div className={cn("font-display text-4xl", right ? "text-mint" : "text-destructive")}>{right ? "Called it." : "Nope."}</div>
                  <p className="text-sm">
                    {firstName(last.d.a.name)}&apos;s agent ranked {firstName(last.d.b.name)}{" "}
                    <span className="font-semibold">
                      #{last.d.rank} of {last.d.total}
                    </span>{" "}
                    · fit {last.d.fit}
                  </p>
                  <p className="rounded-xl bg-muted/50 p-3 text-sm italic leading-relaxed">“{last.d.reason}”</p>
                  <Button asChild variant="secondary" size="sm" className="rounded-full">
                    <Link href={`/dates/${last.d.dateId}`}>Watch their date →</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Behind({ d }: { d: Deal }) {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden rounded-3xl border bg-card"
      initial={{ scale: 0.92, y: 24, opacity: 0 }}
      animate={{ scale: 0.95, y: 16, opacity: 0.6 }}
      exit={{ opacity: 0 }}
      style={{ zIndex: 5 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={d.a.avatar} alt="" className="h-3/5 w-full object-cover" />
    </motion.div>
  );
}

const fly = {
  exit: (dir: number) => ({ x: dir * 520, rotate: dir * 22, opacity: 0, transition: { duration: 0.35 } }),
};

function TopCard({ d, onSwipe }: { d: Deal; onSwipe: (yes: boolean) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const like = useTransform(x, [30, 140], [0, 1]);
  const nope = useTransform(x, [-140, -30], [1, 0]);

  return (
    <motion.div
      className="absolute inset-0 z-20 cursor-grab overflow-hidden rounded-3xl border bg-card shadow-2xl active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (info.offset.x > 110) onSwipe(true);
        else if (info.offset.x < -110) onSwipe(false);
      }}
      variants={fly}
      initial={{ scale: 0.95, y: 16 }}
      animate={{ scale: 1, y: 0 }}
      exit="exit"
    >
      <div className="relative h-[62%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={d.a.avatar} alt={d.a.name} draggable={false} className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
        <motion.div style={{ opacity: like }} className="absolute left-5 top-5 -rotate-12 rounded-lg border-4 border-mint px-3 py-1 text-2xl font-black text-mint">
          TOP 3
        </motion.div>
        <motion.div style={{ opacity: nope }} className="absolute right-5 top-5 rotate-12 rounded-lg border-4 border-destructive px-3 py-1 text-2xl font-black text-destructive">
          NOPE
        </motion.div>
        <div className="absolute bottom-2 left-5 right-5">
          <div className="font-display text-4xl leading-none">{d.a.name}</div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.a.headline}</p>
        </div>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-sm text-muted-foreground">Would {firstName(d.a.name)}&apos;s agent put this person in the top 3?</p>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.b.avatar} alt={d.b.name} draggable={false} className="size-16 rounded-2xl object-cover" />
          <div className="min-w-0">
            <div className="font-display text-2xl leading-none">{d.b.name}</div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.b.headline}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
