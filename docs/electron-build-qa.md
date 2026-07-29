# Electron Build — Technical Q&A

A defense-style set of technical questions and answers about how this LGU Queuing
System is packaged as a desktop (Electron) application, and the Firebase-config
bug that was fixed during packaging.

---

## Architecture & Packaging

### Q1. Why was Electron chosen instead of just running the web app in a browser?
The system runs on unattended kiosk/counter/display terminals in an LGU office.
Electron gives us:
- **Kiosk mode** — a locked, full-screen window with no address bar, tabs, or
  OS chrome (`kiosk: true`, `autoHideMenuBar`, `Menu.setApplicationMenu(null)`),
  so the public can't browse away from the queue UI.
- **Native silent printing** — thermal ticket printing without the browser's
  print dialog, via `webContents.print({ silent: true })` over IPC.
- **Single installable artifact** — a one-file `.exe` installer staff can run,
  rather than asking them to install Node, start a server, and open a browser.
- **Self-contained runtime** — the bundled Chromium + Node mean the target PC
  needs nothing pre-installed.

### Q2. How does the packaged app actually serve the Next.js application?
The Next.js app is **not** exported to static HTML — it has dynamic API routes
(`/api/config`, `/api/notify-ticket`, etc.) that must run on a server. So at
startup Electron's main process spawns a real Next.js production server:

```js
nextProcess = spawn(process.execPath, [nextBinary, "start", "-p", "3000"], { ... })
```

The Electron `BrowserWindow` then loads `http://localhost:3000/kiosk`. In effect
the app ships its own local web server and points a locked browser window at it.

### Q3. What are the three ways the app can be pointed at a UI?
Controlled by `config.json` / env vars read in `main.js`:
1. **Local server (default)** — packaged build runs `next start` on `:3000`.
2. **Remote URL** — if `remoteUrl` is set, it skips the local server and loads a
   hosted deployment (`USE_REMOTE`), so the same kiosk binary can front a cloud
   instance.
3. **Dev** — when not packaged, it loads `http://localhost:3000` from `next dev`.

This is why behavior can be changed **without rebuilding** — an admin edits
`config.json` next to the installed `.exe` (`remoteUrl`, `startupPath`, `kiosk`,
`fullscreen`, `printerName`).

### Q4. Why is `asar: false` in the build config?
`asar` normally bundles app files into a single archive. It's disabled here
because the packaged app launches `next start` from
`resources/app/node_modules/next/...` as a **child process**, and Next needs to
read its own files (`.next/`, `node_modules`) directly from disk. electron-builder
warns about it, but for an app that spawns a server from its own files, leaving
files unpacked is the correct trade-off.

---

## The Firebase Bug

### Q5. What was the actual error, and what caused it?
The kiosk showed *"Firebase setup error: Firebase config is missing. Check
FIREBASE_* values in .env."*

Root cause: the client fetches Firebase credentials at runtime from the
`/api/config` route, which reads `process.env.FIREBASE_*` **on the server**. In
the packaged app the Next server is spawned with `cwd: resources/app`, but the
`.env` file is shipped by `extraResources` to `resources/.env` — **one directory
above** the server's working directory. Next.js only auto-loads `.env` from its
cwd, so those variables were never defined and the API returned empty strings.

### Q6. Why is the Firebase config fetched from an API route instead of baked into the build?
Two reasons:
- The config values are **not** prefixed `NEXT_PUBLIC_`, so Next.js does not
  inline them into the client bundle at build time. They only exist server-side.
- Fetching at runtime means the **same compiled build** can be pointed at a
  different Firebase project just by changing `.env` — no rebuild needed, which
  matters for a multi-tenant LGU deployment.

### Q7. How was it fixed?
In `electron/main.js`, instead of relying on Next's cwd-based `.env` loading, the
main process now finds and parses the `.env` itself and **injects the values into
the spawned server's environment**:

```js
const fileEnv = loadServerEnv();          // searches resources/.env, beside exe, dev root
spawn(process.execPath, [nextBinary, "start", "-p", "3000"], {
  cwd: path.join(process.resourcesPath, "app"),
  env: { ...process.env, ...fileEnv, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production" },
});
```

`loadServerEnv()` checks several candidate paths (beside the exe,
`resources/.env`, `resources/app/.env`, and the dev project root) so it works in
both installed and portable layouts. A small dotenv-compatible parser
(`parseEnvFile`) avoids adding a runtime dependency.

### Q8. The original code spawned `"node"`. Why was that also a problem, and how was it fixed?
`spawn("node", ...)` assumes a `node` executable is on the target machine's PATH.
On a fresh LGU kiosk PC, Node.js is usually **not installed**, so the server would
silently fail to start. The fix runs **Electron's own bundled Node** by spawning
`process.execPath` (the app's exe) with `ELECTRON_RUN_AS_NODE=1`, which tells the
Electron binary to behave as a plain Node interpreter. The app becomes fully
self-contained with no external Node dependency.

### Q9. How was the fix verified — how do you know it works?
The packaged build was launched and the server endpoint was probed directly:

```
GET http://localhost:3000/api/config
→ firebase.projectId = "queuing-system-a3a7e", all 6 keys populated
```

Before the fix the same endpoint returned all-empty strings. Verifying at the
API layer proves the server now sees the env vars, which is exactly what the
client needs.

### Q10. During testing the app "exited immediately." Was that a real bug?
No — it was a **test-environment artifact**. An earlier manual diagnostic set
`ELECTRON_RUN_AS_NODE=1` in the shell, and that variable leaked into later
launches. With that flag set, double-clicking `Queuing System.exe` makes the
Electron binary run as Node instead of as the GUI app, so it exited instantly
with a Node `bad option` error. Clearing the variable and relaunching showed the
app starting normally (6 processes, port 3000 up). The lesson: `ELECTRON_RUN_AS_NODE`
must be scoped to the **child** spawn only, never the parent environment.

---

## Hardening & Operations

### Q11. Is shipping the `.env` in plaintext a security risk?
The `.env` is packed unencrypted at `resources\.env`. For this app the practical
risk is low because the Firebase **Web API key is a client-side credential** — it
is meant to reach the browser anyway and is not a secret; access is governed by
Firebase Security Rules, not key secrecy. The values that *are* sensitive
(superadmin password, SMS provider keys) should be protected by Firestore rules
and, ideally, not shipped to public-facing kiosk devices. For a remote-URL
deployment the kiosk binary can run with **no** `.env` at all.

### Q12. How do staff exit the locked kiosk?
A keyboard escape hatch is wired in `before-input-event`: **Ctrl/Cmd + Shift + Q**
calls `app.quit()`. This lets staff close the kiosk without Task Manager while
still hiding the menu bar from the public.

### Q13. How does silent thermal printing work across the process boundary?
The renderer (web UI) can't print silently on its own. It calls
`window.electronQueue.silentPrint(html)` exposed by the `preload.js` context
bridge, which invokes an IPC handler in the main process. The main process opens
a hidden `BrowserWindow`, loads the ticket HTML, and calls
`webContents.print({ silent: true, deviceName: PRINTER_NAME, ... })` with an
80 mm page size. A companion `queue:list-printers` handler lets admins pick the
printer name, stored in `config.json`.

### Q14. Why is the installer ~476 MB?
`asar` is disabled and `node_modules` (including the full `next` + `firebase`
toolchains) plus the bundled Chromium/Electron runtime are all packed unminified.
This is expected for an unpacked Electron app and is acceptable for a one-time
kiosk install. It could be trimmed by enabling `asar` with targeted `asarUnpack`,
or by pruning dev/optional dependencies, but that wasn't necessary here.

### Q15. The build is unsigned. What's the consequence?
Without a code-signing certificate, Windows SmartScreen warns on first run
("unknown publisher"). It still installs and runs. Removing the warning requires
purchasing an OV/EV code-signing certificate and wiring it into electron-builder
(`win.certificateFile` / signing env vars). For an internal LGU tool this is
optional; for public distribution it is recommended.

### Q16. How would you diagnose a kiosk that boots to a blank/erroring screen in the field?
The fix added a server log at
`%APPDATA%\Queuing System\next-server.log` capturing the Next server's stdout and
stderr. On a misbehaving terminal you read that log to see whether the server
started, bound to `:3000`, or threw (e.g., missing env, port conflict). The
window itself also retries `loadURL` up to 30 times before showing an error
dialog (suppressed in kiosk mode), so transient slow starts self-recover.
