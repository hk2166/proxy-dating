"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [li, setLi] = useState("");
  const [ig, setIg] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/linkedin\.com\/in\//i.test(li)) return setErr("LinkedIn link should look like linkedin.com/in/username");
    if (!/instagram\.com\/[A-Za-z0-9._]+/i.test(ig) && !/^@?[A-Za-z0-9._]{1,30}$/.test(ig.trim()))
      return setErr("Instagram link should look like instagram.com/username");
    setErr("");
    router.push(`/join?li=${encodeURIComponent(li.trim())}&ig=${encodeURIComponent(ig.trim())}`);
  }

  return (
    <form onSubmit={submit} className={`rounded-2xl border border-line bg-card p-3 shadow-sm ${compact ? "" : "sm:p-4"}`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 focus-within:border-ink">
          <span className="rounded bg-[#0a66c2] px-1.5 py-0.5 text-[10px] font-bold text-white">in</span>
          <input
            value={li}
            onChange={(e) => setLi(e.target.value)}
            placeholder="linkedin.com/in/…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
            aria-label="LinkedIn profile URL"
          />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 focus-within:border-ink">
          <span className="rounded bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] px-1.5 py-0.5 text-[10px] font-bold text-white">IG</span>
          <input
            value={ig}
            onChange={(e) => setIg(e.target.value)}
            placeholder="instagram.com/… (public)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
            aria-label="Instagram profile URL"
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="submit" className="rounded-xl bg-rose px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink">
          Create their agent &amp; send it dating →
        </button>
        {err ? <span className="text-sm text-rose">{err}</span> : <span className="text-xs text-muted">Only these two public links are used. Nothing else.</span>}
      </div>
    </form>
  );
}
