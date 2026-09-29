/**
 * Server-Sent Events response. The Response is returned immediately and `work`
 * runs in the background, writing events as they happen, so the platform
 * streams them to the browser instead of buffering until the work is done.
 */
export function sse(work: (send: (data: unknown) => void) => Promise<void>) {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  let open = true;

  const write = (chunk: string) => {
    if (!open) return;
    writer.write(enc.encode(chunk)).catch(() => {
      open = false; // client went away; keep working so results are still saved
    });
  };
  const send = (data: unknown) => write(`data: ${JSON.stringify(data)}\n\n`);

  write(": stream open\n\n"); // flush headers + first bytes right away
  const ping = setInterval(() => write(": ping\n\n"), 10_000);

  void (async () => {
    try {
      await work(send);
    } catch (e) {
      send({ type: "error", error: e instanceof Error ? e.message : String(e) });
    } finally {
      clearInterval(ping);
      send({ type: "done" });
      if (open) await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
