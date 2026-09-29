"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourceTag } from "@/components/bits";

export function JoinForm() {
  const router = useRouter();
  const [li, setLi] = useState("");
  const [ig, setIg] = useState("");
  const [err, setErr] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!/linkedin\.com\/in\//i.test(li)) return setErr("LinkedIn should look like linkedin.com/in/username");
    if (!/instagram\.com\/[\w.]+/i.test(ig) && !/^@?[\w.]{1,30}$/.test(ig.trim())) return setErr("Instagram should look like instagram.com/username");
    setErr("");
    router.push(`/join?li=${encodeURIComponent(li.trim())}&ig=${encodeURIComponent(ig.trim())}`);
  }

  return (
    <form onSubmit={go} className="rounded-2xl border bg-card/80 p-3 shadow-2xl shadow-primary/5 backdrop-blur">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2">
            <SourceTag source="linkedin" />
          </span>
          <Input value={li} onChange={(e) => setLi(e.target.value)} placeholder="linkedin.com/in/…" className="h-11 pl-10" aria-label="LinkedIn URL" />
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2">
            <SourceTag source="instagram" />
          </span>
          <Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="instagram.com/… (public)" className="h-11 pl-10" aria-label="Instagram URL" />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11 rounded-xl bg-sunset px-5 text-white hover:opacity-90">
          Build their agent & send it on dates <ArrowRight />
        </Button>
        <span className={err ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>{err || "Only these two public links. Nothing else."}</span>
      </div>
    </form>
  );
}
