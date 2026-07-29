"use client";
// Offline indicator for the Firebase offline-ready build. Firestore keeps working
// from its local cache when the internet drops (reads from cache, writes queue and
// auto-sync on reconnect), so this bar just informs staff/customers that changes
// will sync once the connection returns — it does not block anything.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function ConnectionBanner() {
  const [online, setOnline] = useState(true);
  // The kiosk shows its own indicator, in the customer's chosen language and
  // inside its own chrome. Two banners would collide and say the same thing.
  const pathname = usePathname();

  useEffect(() => {
    // Initialize from the real state (SSR renders online to avoid a flash).
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online || pathname?.startsWith("/kiosk")) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        background: "#B45309",
        color: "#fff",
        textAlign: "center",
        padding: "10px 16px",
        fontSize: "16px",
        fontWeight: 700,
        letterSpacing: "0.2px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}
    >
      Offline mode — the queue still works; changes will sync when the internet returns.
      <span style={{ display: "block", fontSize: "12px", fontWeight: 500, opacity: 0.9 }}>
        Offline — gumagana pa rin ang pila; mag-sisync ang mga pagbabago kapag bumalik ang internet.
      </span>
    </div>
  );
}
