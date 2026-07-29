# System Functionality — Feature Walkthrough Q&A

Operational, feature-by-feature questions organized by **user role and screen** —
"what can the system do and how does a user do it," rather than implementation
internals. For the code-level version see `docs/system-functionality-qa.md`.

---

## A. Customer / Kiosk (`/kiosk`)

### Q1. Walk me through getting a ticket as a customer.
At the public kiosk the customer:
1. Picks a **service** (e.g., Business Permit, Treasury, Civil Registry).
2. Optionally enters **name** and **phone**, and flags a **priority** type
   (Senior Citizen, PWD, Pregnant).
3. The system issues a **queue number** (e.g., `BP-001`) and **prints a ticket**.
4. If a phone number was given and SMS is enabled, a **confirmation SMS** is sent
   with their position in line and estimated wait.

### Q2. Does a customer have to enter their name or phone?
No — both are optional. A ticket can be issued with just a service selected. Name
and phone only enable the personalized SMS notifications and a name on the ticket.

### Q3. How does the system know who is a priority customer?
The customer (or kiosk attendant) selects the priority type at the kiosk. The
ticket is tagged `SC`, `PWD`, or `PG` and is placed **ahead of regular customers**
in the queue, in line with LGU rules for seniors and PWDs.

### Q4. What's printed on the ticket?
The organization name, the service, the **large queue number**, the priority label
(if any), the customer's name (if given), a "please wait" note, and a timestamp —
formatted for an 80 mm thermal printer.

### Q5. Can the kiosk be limited to certain services?
Yes. A kiosk device can be paired with a **specific set of services**, so a kiosk
placed in one section only offers the relevant services.

---

## B. Public Display (`/display`)

### Q6. What does the Display board show?
The **now-serving** numbers with their counter, and the list of **waiting**
numbers. It updates in real time as counters call and complete customers — no
refresh needed.

### Q7. Does it announce numbers out loud?
Yes. When a counter calls or **recalls** a number, the Display uses voice
announcements (text-to-speech) to call the number and counter, e.g., "Number
B-P 0 0 1, please proceed to Counter 2."

### Q8. How many waiting numbers does it show?
The board is intentionally capped (the waiting list is limited to the next several
numbers) so it stays readable on a large screen rather than scrolling a huge list.

---

## C. Counter Staff (`/counter`)

### Q9. What can counter staff do?
- **Call Next** — pull the next eligible customer (respecting priority + order).
- **Complete** — finish the current customer and free the counter.
- **Recall** — re-announce the current number if the customer didn't respond.
- **Hold** — pause the no-show timer (e.g., customer is on the way).
- **Pause / Resume** — go on break; the counter is skipped while paused.

### Q10. Can a counter be restricted to specific services?
Yes. Each counter has an assigned service list. **Call Next** only pulls customers
whose service matches; if the list is empty the counter serves **all** services.
This lets you dedicate, say, Counter 3 to Treasury only.

### Q11. What happens if the called customer doesn't show up?
After a recall and a short response window, if there's no action the ticket is
**automatically cancelled as a no-show** and the counter is freed so staff can
call the next person — no manual cleanup needed.

### Q12. Two counters press "Call Next" at the same time — can they get the same customer?
No. The system claims a customer atomically; whichever counter claims first gets
them, and the other counter automatically moves to the next available customer.

### Q13. Can staff rename a counter or change which counter they are?
Counters have editable labels (e.g., "Counter 1" → "Cashier A"), managed from the
admin side; the counter screen itself shows its assigned number/label from its
pairing.

---

## D. Admin Dashboard (`/admin`)

### Q14. What does an admin manage?
Everything for their office (client): **services**, **counters**, **device pairing
codes**, **SMS templates**, **staff/admin accounts**, plus **analytics** and the
**activity log**.

### Q15. How do you add or remove a service?
From the admin Services tab: add a service with a **name** and **prefix** (the
prefix becomes the ticket code, e.g., `BP`). Services can be **disabled**
(hidden but kept), **re-enabled**, or **deleted**. New services appear on the
kiosk immediately.

### Q16. How are new devices (kiosk/counter/display) connected?
The admin generates a **pairing code** for a device type, optionally bound to a
counter number and a set of services. The physical device enters that code and is
bound to this office. Codes can be **disabled or deleted** to instantly cut off a
device.

### Q17. Can the SMS messages be customized?
Yes. The admin edits the **confirmation**, **now-serving**, and **near-your-turn**
templates, with placeholders like `{name}`, `{queueNumber}`, `{position}`,
`{waitTime}`, `{counter}`, `{orgName}`. A **live preview** shows the rendered
message while editing.

### Q18. What reports/analytics are available to an admin?
For the day's tickets: totals by **status** (waiting/serving/completed/cancelled),
by **priority type**, by **service**, and by **hour**, plus **average wait time**,
**average service time**, and the **peak hour**. This supports staffing and
performance decisions. A date-range export of tickets is also available.

### Q19. Is there an audit trail of admin actions?
Yes — an **activity log** records actions like adding/disabling services, renaming
counters, creating/deleting pairings, login/logout, and SMS template changes, each
with **who** did it and **when**.

### Q20. Can an admin reset the queue?
Numbering resets **automatically each day**. An admin can also force a **same-day
reset**, which cancels the day's open tickets and clears all counters.

---

## E. Superadmin (`/superadmin`)

### Q21. What's the superadmin's role?
The **platform owner** across all offices. They **create new client offices**,
create each office's first admin, **suspend or reactivate** an office, change their
own credentials, and view **system-wide analytics** across every client.

### Q22. What happens when an office is suspended?
Its admins/staff are **blocked from logging in** until reactivated — a single
control to take a whole tenant offline.

### Q23. What system-wide numbers does the superadmin see?
Total clients (active/suspended), total admins, total tickets and completions for
the day, overall completion rate, and a **per-client breakdown** of activity.

---

## F. Notifications (SMS)

### Q24. What three SMS messages can be sent, and when?
- **Confirmation** — when the ticket is issued (with position + estimated wait).
- **Now serving** — the moment the number is called at a counter.
- **Near your turn** — automatically to the next few people in line so they can
  return.

### Q25. What if SMS isn't set up or the customer gave no number?
The system **skips silently** — no SMS provider configured, or no phone number,
just means no message is sent. Ticketing works normally either way.

### Q26. Will a customer get spammed with repeated "near your turn" texts?
No. Each customer receives the near-turn message **exactly once**; the system marks
them as notified so repeats are suppressed.

### Q27. Are the messages in Filipino?
Yes — the default templates are **bilingual (Tagalog + English)**, and phone
numbers are normalized to **Philippine formats**.

---

## G. Printing & General

### Q28. How does ticket printing work on a kiosk vs a regular browser?
On the **Electron kiosk** it prints **silently** to the configured thermal
printer (no dialog). In a **plain browser** it falls back to the standard print
flow (silent only if the browser was launched in kiosk-printing mode).

### Q29. Can you choose which printer the kiosk uses?
Yes — the kiosk configuration can specify a **printer name**, and the system can
**list available printers** to pick from.

### Q30. What languages/audiences is the system designed for?
A **Philippine LGU** audience: bilingual SMS, PH phone handling, legally-mandated
priority for seniors/PWDs/pregnant women, and a public-facing kiosk/display/counter
workflow typical of a government service office.
