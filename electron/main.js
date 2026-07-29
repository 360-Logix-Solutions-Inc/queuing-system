const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;

// All LAN IPv4 addresses of this host, so client devices know where to connect.
function computeLanInfo(port) {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  return { ips, port, urls: ips.map((ip) => `http://${ip}:${port}`) };
}

// Runtime config — read from config.json next to the installed exe so admins
// can change URL / startup path / kiosk mode without rebuilding the app.
function readRuntimeConfig() {
  const candidates = [];
  if (!isDev) {
    candidates.push(path.join(path.dirname(app.getPath("exe")), "config.json"));
    candidates.push(path.join(process.resourcesPath, "config.json"));
  }
  candidates.push(path.join(__dirname, "..", "config.json"));
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      }
    } catch (_) { /* ignore */ }
  }
  return {};
}

const runtime = readRuntimeConfig();

// Parse a .env file into a plain object. Minimal dotenv-compatible parser so we
// don't need a runtime dependency. Supports KEY=VALUE lines, optional quotes,
// `export ` prefixes, and `#` comments.
function parseEnvFile(filePath) {
  const out = {};
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (_) {
    return out;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.replace(/^export\s+/, "");
    const eq = withoutExport.indexOf("=");
    if (eq === -1) continue;
    const key = withoutExport.slice(0, eq).trim();
    if (!key) continue;
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// In the packaged app the Next server runs with cwd `resources/app`, but the
// .env file is shipped to `resources/.env` (extraResources), so Next's built-in
// .env auto-loading never finds it. Locate the .env ourselves so we can inject
// it into the spawned server's environment.
function loadServerEnv() {
  const candidates = [];
  if (!isDev) {
    candidates.push(path.join(path.dirname(app.getPath("exe")), ".env"));
    candidates.push(path.join(process.resourcesPath, ".env"));
    candidates.push(path.join(process.resourcesPath, "app", ".env"));
  }
  candidates.push(path.join(__dirname, "..", ".env"));
  for (const p of candidates) {
    if (fs.existsSync(p)) return parseEnvFile(p);
  }
  return {};
}

const REMOTE_URL = process.env.ELECTRON_REMOTE_URL || runtime.remoteUrl || "";
const DEV_URL = process.env.ELECTRON_DEV_URL || runtime.devUrl || "http://localhost:3000";
const STARTUP_PATH = process.env.ELECTRON_STARTUP_PATH || runtime.startupPath || "/kiosk";
const KIOSK_MODE = process.env.ELECTRON_KIOSK === "1" || runtime.kiosk === true;
const FULLSCREEN = process.env.ELECTRON_FULLSCREEN === "1" || runtime.fullscreen === true;
const PRINTER_NAME = process.env.PRINTER_NAME || runtime.printerName || undefined;
const SERVER_PORT = Number(process.env.PORT || runtime.port || 3000);
const ORG_NAME = process.env.QUEUE_ORG_NAME || runtime.orgName || "";
const USE_REMOTE = Boolean(REMOTE_URL);

let mainWindow;
let nextProcess;

function startNextServerIfNeeded() {
  if (isDev) return;
  if (USE_REMOTE) return; // No local server when loading a remote URL
  const nextBinary = path.join(process.resourcesPath, "app", "node_modules", "next", "dist", "bin", "next");
  const fileEnv = loadServerEnv();
  // Log the Next server's output next to the app so kiosk issues are diagnosable.
  let stdio = "ignore";
  try {
    const logPath = path.join(app.getPath("userData"), "next-server.log");
    const fd = fs.openSync(logPath, "a");
    stdio = ["ignore", fd, fd];
  } catch (_) { /* fall back to ignore */ }
  nextProcess = spawn(process.execPath, [nextBinary, "start", "-p", String(SERVER_PORT)], {
    cwd: path.join(process.resourcesPath, "app"),
    stdio,
    detached: false,
    env: {
      ...process.env,
      ...fileEnv,
      // Run Electron's bundled Node as a plain Node process for the Next server.
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(SERVER_PORT),
      // SQLite lives in the per-user app data dir so it survives app updates and
      // isn't wiped when the install folder is replaced.
      QUEUE_DB_PATH: path.join(app.getPath("userData"), "queue.db"),
      QUEUE_ORG_NAME: fileEnv.QUEUE_ORG_NAME || ORG_NAME,
    },
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    backgroundColor: "#F0FDFA",
    autoHideMenuBar: true,
    fullscreen: FULLSCREEN || KIOSK_MODE,
    kiosk: KIOSK_MODE,
    title: "Queuing System",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (KIOSK_MODE) {
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
  }

  const localBase = isDev ? DEV_URL : `http://localhost:${SERVER_PORT}`;
  const baseUrl = USE_REMOTE ? REMOTE_URL.replace(/\/$/, "") : localBase;
  const url = `${baseUrl}${STARTUP_PATH}`;

  // Host PC (running the local server): show the LAN URLs so staff can point
  // kiosk/counter/display devices on other PCs at this machine.
  if (!USE_REMOTE) {
    const lan = computeLanInfo(SERVER_PORT);
    if (lan.urls.length) {
      mainWindow.setTitle(`Queuing System — host at ${lan.urls[0]}`);
      if (!KIOSK_MODE) {
        mainWindow.webContents.once("did-finish-load", () => {
          dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "Queue server is running",
            message: "Other devices on this network can connect at:",
            detail: `${lan.urls.join("\n")}\n\nOpen one of these on a kiosk / counter / display device, then enter its pairing code.`,
            buttons: ["OK"],
            noLink: true,
          }).catch(() => {});
        });
      }
    }
  }

  const tryLoad = (attempt = 0) => {
    mainWindow.loadURL(url).catch((err) => {
      if (attempt < 30) {
        setTimeout(() => tryLoad(attempt + 1), 1000);
      } else if (!KIOSK_MODE) {
        dialog.showErrorBox("Cannot reach server", `${url}\n\n${err.message}`);
      }
    });
  };
  tryLoad();

  // Allow Ctrl+Shift+Q (or Cmd+Shift+Q) to exit kiosk mode for staff.
  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (KIOSK_MODE && input.shift && (input.control || input.meta) && input.key.toLowerCase() === "q") {
      app.quit();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startNextServerIfNeeded();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (nextProcess) {
    try { nextProcess.kill(); } catch (_) { /* ignore */ }
  }
  if (process.platform !== "darwin") app.quit();
});

// 80mm thermal roll, the standard for queue tickets.
const PAPER_WIDTH_MICRONS = 80000;
// Electron wants microns; the DOM measures in CSS px at 96dpi.
const MICRONS_PER_CSS_PX = 25400 / 96;
// Paper width in CSS px, so the hidden window lays the ticket out at exactly the
// width it will print at — otherwise the measured height is for a different
// line-wrap than the one that reaches the paper.
const PAPER_WIDTH_PX = Math.round(PAPER_WIDTH_MICRONS / MICRONS_PER_CSS_PX);
// A little slack past the last line: thermal cutters sit a few mm beyond the
// print head, and clipping the timestamp is worse than a thin blank strip.
const CUT_ALLOWANCE_MICRONS = 5000;

ipcMain.handle("queue:silent-print", async (_event, html) => {
  const printWindow = new BrowserWindow({
    width: PAPER_WIDTH_PX,
    height: 900,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Cut the paper where the words end. A fixed page height fed the full sheet
    // every time — roughly half a ticket of blank roll on every transaction.
    let pageHeight = 200000;
    try {
      const contentPx = await printWindow.webContents.executeJavaScript(
        "Math.ceil(document.documentElement.getBoundingClientRect().height)"
      );
      if (Number.isFinite(contentPx) && contentPx > 0) {
        pageHeight = Math.round(contentPx * MICRONS_PER_CSS_PX) + CUT_ALLOWANCE_MICRONS;
      }
    } catch (_) {
      // Measurement failed — fall back to the old fixed height rather than
      // risking a page too short to hold the ticket.
    }

    return await new Promise((resolve) => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: PRINTER_NAME,
          margins: { marginType: "none" },
          pageSize: { width: PAPER_WIDTH_MICRONS, height: pageHeight },
        },
        (success, failureReason) => {
          try { printWindow.close(); } catch (_) {}
          resolve({ success, failureReason: failureReason || null });
        }
      );
    });
  } catch (err) {
    try { printWindow.close(); } catch (_) {}
    return { success: false, failureReason: err.message };
  }
});

ipcMain.handle("queue:lan-info", () => computeLanInfo(SERVER_PORT));

ipcMain.handle("queue:list-printers", async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((p) => ({ name: p.name, isDefault: p.isDefault }));
  } catch (_) {
    return [];
  }
});
