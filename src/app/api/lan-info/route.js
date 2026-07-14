// Reports the host PC's LAN IPv4 addresses so the admin can tell client devices
// (kiosk/counter/display on other PCs) which URL to open for pairing.
import { NextResponse } from "next/server";
import os from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const port = Number(process.env.PORT) || 3000;
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  return NextResponse.json({
    ips,
    port,
    urls: ips.map((ip) => `http://${ip}:${port}`),
    hostname: os.hostname(),
  });
}
