# System Functionality — Technical Q&A

Defense-style questions and answers about *what the LGU Queuing System does* and
*how the features are implemented*. Grounded in the actual code
(`src/lib/firebaseClient.js`, `firebaseServer.js`, `smsSender.js`,
`smsTemplates.js`, and the `src/app/**` routes).

---

## Core Queue Logic

### Q1. How is a queue number generated, and how do you guarantee no two customers get the same number?
Numbers are generated **per client, per day, per service prefix** using a counter
document in the `queueSequences` collection (ID:
`{clientId}_{date}_{prefix}`, e.g. `cityhall_2026-06-16_BP`). The increment runs
inside a **Firestore transaction** (`runTransaction`):

```js
const sequenceSnap = await tx.get(sequenceRef);
const current = sequenceSnap.exists() ? Number(sequenceSnap.data().lastNumber || 0) : 0;
const next = current + 1;
tx.set(sequenceRef, { lastNumber: next, ... }, { merge: true });
const queueNumber = `${service.prefix}-${String(next).padStart(3, "0")}`; // BP-001
```

Because the read-then-write is atomic and Firestore retries the transaction on
write conflicts, two kiosks pressing "get ticket" at the same instant can never
receive the same number — one transaction sees the other's committed value and
re-runs.

### Q2. How does the priority queue work? What gets served first?
Each ticket has a `priorityRank`: **0 for priority customers** (Senior Citizen
`SC`, PWD, Pregnant `PG`) and **1 for regular**. The queue is ordered by:

```js
priorityRank asc → createdAt asc → queueNumber
```

So all priority tickets are served before regulars, and within the same rank it's
first-come-first-served (FIFO by creation time). This is a **two-tier priority
queue**, satisfying the LGU legal requirement (RA 9994 / RA 10754) to prioritize
seniors and PWDs while still being fair within each tier.

### Q3. When a counter presses "Call Next", how is the right ticket chosen and claimed safely?
`callNext(counterNo)` does the following:
1. Sweeps expired/no-show tickets first.
2. Reads the counter's assigned `serviceIds` (a counter can be restricted to
   certain services, or serve all if empty).
3. Pulls all `waiting` tickets for today, filters out expired ones and ones not
   matching the counter's services, and sorts by the priority rule above.
4. Walks the sorted candidates and tries to claim each inside a **transaction**
   that re-checks both the counter (still free?) and the ticket (still waiting?).
   The first successful claim flips the ticket to `serving`, stamps `counterNo`
   and `calledAt`, and writes the "now serving" snapshot onto the counter doc.

The transactional re-check is what makes multiple counters calling simultaneously
safe: if counter 2 grabs a ticket first, counter 1's transaction sees
`status !== "waiting"` and moves to the next candidate.

### Q4. What happens to a called customer who doesn't show up?
A **no-show timeout** mechanism. When a counter **Recalls** a customer, after a
speech window (~7 s) a `responseDeadlineAt` (~10 s) is set. `sweepQueueTimeouts()`
(run on each `callNext` and elsewhere) finds `serving` tickets whose deadline has
passed and, in a transaction, marks them `cancelled` with reason
`no_show_timeout` and frees the counter. Waiting tickets with an `expiresAt` in
the past are likewise auto-cancelled. This keeps the line moving without manual
cleanup.

### Q5. Walk through the counter staff's controls.
- **Call Next** — claim the next eligible waiting ticket (Q3).
- **Complete** — mark the current ticket `completed`, clear the counter.
- **Recall** — re-announce the current number on the Display (triggers speech),
  then start the no-show countdown.
- **Hold** — pause the countdown (e.g., customer is walking over) without
  cancelling.
- **Pause/Resume** — take the counter offline for a break; paused counters are
  skipped by `callNext` and don't count as an active "lane" for wait estimates.

---

## Real-Time & Multi-Screen

### Q6. How do the Display board and Counter screens update instantly without refreshing?
Every screen subscribes to Firestore with **`onSnapshot` listeners**
(`listenWaitingTickets`, `listenServingTickets`, `listenCounters`, etc.). Firestore
pushes changes to all connected clients in real time, so when a counter calls a
number, the Display board and other counters re-render immediately — no polling,
no manual refresh. This is the backbone of the kiosk/counter/display
synchronization.

### Q7. How does the Display announce numbers audibly?
When a ticket is recalled, `recallAt` is stamped on the counter/ticket. The
Display listens for that change and uses the browser **Speech Synthesis API** to
read out the queue number and counter (e.g., "Number B-P 0 0 1, please proceed to
Counter 2"). The two-phase recall (announce first, countdown after a speech
window) ensures the audio finishes before the no-show timer starts.

### Q8. What are the four screen roles?
- **Kiosk** (`/kiosk`) — public-facing; customer picks a service, optionally
  enters name/phone/priority, and gets a printed ticket.
- **Display** (`/display`) — large public board showing now-serving and waiting
  numbers, with voice announcements.
- **Counter** (`/counter`) — staff control panel (call/complete/hold/recall).
- **Admin / Superadmin** — management dashboards (below).

---

## Multi-Tenancy & Roles

### Q9. The system is "multi-tenant." What does that mean here?
A single deployment serves multiple LGUs/offices ("clients"). **Every document is
scoped by `clientId`** — services, counters, tickets, sequences, logs all carry
it, and every query filters `where("clientId", "==", ...)`. `clientId` is
normalized from the client name (`cleanId()`: lowercased, non-alphanumerics →
underscore). This isolates each tenant's data within shared Firestore
collections.

### Q10. What are the user roles and how is access separated?
Three roles in `adminUsers` / `systemConfig`:
- **Superadmin** — platform owner. Creates clients, creates the first admin per
  client, suspends/reactivates clients, sees system-wide analytics. Credentials
  live in `systemConfig/superadmin` (seeded from env on first run).
- **Admin** — manages one client: services, counters, device pairings, SMS
  templates, staff accounts, analytics, activity log.
- **Staff** — operates counters only.

Login checks (`adminLogin`) also block deactivated accounts and **suspended
clients**, so a superadmin can cut off a whole tenant.

### Q11. How are devices (kiosks, counters, displays) set up without manual config files?
**Pairing codes** (`devicePairings` collection). An admin generates a short code
(`makeCode()` — 6 chars from an unambiguous alphabet, no 0/O/1/I) for a device
type (kiosk/counter/display), optionally bound to a counter number and a set of
services. The physical device enters the code; `resolvePairingCode()` validates
it (must exist and be `active`) and binds that screen to the right client, counter,
and service list. Codes can be disabled or deleted, instantly de-authorizing a
device.

---

## SMS Notifications

### Q12. What SMS messages does the system send, and when?
Three types (templates in `smsTemplates.js`, bilingual Tagalog/English):
- **confirm** — when a ticket is issued at the kiosk; includes position in line
  and estimated wait.
- **serving** — the moment the customer is called at a counter.
- **near** — automatically to the next few people in line (default top 3, via
  `NEAR_NOTIFY_THRESHOLD`) so they can return to the area.

Sending goes through **Semaphore** (a PH SMS gateway) in `smsSender.js`. If
`SEMAPHORE_API_KEY` is not set, all SMS is cleanly skipped (`isSmsConfigured()`),
so the queue still works without SMS.

### Q13. How do you prevent sending the same "near your turn" SMS to a person repeatedly?
The `/api/notify-near` route **claims** each ticket inside a transaction before
sending: it sets `nearNotifiedAt` only if it isn't already set and the ticket is
still `waiting`. A ticket already marked notified is skipped. This idempotent
claim means even if the endpoint is called repeatedly (e.g., on every queue
change), each person gets the near-turn SMS exactly once.

### Q14. How is the estimated wait time calculated?
`formatWaitMinutes(peopleAhead, lanes)` in `firebaseServer.js`:

```
mins = max(AVG_SERVICE_MINUTES, ceil(peopleAhead / activeLanes) * AVG_SERVICE_MINUTES)
```

`activeLanes` = number of non-paused counters (min 1), and `AVG_SERVICE_MINUTES`
(default 5) is configurable. So wait time scales with how many people are ahead
and how many counters are actually open. The person first in line gets no wait
time (the template line is dropped by `renderTemplate`).

### Q15. The templates are editable by admins. How does placeholder substitution stay clean when a field is blank?
`renderTemplate()` replaces `{name}`, `{queueNumber}`, `{position}`, etc., then
**post-processes artifacts**: it removes empty `()` (blank service), strips spaces
before punctuation (blank `{name}`), collapses double spaces, and drops blank or
label-only lines (e.g., an "Est. wait:" line with no value for the first person).
The admin UI previews this with `SMS_PREVIEW_VARS` so they see the real output
while editing.

---

## Printing & Data

### Q16. How is a ticket printed, and what's the fallback if not on a kiosk?
`printTicket()` in `queueApp.js` builds an 80 mm thermal-printer HTML layout. On
Electron it calls `window.electronQueue.silentPrint()` (true silent print via the
main process — no dialog). On a plain browser it falls back to a hidden `<iframe>`
+ `window.print()`, which is silent only if the browser was launched with
`--kiosk-printing`. All printed values are HTML-escaped (`escapeHtml`) to avoid
breaking the layout with special characters in names.

### Q17. What does the activity log capture, and why?
`logActivity()` writes to `activityLogs` for auditable admin actions — service
added/disabled, counter renamed, pairing created/deleted, auth login/logout, SMS
template changes, etc., each with the actor (name/email/role), timestamp, and day.
For an LGU this provides accountability (who changed what, who logged in). Logging
is best-effort and never throws, so it can't break the primary operation.

### Q18. What analytics does the system produce?
`computeAnalytics(tickets)` aggregates a day's tickets into: totals by status
(waiting/serving/completed/cancelled), by priority type, by service, by hour,
**average wait time** (created→called), **average service time** (called→completed),
and the **peak hour**. The superadmin additionally gets `getSystemAnalytics()` —
cross-client totals, completion rate, and per-client breakdowns. These support
staffing decisions and performance reporting.

### Q19. What are the main Firestore collections (the data model)?
- `clients` — tenants (name, status, branding, SMS templates).
- `adminUsers` — admin/staff accounts (email-keyed).
- `systemConfig/superadmin` — platform owner credentials.
- `queueServices` — services per client (prefix, active, sort order).
- `queueCounters` — counters and their live "now serving" state.
- `queueSequences` — per-day, per-service running number.
- `queueTickets` — the tickets themselves (status, priority, timestamps).
- `devicePairings` — pairing codes binding devices to a client.
- `activityLogs` / `smsLogs` — audit trail and SMS send history.

### Q20. How does the system reset between days?
Numbering is **date-scoped** by `getTodayKey()` (`YYYY-MM-DD`) baked into the
sequence and ticket IDs, so each new day naturally starts numbering from 1 with no
manual reset. An admin can also force a same-day reset (`resetTodayQueue`), which
cancels today's open tickets and clears all counters' current-ticket state.

---

## Resilience & Edge Cases

### Q21. Two counters call "Next" at the exact same millisecond — what stops a double-serve?
Covered by the transactional claim in Q3: each claim transaction re-reads the
ticket and aborts if `status !== "waiting"`. Firestore serializes the conflicting
writes, so exactly one counter wins and the other transparently tries the next
candidate. No locks, no double-serve.

### Q22. What happens to the in-progress ticket if a counter is deleted mid-service?
`removeCounter()` checks for a `currentTicketId`; if present it cancels that ticket
(reason `counter_removed`) before deleting the counter document, so no ticket is
orphaned in a permanent `serving` state.

### Q23. If Firestore is briefly unreachable, does the whole UI crash?
No. Listeners have error callbacks that log and keep the last state; secondary
features (activity logging, SMS, analytics fallbacks) swallow errors by design.
The core ticketing still uses transactions that retry. The hard failure case is
**missing Firebase config**, which surfaces the explicit setup error — the exact
issue fixed in the Electron packaging (see `docs/electron-build-qa.md`).
