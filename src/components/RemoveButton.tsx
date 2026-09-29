"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemoveButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "confirm" | "busy">("idle");
  async function remove() {
    setStage("busy");
    await fetch(`/api/people/${id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }
  if (stage === "idle")
    return (
      <button onClick={() => setStage("confirm")} className="text-xs text-muted underline-offset-2 hover:text-rose hover:underline">
        Remove this profile
      </button>
    );
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-muted">Remove {name} and all their dates?</span>
      <button onClick={remove} disabled={stage === "busy"} className="rounded bg-rose px-2 py-1 font-medium text-white">
        {stage === "busy" ? "Removing…" : "Yes, remove"}
      </button>
      <button onClick={() => setStage("idle")} className="text-muted hover:text-ink">
        Cancel
      </button>
    </span>
  );
}
