// Server-Sent Events endpoint. Each device opens EventSource('/api/stream?clientId=...')
// and receives a lightweight message whenever data it cares about changes. The
// browser localClient re-queries the relevant REST endpoint on each event — this
// replaces Firestore's onSnapshot with a single push channel per device.
import { subscribe } from "../../../lib/server/bus.js";
import { normalizeClientId } from "../../../lib/queueConstants.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientId = normalizeClientId(searchParams.get("clientId") || "default");
  const encoder = new TextEncoder();

  let unsubscribe = () => {};
  let heartbeat;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event, data) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (_) { /* stream closed */ }
      };

      // Initial handshake so the client can flip its "connected" banner on.
      send("ready", { clientId, at: Date.now() });

      unsubscribe = subscribe((payload) => {
        if (payload.clientId !== clientId) return;
        send("change", payload);
      });

      // Comment heartbeat every 20s keeps proxies/browsers from dropping idle SSE.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch (_) { /* closed */ }
      }, 20000);
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
