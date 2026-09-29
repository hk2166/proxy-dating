/** Server-Sent Events response that runs `work` and streams whatever it sends. */
export function sse(work: (send: (data: unknown) => void) => Promise<void>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          open = false;
        }
      };
      const ping = setInterval(() => {
        if (open) {
          try {
            controller.enqueue(enc.encode(": ping\n\n"));
          } catch {
            open = false;
          }
        }
      }, 10_000);
      try {
        await work(send);
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : String(e) });
      } finally {
        clearInterval(ping);
        send({ type: "done" });
        if (open) controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
