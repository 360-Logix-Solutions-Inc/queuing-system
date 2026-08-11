let cachedConfig;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTicketHtml(ticket) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Queue Ticket</title>
        <style>
          /* Label stock is 3in ACROSS by 2in DOWN, text reading upright along
             the width. Fixed page, zero page margin: the label is pre-cut, so
             the layout has to fit rather than grow — overflow is not extra
             paper, it falls off the edge, and a size the driver rejects gets
             tiled across several labels. Sizes are tuned against the measured
             worst case; the page itself is set in electron/main.js. */
          @page { size: 76.2mm 50.8mm; margin: 0; }
          html, body { margin: 0; padding: 0; }
          body {
            font-family: Arial, sans-serif; text-align: center; color: #111827;
            width: 76.2mm; height: 50.8mm;
            padding: 2.5mm 3mm 2mm;
            box-sizing: border-box;
            display: flex; flex-direction: column; justify-content: center;
            overflow: hidden;
          }
          .org {
            font-size: 11px; font-weight: 800; line-height: 1.15;
            /* Long LGU names wrap; two lines is the budget. */
            max-height: 2.3em; overflow: hidden;
          }
          .service {
            font-size: 11px; line-height: 1.15; margin-top: 2px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .number { font-size: 40px; font-weight: 900; letter-spacing: .5px; margin: 3px 0 2px; }
          .priority { font-size: 12px; font-weight: 900; color: #DC2626; margin-bottom: 2px; }
          .name {
            font-size: 10px; margin-bottom: 1px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          /* Near-black, not grey: this prints on a low-resolution thermal head
             and the previous #374151 at 7px was already faint on screen. */
          .small { font-size: 8px; color: #1F2937; line-height: 1.2; margin-top: 3px; }
          .line { border-top: 1px dashed #6B7280; margin: 3px 0; }
        </style>
      </head>
      <body>
        <div class="org">${escapeHtml(ticket.orgName || "Queue System")}</div>
        <div class="line"></div>
        <div class="service">${escapeHtml(ticket.serviceName || "Service")}</div>
        <div class="number">${escapeHtml(ticket.queueNumber || "---")}</div>
        ${ticket.priorityType ? `<div class="priority">${escapeHtml(ticket.priorityType)}</div>` : ""}
        ${ticket.customerName ? `<div class="name">${escapeHtml(ticket.customerName)}</div>` : ""}
        <div class="line"></div>
        <div class="small">Please wait for your number to be called.</div>
        <div class="small">${new Date().toLocaleString()}</div>
      </body>
    </html>
  `;
}

export async function getConfig() {
  if (cachedConfig) return cachedConfig;
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load app configuration.");
  cachedConfig = await response.json();
  return cachedConfig;
}

export async function printTicket(ticket) {
  // Electron path — true silent printing via main process IPC. No browser
  // dialog, no kiosk-printing flag dependency, prints directly to default
  // printer.
  if (typeof window !== "undefined" && window.electronQueue?.silentPrint) {
    try {
      const result = await window.electronQueue.silentPrint(buildTicketHtml(ticket));
      return result || { success: true, failureReason: null };
    } catch (err) {
      return { success: false, failureReason: err.message };
    }
  }

  // Web fallback — iframe + window.print(). Silent only when the browser was
  // launched with --kiosk-printing (Edge/Chrome).
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      document.body.appendChild(iframe);

      const cleanup = () => {
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch (_) { /* ignore */ }
        }, 1500);
      };

      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          resolve({ success: true, failureReason: null });
        } catch (err) {
          resolve({ success: false, failureReason: err.message });
        } finally {
          cleanup();
        }
      };

      iframe.srcdoc = buildTicketHtml(ticket);
    } catch (err) {
      resolve({ success: false, failureReason: err.message });
    }
  });
}

export function openDisplay() {
  window.open("/display", "_blank");
}

export function openCounter() {
  window.open("/counter", "_blank");
}
