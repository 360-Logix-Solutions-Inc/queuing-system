// Shared SMS template defaults + renderer. Used by both the admin UI (editing /
// live preview) and the server routes (actual send). Keep this isomorphic — no
// Node- or browser-only APIs here.

export const DEFAULT_SMS_TEMPLATES = {
  confirm:
    "Salamat {name}, nakapila ka na. Ikaw ang pang-{position} sa pila.\n" +
    "Good day {name}, you are now in the queue. You are #{position} in line.\n" +
    "Tinatayang hintay / Est. wait: {waitTime}\n" +
    "Queue: {queueNumber} ({serviceName})\n" +
    "- {orgName}",
  serving:
    "Tinatawag ka na {name}. Pumunta ka na sa counter.\n" +
    "You are now being called {name}. Please proceed to the counter.\n" +
    "Queue: {queueNumber}. Counter: {counter}\n" +
    "- {orgName}",
  near:
    "Malapit ka nang tawagin {name}, manatili ka sa malapit. Ikaw ang pang-{position} sa pila.\n" +
    "You will be called soon {name}, please stay nearby. You are #{position} in line.\n" +
    "Tinatayang hintay / Est. wait: {waitTime}\n" +
    "Queue: {queueNumber}\n" +
    "- {orgName}",
};

// Message types in display order, with labels + the placeholders each supports.
export const SMS_TYPES = [
  {
    key: "confirm",
    label: "Ticket confirmation",
    hint: "Sent when a customer gets a ticket at the kiosk.",
    placeholders: ["{name}", "{queueNumber}", "{serviceName}", "{position}", "{waitTime}", "{orgName}"],
  },
  {
    key: "serving",
    label: "Now serving alert",
    hint: "Sent the moment a ticket is called at a counter.",
    placeholders: ["{name}", "{queueNumber}", "{serviceName}", "{counter}", "{orgName}"],
  },
  {
    key: "near",
    label: "Near your turn",
    hint: "Sent automatically to the next few people in line.",
    placeholders: ["{name}", "{queueNumber}", "{serviceName}", "{position}", "{waitTime}", "{orgName}"],
  },
];

// Replace {placeholders} with values, then tidy artifacts left by blank values
// (e.g. an empty "()" or a dangling space before "!" when {name} is missing).
export function renderTemplate(template, vars = {}) {
  return String(template || "")
    .replace(/\{(\w+)\}/g, (_, key) => {
      const v = vars[key];
      return v === undefined || v === null ? "" : String(v);
    })
    .replace(/\(\s*\)/g, "")            // drop empty () from a blank serviceName
    .replace(/[ \t]+([,.!?:])/g, "$1")  // no space before punctuation (blank {name})
    .replace(/[ \t]{2,}/g, " ")         // collapse runs of spaces
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    // Drop blank lines and "label-only" lines (e.g. "Est. wait:" when the value
    // is empty — happens for the first person in line, who has no wait time).
    .filter((line) => line.trim() !== "" && !/:\s*$/.test(line))
    .join("\n")
    .trim();
}

// Sample values for the admin live preview.
export const SMS_PREVIEW_VARS = {
  name: "Juan",
  queueNumber: "BP-001",
  serviceName: "Business Permit",
  counter: "Counter 2",
  position: 2,
  waitTime: "~15 min",
  orgName: "City Hall",
};
