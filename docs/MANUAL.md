# LGU Queuing System — User Manual

A practical guide on how to set up, navigate, and operate the queuing system.

---

## Table of Contents

1. [Overview of Roles & Screens](#1-overview-of-roles--screens)
2. [Getting Started (Login URLs)](#2-getting-started-login-urls)
3. [SuperAdmin Guide](#3-superadmin-guide)
4. [Admin Guide](#4-admin-guide)
5. [Device Pairing](#5-device-pairing)
6. [Kiosk Guide (for citizens)](#6-kiosk-guide-for-citizens)
7. [Counter Control Guide (for staff)](#7-counter-control-guide-for-staff)
8. [Public Display Guide](#8-public-display-guide)
9. [SMS Notifications](#9-sms-notifications)
10. [Desktop App & Silent Printing](#10-desktop-app--silent-printing)
11. [Daily Operating Checklist](#11-daily-operating-checklist)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview of Roles & Screens

The system has **three user roles** and **four screens**.

| Role | Who | What they do |
|------|-----|--------------|
| **SuperAdmin** | System owner | Creates LGU accounts and their admins; monitors all offices |
| **Admin** | Per-LGU administrator | Sets up services, counters, staff, SMS, branding |
| **Counter Staff** | Window personnel | Calls and serves customers |

| Screen | Path | Used by | Purpose |
|--------|------|---------|---------|
| **Kiosk** | `/kiosk` | Citizens | Take a queue number |
| **Counter Control** | `/counter` | Staff | Call/serve tickets |
| **Display** | `/display` | Public | Live "Now Serving" board |
| **Admin Portal** | `/admin` | Admin | Manage everything |
| **SuperAdmin** | `/superadmin` | System owner | Manage LGUs |

---

## 2. Getting Started (Login URLs)

Open a browser (or the desktop app) and go to the screen you need:

- **Admin login:** `https://your-site/admin`
- **SuperAdmin login:** `https://your-site/superadmin`
- **Kiosk:** `https://your-site/kiosk`
- **Counter:** `https://your-site/counter`
- **Display:** `https://your-site/display`

> In the desktop app, the screen that opens is set in `config.json` (see [Section 10](#10-desktop-app--silent-printing)).

---

## 3. SuperAdmin Guide

The SuperAdmin sets up new LGU clients.

1. Go to `/superadmin` and log in.
2. **Create an LGU client** — provide the office name, the first admin's name, email, and password.
3. The new admin can now log in at `/admin` using those credentials.
4. Use the dashboard to **view system-wide analytics** and **enable/disable** clients.

---

## 4. Admin Guide

Log in at `/admin`. The sidebar is grouped into three sections:

### Operations
- **Overview** — quick counts (services, counters, pairings) and analytics.
- **Activity** — audit log of actions (logins, ticket events, changes).
- **Launch** — open the Kiosk, Counter, or Display in a new tab. Also includes **Single-Counter Screens** (a button per counter that opens a screen showing only that counter's queue).

### Configuration
- **Services & Counters**
  - *Services*: add the services citizens can choose (e.g., "Business Permit"), each with a queue **prefix** (e.g., `BP`). You can rename, disable, re-enable, or delete.
  - *Counters & Routing*: add counters, rename them, and use the chips to **route specific services to specific counters**.
- **Pairing** — generate codes to bind kiosk/counter/display devices (see [Section 5](#5-device-pairing)).
- **SMS / Notifications** — two sub-tabs:
  - *Message Format*: edit the **confirmation**, **now-serving**, and **near-your-turn** templates. Click placeholder chips (`{name}`, `{queueNumber}`, `{position}`, `{waitTime}`, etc.) to insert them. A **live preview** shows the result. Use **Reset** to restore a default, then **Save**.
  - *Logs*: every SMS sent, with Time / Type / Number / Queue / Status. Filter by All / Sent / Failed.
- **Branding** — set the LGU name, logo, and theme color shown on the Display and headers.

### Account
- **Staff** — add/remove counter staff accounts and toggle them active.
- **Settings** — change your own admin email and password.

---

## 5. Device Pairing

Pairing binds a physical device to an LGU (and optionally to a specific counter/services).

1. In Admin → **Pairing**, click **Generate Pairing Code**.
2. Choose the device **type**: Kiosk, Counter, or Display.
   - For a **Counter** device, set the **Counter No.** (e.g., 1) so that screen shows **only Counter 1's queue**.
   - Optionally set **auto-print** and the **services** it handles.
3. On the device, open the **pair URL** (e.g., `/kiosk?pair=CODE`). The device remembers the pairing afterward.
4. Manage active pairings from the same page (toggle services, deactivate, delete).

---

## 6. Kiosk Guide (for citizens)

1. **Touch to Start.**
2. **Select a service.**
3. (Optional) Enter **name** and **phone number** to receive SMS updates.
   - If you enter personal info, a **Data Privacy Act consent** notice appears — tap **I Agree & Continue**.
   - If you leave both blank, you proceed straight to your ticket.
4. (Optional) Choose a **priority lane**: Senior, PWD, or Pregnant.
5. Tap **Fall in Line** — your **queue number** is shown and the ticket prints.
6. Wait for your number to be called on the Display or by voice.

---

## 7. Counter Control Guide (for staff)

Log in at `/counter` (staff login or paired device).

- **Auto-call**: when your counter is free, the next ticket is called automatically.
- **Complete**: finishes the current customer and calls the next one.
- **Recall**: replays the announcement for the current number (if they didn't show).
- **Hold**: pauses the auto-cancel timer for the current ticket.
- **Pause / Resume**: take a break — your counter is skipped while paused.

**Single-counter view:** if you only want to see your own counter, use a paired Counter device or open `/counter?counter=1`. The screen then shows just that counter.

**Stats bar** at the top shows Waiting, Priority, and Now Serving counts.

---

## 8. Public Display Guide

- Open `/display` on the lobby monitor (or a paired Display device).
- Shows the **live "Now Serving"** numbers per counter.
- **Announces** each called number out loud in **English and Filipino**.
- Best shown fullscreen. In the desktop app, use kiosk/fullscreen mode.

> The first time the page loads, a click may be required to enable audio (browser autoplay policy).

---

## 9. SMS Notifications

When a customer provides a phone number, the system can send:

1. **Confirmation** — right after getting a ticket (queue number, position, estimated wait).
2. **Near your turn** — automatically when they're among the next few in line.
3. **Now serving** — the moment their number is called (which counter to go to).

Messages are **bilingual (Tagalog then English)** and the wording is fully editable in **Admin → SMS / Notifications → Message Format**.

**Requirements:** a Semaphore account with credits, the API key (`SEMAPHORE_API_KEY`) set on the server's `.env`, and an approved sender name (`SEMAPHORE_SENDER_NAME`). If SMS isn't configured, ticketing still works — messages are simply skipped.

---

## 10. Desktop App & Silent Printing

The system can run as a **Windows desktop app** (Electron) for kiosks and counters, enabling **silent printing** directly to a thermal printer (no print dialog).

- **Install:** run the `Setup.exe`, or extract the **portable** ZIP and run `Queuing System.exe`.
- **Configure (optional):** place a `config.json` beside the installed `.exe`:
  ```json
  {
    "remoteUrl": "https://your-site.vercel.app",
    "startupPath": "/kiosk",
    "kiosk": true,
    "fullscreen": true,
    "printerName": "EPSON TM-T20"
  }
  ```
  - `startupPath` — which screen opens (`/kiosk`, `/counter`, `/display`).
  - `printerName` — leave blank to use the system default.
  - `kiosk` / `fullscreen` — lock the screen for public use.
- **Exit kiosk mode:** press **Ctrl + Shift + Q**.

---

## 11. Daily Operating Checklist

**Opening:**
1. Power on kiosk, counter PCs, and the lobby display.
2. Confirm each screen loaded the correct LGU (check the header/branding).
3. Counter staff log in and ensure counters are **not paused**.

**During the day:**
- Staff use Complete / Recall / Pause as needed.
- Admin can monitor live counts in **Overview** and check **SMS Logs**.

**Closing:**
- Optionally **Cancel Today** to clear remaining tickets (Counter screen or Admin).
- Log out of staff and admin sessions.

---

## 12. Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| Ticket won't print | Wrong/missing printer or running in browser | Set `printerName` in `config.json`; use the desktop app for silent print |
| No SMS received | API key missing, no credits, or no phone entered | Check Semaphore credits + API key; confirm customer entered a number |
| SMS sender wrong | Sender name not approved | Approve the sender name in the Semaphore dashboard |
| Display has no sound | Browser blocked autoplay | Click once on the display page to enable audio |
| Counter shows all counters | Device not bound to a specific counter | Pair as a Counter device with a Counter No., or open `/counter?counter=N` |
| Changed `.env` but no effect | Server not restarted / app not rebuilt | Restart the dev server, or rebuild the desktop app |
| Wrong office shown on a device | Old pairing cached | Re-open the device with a fresh `?pair=CODE` URL |

---

*For the project's technical scope and architecture, ask your administrator for the Project Overview document.*
