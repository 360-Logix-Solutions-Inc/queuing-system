// In-process pub/sub bus. Every DB write publishes a change event for a client;
// /api/stream subscribes and pushes Server-Sent Events to all connected devices.
// The whole app is served by a single Next.js server process on the host PC, so
// one in-memory emitter reaches every kiosk/counter/display over the LAN.
import { EventEmitter } from "node:events";

const GLOBAL_KEY = "__queueBus__";

function getEmitter() {
  if (!globalThis[GLOBAL_KEY]) {
    const emitter = new EventEmitter();
    // Many devices may listen at once; lift the default 10-listener warning cap.
    emitter.setMaxListeners(0);
    globalThis[GLOBAL_KEY] = emitter;
  }
  return globalThis[GLOBAL_KEY];
}

// topics: subset of collections that changed, e.g. ["tickets", "counters"].
// Consumers re-query whatever they listen to when their topic fires.
export function publish(clientId, topics = []) {
  const emitter = getEmitter();
  const payload = {
    clientId: String(clientId || "default"),
    topics: Array.isArray(topics) ? topics : [topics],
    at: Date.now(),
  };
  emitter.emit("change", payload);
}

export function subscribe(handler) {
  const emitter = getEmitter();
  emitter.on("change", handler);
  return () => emitter.off("change", handler);
}
