"use client";

import { useEffect, useState } from "react";
import {
  createTicket,
  getClientInfo,
  initFirebase,
  listenServices,
  resolvePairingCode,
  SERVICES,
} from "../lib/firebaseClient";
import { printTicket } from "../lib/queueApp";
import { notifyTicketSms } from "../lib/smsClient";

function formatStartTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatStartDate(d) {
  return d.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function priorityLabel(type) {
  if (type === "SC") return "Senior Citizen";
  if (type === "PWD") return "PWD";
  if (type === "PG") return "Pregnant";
  return "";
}

export default function KioskApp() {
  const [orgName, setOrgName] = useState("");
  const [logo, setLogo] = useState(null);
  const [kioskBg, setKioskBg] = useState(null);
  const [clientId, setClientId] = useState("default");
  const [device, setDevice] = useState(null);
  const [allServices, setAllServices] = useState(SERVICES);
  const [step, setStep] = useState("start");
  const [selectedService, setSelectedService] = useState(null);
  const [priorityType, setPriorityType] = useState(null);
  const [lastTicket, setLastTicket] = useState(null);
  const [now, setNow] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [setupError, setSetupError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe;
    const params = new URLSearchParams(window.location.search);
    let pairCode = params.get("pair");
    if (!pairCode) {
      try { pairCode = window.localStorage.getItem("queue_kiosk_pair") || null; } catch (_) { pairCode = null; }
    }
    let clientFromUrl = params.get("client");
    if (!clientFromUrl && !pairCode) {
      try { clientFromUrl = window.localStorage.getItem("queue_kiosk_client") || null; } catch (_) { clientFromUrl = null; }
    }

    async function boot() {
      const paired = pairCode ? await resolvePairingCode(pairCode) : null;
      if (paired) {
        try { window.localStorage.setItem("queue_kiosk_pair", paired.code); } catch (_) {}
      } else if (pairCode && params.get("pair")) {
        try { window.localStorage.removeItem("queue_kiosk_pair"); } catch (_) {}
      }
      if (!paired && clientFromUrl) {
        try { window.localStorage.setItem("queue_kiosk_client", clientFromUrl); } catch (_) {}
      }
      if (params.has("pair") || params.has("client")) {
        window.history.replaceState({}, "", window.location.pathname);
      }
      const nextClientId = paired?.clientId || clientFromUrl || "default";
      if (!cancelled) {
        setClientId(nextClientId);
        setDevice(paired);
      }
      const { appConfig } = await initFirebase(nextClientId);
      if (cancelled) return;
      const clientInfo = await getClientInfo(nextClientId).catch(() => null);
      if (cancelled) return;
      setOrgName(clientInfo?.name || paired?.clientName || appConfig.orgName || "");
      setLogo(clientInfo?.logo || null);
      setKioskBg(clientInfo?.kioskBg || null);
      unsubscribe = listenServices(nextClientId, setAllServices);
    }

    boot().catch((err) => {
      if (!cancelled) setSetupError(err.message);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const allowedServiceIds = Array.isArray(device?.serviceIds) ? device.serviceIds : [];
  const services = allowedServiceIds.length
    ? allServices.filter((service) => allowedServiceIds.includes(service.id))
    : allServices;

  useEffect(() => {
    if (step !== "start") return undefined;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step !== "done") return undefined;
    const timer = setTimeout(resetFlow, 10000);
    return () => clearTimeout(timer);
  }, [step]);

  function selectService(service) {
    setSelectedService(service);
    setPriorityType(null);
    setCustomerName("");
    setPhone("");
    setConsent(false);
    setShowConsent(false);
    setMessage("");
    setStep("details");
  }

  // Gate submission on Data Privacy Act consent ONLY when the customer entered a
  // name or phone. Blank fields = nothing to protect, so no overlay — they fall
  // in line straight away.
  function handleFallInLine() {
    const hasPersonalInfo = Boolean(customerName.trim() || phone.trim());
    if (hasPersonalInfo && !consent) {
      setShowConsent(true);
      return;
    }
    submitTicket();
  }

  function acceptConsent() {
    setConsent(true);
    setShowConsent(false);
    submitTicket();
  }

  async function submitTicket() {
    setSubmitting(true);
    setMessage("");

    try {
      const ticket = await createTicket({
        clientId,
        serviceId: selectedService.id,
        customerName,
        phone,
        priorityType,
      });

      // Fire-and-forget confirmation SMS (skipped server-side if no phone/key).
      notifyTicketSms({
        type: "confirm",
        clientId,
        name: ticket.customerName,
        phone: ticket.phone,
        queueNumber: ticket.queueNumber,
        serviceName: ticket.serviceName,
        orgName: ticket.orgName || orgName,
      });

      let printResult = { success: true, failureReason: null };
      if (device?.autoPrint !== false) {
        try {
          printResult = await printTicket(ticket);
        } catch (printErr) {
          printResult = { success: false, failureReason: printErr.message };
        }
      }

      setLastTicket({
        ...ticket,
        printSuccess: printResult.success !== false,
        printError: printResult.failureReason || null,
      });
      setStep("done");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetFlow() {
    setStep("start");
    setSelectedService(null);
    setPriorityType(null);
    setLastTicket(null);
    setCustomerName("");
    setPhone("");
    setConsent(false);
    setShowConsent(false);
    setMessage("");
  }

  if (setupError) {
    return (
      <div className="page">
        <div className="notice error">Firebase setup error: {setupError}</div>
      </div>
    );
  }

  if (step === "services") {
    return (
      <main className="page">
        <div className="topbar">
          <button className="btn btn-back" onClick={() => setStep("start")}>
            <span className="back-icon" aria-hidden="true">←</span>
            <span>Back</span>
          </button>
          <div className="brand">
            {logo ? <img src={logo} alt="" style={{ height: "1.5em", width: "1.5em", objectFit: "contain", borderRadius: 4 }} /> : <span className="brand-dot" />}
            <span>{orgName || "Queuing System"}</span>
          </div>
        </div>
        <div className="kiosk-services">
          <h1 className="kiosk-heading">Select a service</h1>
          <p className="kiosk-sub">Tap any service to begin your transaction.</p>
          <div className="service-grid">
            {services.map((service) => (
              <button
                className="service-card"
                key={service.id}
                onClick={() => selectService(service)}
              >
                <div className="service-icon">{service.icon}</div>
                <div className="service-title">{service.name}</div>
                <div className="service-prefix">Queue - {service.prefix}</div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (step === "details" && selectedService) {
    return (
      <main className="page">
        <div className="topbar">
          <button className="btn btn-back" onClick={() => setStep("services")}>
            <span className="back-icon" aria-hidden="true">←</span>
            <span>Back</span>
          </button>
          <div className="brand">
            {logo ? <img src={logo} alt="" style={{ height: "1.5em", width: "1.5em", objectFit: "contain", borderRadius: 4 }} /> : <span className="brand-dot" />}
            <span>{orgName || "Queuing System"}</span>
          </div>
        </div>
        <div className="form-wrap">
          <div className="panel">
            <div className="ticket-preview">
              <div className="ticket-number ticket-number--service">{selectedService.name}</div>
              <div className="ticket-preview-hint">Your queue number is generated when you tap Fall in Line.</div>
            </div>
            <div className="field">
              <label htmlFor="nameInput">Name <span className="opt">(optional)</span></label>
              <input
                id="nameInput"
                placeholder="Enter your name"
                autoComplete="off"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="phoneInput">Phone Number <span className="opt">(optional)</span></label>
              <input
                id="phoneInput"
                type="tel"
                placeholder="09xxxxxxxxx"
                autoComplete="off"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={11}
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="section-label">Priority Lane</div>
            <div className="priority-row">
              <button
                className={`priority-option ${priorityType === null ? "active" : ""}`}
                onClick={() => setPriorityType(null)}
              >
                Regular
              </button>
              <button
                className={`priority-option ${priorityType === "PWD" ? "active" : ""}`}
                onClick={() => setPriorityType("PWD")}
              >
                PWD
              </button>
              <button
                className={`priority-option ${priorityType === "SC" ? "active" : ""}`}
                onClick={() => setPriorityType("SC")}
              >
                Senior
              </button>
              <button
                className={`priority-option ${priorityType === "PG" ? "active" : ""}`}
                onClick={() => setPriorityType("PG")}
              >
                Pregnant
              </button>
            </div>
            <button
              className="tap-button full"
              disabled={submitting}
              onClick={handleFallInLine}
            >
              {submitting ? "Please wait..." : "Fall in Line"}
            </button>
            {message ? <div className="notice error">{message}</div> : null}
          </div>
        </div>

        {showConsent ? (
          <div className="consent-overlay" role="dialog" aria-modal="true" aria-labelledby="dpaTitle">
            <div className="consent-modal">
              <div className="consent-modal-icon" aria-hidden="true">🔒</div>
              <h2 id="dpaTitle" className="consent-modal-title">Data Privacy Notice</h2>
              <p className="consent-modal-text">
                By providing your name and/or phone number, you consent to the collection and
                processing of your personal information in compliance with the
                <strong> Data Privacy Act of 2012 (RA 10173)</strong>. Your information will be
                used <strong>only for queue management and SMS notifications</strong>, and will
                not be shared with third parties.
              </p>
              <div className="consent-modal-actions">
                <button
                  className="btn consent-decline"
                  onClick={() => setShowConsent(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  className="tap-button consent-accept"
                  onClick={acceptConsent}
                  disabled={submitting}
                >
                  {submitting ? "Please wait..." : "I Agree & Continue"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  if (step === "done" && lastTicket) {
    return (
      <main className="page">
        <div className="done-wrap">
          <div className="done-card">
            <div className="done-label">Your queue number</div>
            <div className="done-number">{lastTicket.queueNumber}</div>
            <div className="done-service">{lastTicket.serviceName}</div>
            {lastTicket.priorityType ? (
              <div className="done-priority">
                {priorityLabel(lastTicket.priorityType)} - Priority Lane
              </div>
            ) : null}
            <p className="done-hint">Please wait for your number to be called.</p>
            <button className="tap-button full" onClick={resetFlow}>New Transaction</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <section className="kiosk-start">
      <div className="kiosk-bg" aria-hidden="true" style={kioskBg ? { backgroundImage: `url(${kioskBg})` } : undefined} />
      <div className="kiosk-overlay" aria-hidden="true" />

      <header className="kiosk-top">
        <div className="kiosk-brand-mark">
          <span className="brand-dot" />
          <span>{orgName || "Queuing System"}</span>
        </div>
        <div className="kiosk-clock" suppressHydrationWarning>
          <div className="kiosk-time tabular">{now ? formatStartTime(now) : "--:--"}</div>
          <div className="kiosk-date">{now ? formatStartDate(now) : ""}</div>
        </div>
      </header>

      <div className="kiosk-center">
        {logo ? <img src={logo} alt="" className="kiosk-seal" /> : null}
        <div className="kiosk-greeting">Mabuhay!</div>
        <div className="kiosk-greeting-sub">Welcome / Maligayang Pagdating</div>
        <button className="tap-button start-only breathing" onClick={() => setStep("services")}>
          <span>Touch to Start</span>
        </button>
        <div className="kiosk-greeting-hint">I-tap ang button upang magsimula</div>
      </div>

    </section>
  );
}
