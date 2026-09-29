"use client";

import { useEffect, useState } from "react";
import { Dices, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Bubble, MiniAvatar, type Mini } from "@/components/DateView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { firstName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { Curveball, DateMessage } from "@/lib/types";

const IDEAS = [
  "Her ex walks in with a date",
  "The bill arrives: ₹40,000",
  "A power cut. Total darkness.",
  "A street musician starts playing their song",
  "The waiter recognises him from YouTube",
  "Monsoon hits. One umbrella.",
  "Someone's mum calls. On speaker.",
  "A dog runs off with her phone",
];

export function CurveballPanel({ dateId, a, b }: { dateId: string; a: Mini; b: Mini }) {
  const [twist, setTwist] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ twist: string; messages: DateMessage[]; react?: Curveball["react"] } | null>(null);
  const [past, setPast] = useState<Curveball[]>([]);

  useEffect(() => {
    fetch(`/api/dates/${dateId}/curveball`)
      .then((r) => r.json())
      .then((list) => Array.isArray(list) && setPast(list))
      .catch(() => {});
  }, [dateId]);

  async function drop() {
    const t = twist.trim();
    if (t.length < 4 || busy) return;
    setBusy(true);
    setLive({ twist: t, messages: [] });
    try {
      const res = await fetch(`/api/dates/${dateId}/curveball`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ twist: t }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || "The host tripped");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!line.startsWith("data: ")) continue;
          const e = JSON.parse(line.slice(6));
          if (e.type === "message") setLive((l) => l && { ...l, messages: [...l.messages, e.message] });
          if (e.type === "react") setLive((l) => l && { ...l, react: e.react });
          if (e.type === "saved") setPast((p) => [e.curveball, ...p]);
          if (e.type === "error") throw new Error(e.error);
        }
      }
      setTwist("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="host" className="scroll-mt-20 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-3xl font-normal">
          <Zap className="size-5 text-primary" /> You&apos;re the Date Host now
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Drop a twist into this date. The host narrates it, both agents have to deal with it in character, and then each one tells its
          person whether it changed anything.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={twist}
            onChange={(e) => setTwist(e.target.value.slice(0, 160))}
            onKeyDown={(e) => e.key === "Enter" && drop()}
            placeholder="e.g. her ex walks in with a date"
            disabled={busy}
            className="h-11"
          />
          <Button onClick={drop} disabled={busy || twist.trim().length < 4} className="h-11 rounded-xl bg-sunset px-5 text-white">
            {busy ? <Loader2 className="animate-spin" /> : <Zap />} Drop it
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => setTwist(IDEAS[Math.floor(Math.random() * IDEAS.length)])}>
            <Dices /> random
          </Button>
          {IDEAS.slice(0, 4).map((i) => (
            <Badge key={i} variant="secondary" className="cursor-pointer font-normal" onClick={() => setTwist(i)}>
              {i}
            </Badge>
          ))}
        </div>

        {live && <Episode twist={live.twist} messages={live.messages} react={live.react} a={a} b={b} pending={busy} />}

        {past.filter((p) => !live || p.twist !== live.twist).length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Twists other visitors threw</div>
            {past
              .filter((p) => !live || p.twist !== live.twist)
              .slice(0, 5)
              .map((c) => (
                <details key={c.id} className="group rounded-xl border bg-muted/30 p-3">
                  <summary className="cursor-pointer list-none text-sm">
                    <span className="text-primary">“{c.twist}”</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {firstName(a.name)} {fmt(c.react.a.delta)} · {firstName(b.name)} {fmt(c.react.b.delta)}
                    </span>
                  </summary>
                  <div className="mt-3">
                    <Episode twist={c.twist} messages={c.messages} react={c.react} a={a} b={b} />
                  </div>
                </details>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const fmt = (d: number) => (d > 0 ? `+${d}` : `${d}`);

function Episode({ messages, react, a, b, pending }: { twist: string; messages: DateMessage[]; react?: Curveball["react"]; a: Mini; b: Mini; pending?: boolean }) {
  return (
    <div className="space-y-3">
      {messages.map((m, i) => (
        <Bubble key={i} m={m} a={a} b={b} />
      ))}
      {pending && !react && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> {messages.length ? "they're handling it…" : "the host is setting it up…"}
        </div>
      )}
      {react && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(["a", "b"] as const).map((k) => {
            const p = k === "a" ? a : b;
            const r = react[k];
            return (
              <div key={k} className="flex items-start gap-2 rounded-xl border bg-card p-3 text-sm">
                <MiniAvatar p={p} className="size-7" />
                <div>
                  <div className="text-xs text-muted-foreground">
                    {firstName(p.name)}&apos;s agent ·{" "}
                    <span className={cn("font-semibold", r.delta > 0 ? "text-mint" : r.delta < 0 ? "text-destructive" : "")}>{fmt(r.delta)}</span>
                  </div>
                  <p className="italic">“{r.line}”</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
