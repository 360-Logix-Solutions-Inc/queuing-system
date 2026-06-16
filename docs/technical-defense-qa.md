# Technical Defense — System-Wide Q&A

Broad, panel-style technical questions covering the **stack, design decisions,
security, scalability, and limitations** of the LGU Queuing System. Complements:
- `docs/electron-build-qa.md` — packaging / Electron build
- `docs/system-functionality-qa.md` — feature behavior

Answers are grounded in the real stack: Next.js 16 (App Router, Turbopack),
React 19, Firebase 11 (Firestore Web SDK), Electron 33, Semaphore SMS,
electron-builder.

---

## Technology Stack & Choices

### Q1. Describe the overall architecture in one breath.
A **Next.js (React) web app** is the single UI codebase, served four ways
(kiosk, display, counter, admin). **Cloud Firestore** is the real-time database
and the only backend store. A few **Next API routes** act as a thin server layer
for things that must stay server-side (Firebase config delivery, SMS sending).
The whole web app is then **wrapped in Electron** to run as a locked-down desktop
kiosk that prints tickets natively. SMS goes out through **Semaphore**.

### Q2. Why Next.js instead of a plain React SPA or a traditional PHP/MySQL stack?
- **Hybrid rendering + API routes in one project** — the UI and the small server
  layer (`/api/config`, `/api/notify-*`) live together; no separate backend to
  deploy.
- **App Router file-based routing** maps cleanly to the four screens (`/kiosk`,
  `/display`, `/counter`, `/admin`).
- The project sits in a XAMPP folder historically, but it deliberately does **not**
  use PHP/MySQL — it needs **real-time push** (a queue board must update the
  instant a number is called), which Firestore provides natively and a
  request/response MySQL stack does not.

### Q3. Why Firestore instead of a relational database (MySQL/PostgreSQL)?
- **Real-time listeners** (`onSnapshot`) push changes to every screen instantly —
  the core requirement.
- **Atomic transactions** (`runTransaction`) give safe concurrent number
  generation and ticket claiming without managing a SQL server.
- **Serverless / managed** — no DB server to host on an LGU machine; offices just
  need internet.
- Trade-off: we give up relational joins and ad-hoc SQL, so the data is
  **denormalized** and queried by `clientId` + composite filters instead.

### Q4. Why wrap it in Electron at all instead of just opening a browser in kiosk mode?
Chrome/Edge kiosk mode can't do **true silent thermal printing** without flags,
can't be fully locked from the public, and still needs someone to start a server
and type a URL. Electron bundles Chromium **and** a Node runtime, spawns its own
Next server, prints silently over IPC, and ships as one installable `.exe`. See
`docs/electron-build-qa.md`.

---

## Data Modeling & Consistency

### Q5. Firestore has no joins. How do you model relationships?
By **denormalization and composite document IDs**. Examples:
- A counter document stores a *copy* of its current ticket's display fields
  (`currentQueueNumber`, `currentServiceName`, …) so the Display reads one doc, not
  a join.
- IDs encode relationships: `queueTickets/{clientId}_{date}_{queueNumber}`,
  `queueSequences/{clientId}_{date}_{prefix}`. This makes the "natural key"
  directly addressable and prevents duplicates by construction.

### Q6. How is strong consistency achieved for the two operations that need it?
Both critical sections use **Firestore transactions**:
1. **Number issuance** — read sequence, increment, write, all atomically.
2. **Ticket claiming** — re-read counter + ticket, claim only if still free/waiting.
Firestore's optimistic concurrency retries the transaction on conflict, so
simultaneous kiosks/counters serialize correctly without explicit locks.

### Q7. Why store display fields on the counter doc instead of always reading the ticket?
Performance and simplicity of listeners. The Display subscribes to the small
`queueCounters` set and gets the now-serving info directly, instead of maintaining
a second listener per ticket and joining client-side. The cost is having to keep
those copied fields in sync — handled in the same transaction that changes state.

---

## Security

### Q8. How is authentication handled, and what's the weakness?
Admin/staff/superadmin credentials are stored in the `adminUsers` /
`systemConfig` collections and checked in `adminLogin()` / `superAdminLogin()`.
**Honest limitation:** passwords are currently stored and compared in **plaintext**
in Firestore — there's no Firebase Auth and no hashing. For production this should
be replaced with **Firebase Authentication** (or at least server-side bcrypt
hashing), since anyone with database read access could see passwords. This is the
single most important hardening item.

### Q9. Isn't shipping the Firebase API key (in `.env`/client) a security hole?
No — a Firebase **Web API key is not a secret**. It only identifies the project;
it does not grant data access. Access is controlled by **Firestore Security
Rules**. The real exposure is that this repo **does not yet include security
rules**, so the database is only as safe as the project's current rule
configuration. The defense-grade answer: *the key is fine to ship; the security
rules are what must be locked down.*

### Q10. What Firestore Security Rules would you write?
At minimum:
- Public/kiosk paths may **create** tickets and **read** their own/today's queue,
  but not read `adminUsers`, `systemConfig`, or other clients' data.
- Admin writes (services, counters, pairings) gated to authenticated admins of the
  **matching `clientId`**.
- `adminUsers`/`systemConfig` readable only by the server/superadmin.
This pairs with moving auth to Firebase Auth so rules can key off `request.auth`.

### Q11. How is one tenant prevented from seeing another's data today?
Application-level: every query filters `where("clientId", "==", ...)` and
login binds a user to a `clientId`. **This is enforced in code, not yet in
security rules**, so true isolation requires the rules in Q10. A panel will
likely push on this — the correct answer acknowledges it's currently a soft
boundary.

---

## Scalability & Performance

### Q12. How many concurrent screens/users can this handle?
Firestore scales the data layer automatically; the practical limits are:
- **Listener fan-out** — each open screen holds `onSnapshot` subscriptions; for a
  single LGU office (tens of screens) this is trivial.
- **Document write hotspots** — the per-day sequence counter is a single document;
  Firestore caps sustained writes at ~1 write/sec/document. For ticket-issuing
  rates in a government office (well under that) it's fine; a high-throughput
  scenario would need sharded counters.
- Listener queries are bounded (`.slice(0, 15)` waiting, `.slice(0, 8)` completed)
  to keep the boards light.

### Q13. Does every screen reading "all today's tickets" get expensive?
Reads are scoped by `clientId` + `serviceDate == today` + `status`, so a listener
only receives that day's relevant tickets, not the whole history. Aggregations for
analytics use range queries (`serviceDate >=/<=`) on demand, not live listeners.

### Q14. What happens to the app if the internet drops?
The Firestore SDK has an **offline cache** and will queue writes, but a queuing
system that can't talk to peers in real time is degraded by nature (other screens
won't see updates until reconnect). The UI doesn't crash — listeners keep last
state and transactions retry on reconnect — but **reliable internet is a
deployment requirement** for multi-screen sync. A fully offline-first design would
need a local broker, which is out of scope.

---

## Operations, Quality & Limitations

### Q15. How configurable is the system without code changes?
Heavily: services, counters, SMS templates, pairings, and credentials are all
**data in Firestore**, editable from the admin UI. Runtime behavior of the kiosk
(URL, startup page, kiosk/fullscreen, printer) is driven by a `config.json` next
to the installed exe. Tunables like `AVG_SERVICE_MINUTES` and
`NEAR_NOTIFY_THRESHOLD` are environment variables.

### Q16. What's your testing/QA story?
Honest answer: the repo currently has **no automated test suite**. Verification has
been **manual/integration** — e.g., launching the packaged app and probing
`/api/config`, exercising the kiosk→counter→display flow. A production hardening
plan would add unit tests around the pure logic (`renderTemplate`,
`computeAnalytics`, `normalizePhone`, sort comparators) and emulator-based tests
for the transaction paths.

### Q17. If you had to name the top 3 technical weaknesses, what are they?
1. **Plaintext credentials / no Firebase Auth** (Q8).
2. **No committed Firestore Security Rules** — tenant isolation is app-level only
   (Q9–Q11).
3. **No automated tests** (Q16).
None affect the demo's behavior, but all three are the first items for a
production rollout. Being upfront about these is stronger than claiming the system
is flawless.

### Q18. How would you scale this from one office to province-wide?
- Move auth to **Firebase Auth** + custom claims for `clientId`/role.
- Author **Security Rules** for true multi-tenant isolation.
- **Shard the sequence counters** if any single office exceeds ~1 ticket/sec.
- Add **server-side scheduled cleanup** (Cloud Functions) for daily resets and
  no-show sweeps instead of relying on a screen being open to trigger
  `sweepQueueTimeouts`.
- Centralized monitoring/log aggregation across the `activityLogs` of all tenants.

### Q19. Why is the no-show sweep triggered by client actions instead of a backend cron?
Current design runs `sweepQueueTimeouts()` opportunistically (e.g., on each
`callNext`) because there's no always-on server component — the only backend is
Firestore + thin API routes. It works as long as counters are active. The cleaner
production approach is a **Cloud Functions scheduled job**, noted in Q18. This is a
deliberate, acknowledged trade-off to keep the system serverless and cheap.

### Q20. What makes this system specifically fit for an LGU rather than a generic queue app?
- **Legally-mandated priority** for seniors/PWDs/pregnant built into the ordering.
- **Bilingual (Tagalog/English) SMS** templates tuned for Filipino citizens.
- **PH phone normalization** and a **PH SMS gateway** (Semaphore).
- **Offline kiosk hardware focus** (thermal tickets, locked terminals) matching how
  government offices actually operate.
- **Multi-tenant** so a provincial IT office can run many municipalities from one
  deployment.
