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
import { flushSmsQueue, notifyTicketSms } from "../lib/smsClient";
import KioskAccessibilityBar from "./KioskAccessibilityBar";
import OnScreenKeyboard from "./OnScreenKeyboard";
import {
  DEFAULT_LANG,
  KIOSK_LANGUAGES,
  ZOOM_LEVELS,
  kioskT,
  languageLocale,
  serviceName,
  speechLocale,
} from "../lib/kioskI18n";
import { announce, initSpeech, spellQueueNumber, stopSpeaking } from "../lib/kioskSpeech";

const LANG_KEY = "queue_kiosk_lang";
const ZOOM_KEY = "queue_kiosk_zoom";
const SPEECH_KEY = "queue_kiosk_speech";

// How long non-default accessibility settings survive on the start screen with
// nothing happening. Long enough to read the screen in your own language;
// short enough that the next person is not handed someone else's setup.
const IDLE_RESET_MS = 90_000;

function formatStartTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatStartDate(d, locale) {
  return d.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function priorityLabel(type, t) {
  if (type === "SC") return t("seniorCitizen");
  if (type === "PWD") return t("pwd");
  if (type === "PG") return t("pregnant");
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
  const [sendSmsAlerts, setSendSmsAlerts] = useState(false);
  const [consent, setConsent] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [setupError, setSetupError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lang, setLang] = useState(DEFAULT_LANG);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [speechOn, setSpeechOn] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  // Which field the on-screen keyboard is editing. A wall-mounted kiosk has no
  // physical keyboard, so without this the name and phone cannot be filled in.
  const [activeField, setActiveField] = useState(null);
  const [online, setOnline] = useState(true);

  const t = (key) => kioskT(lang, key);

  // Restore accessibility prefs after mount — reading storage during render
  // would desync the server-rendered markup.
  useEffect(() => {
    try {
      const savedLang = window.localStorage.getItem(LANG_KEY);
      if (savedLang && KIOSK_LANGUAGES.some((item) => item.code === savedLang)) {
        setLang(savedLang);
      }
      const savedZoom = Number(window.localStorage.getItem(ZOOM_KEY));
      if (Number.isInteger(savedZoom) && savedZoom >= 0 && savedZoom < ZOOM_LEVELS.length) {
        setZoomIndex(savedZoom);
      }
      if (window.localStorage.getItem(SPEECH_KEY) === "1") setSpeechOn(true);
    } catch (_) {}

    // Gate on a voice being genuinely available, not on the API existing —
    // Electron exposes speechSynthesis with zero voices, which would otherwise
    // put a button on the kiosk that stays silent when pressed.
    let cancelled = false;
    initSpeech().then((available) => {
      if (cancelled) return;
      setSpeechSupported(available);
      if (!available) setSpeechOn(false);
    });

    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // The keyboard belongs to the details form only; leaving that screen with it
  // still open would leave it floating over the next one.
  useEffect(() => {
    if (step !== "details") setActiveField(null);
  }, [step]);

  // resetFlow covers the customer who finishes. This covers the one who picks a
  // language, thinks better of it and walks off without starting — otherwise
  // their settings sit there waiting for whoever comes next. The timer restarts
  // on every settings change, which is the only activity this screen has.
  useEffect(() => {
    if (step !== "start") return undefined;
    const isDefault = lang === DEFAULT_LANG && zoomIndex === 0 && !speechOn;
    if (isDefault) return undefined;
    const timer = setTimeout(resetAccessibility, IDLE_RESET_MS);
    return () => clearTimeout(timer);
  }, [step, lang, zoomIndex, speechOn]);

  // Offline state. Firestore keeps serving from its local cache and queues
  // writes, so this is information, not an error — the queue keeps running.
  useEffect(() => {
    setOnline(navigator.onLine);
    if (navigator.onLine) flushSmsQueue();
    const up = () => { setOnline(true); flushSmsQueue(); };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const offlinePill = online ? null : (
    <div className="kiosk-offline" role="status" aria-live="polite">
      <span className="kiosk-offline-dot" aria-hidden="true" />
      <span className="kiosk-offline-text">
        <strong>{t("offline")}</strong>
        <span>{t("offlineHint")}</span>
      </span>
    </div>
  );

  function changeLang(next) {
    setLang(next);
    try { window.localStorage.setItem(LANG_KEY, next); } catch (_) {}
  }

  function changeZoom(next) {
    const clamped = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, next));
    setZoomIndex(clamped);
    try { window.localStorage.setItem(ZOOM_KEY, String(clamped)); } catch (_) {}
  }

  function toggleSpeech() {
    const next = !speechOn;
    setSpeechOn(next);
    if (!next) stopSpeaking();
    try { window.localStorage.setItem(SPEECH_KEY, next ? "1" : "0"); } catch (_) {}
  }

  // What read-aloud narrates for the screen currently on show. Kept in one
  // place so the announcement always matches what the customer is looking at.
  // A ticket stores the service name as it stood when issued. Re-resolve it
  // against the live list so the confirmation screen follows the language the
  // customer picked, rather than freezing whatever the admin typed.
  function ticketServiceName() {
    if (!lastTicket) return "";
    const match = allServices.find((item) => item.id === lastTicket.serviceId);
    return match ? serviceName(match, lang) : lastTicket.serviceName || "";
  }

  // Service names come from Firestore, so they can never be pre-recorded —
  // they are marked optional and dropped when a recorded clip set is in use.
  function screenScript() {
    if (step === "services") {
      return [
        { key: "servicesTitle", text: t("servicesTitle") },
        { key: "servicesSub", text: t("servicesSub") },
      ];
    }
    if (step === "details" && selectedService) {
      return [
        { text: serviceName(selectedService, lang), optional: true },
        { key: "ticketPreviewHint", text: t("ticketPreviewHint") },
        { key: "fallInLine", text: t("fallInLine") },
      ];
    }
    if (step === "done" && lastTicket) {
      return [
        { key: "yourNumber", text: t("yourNumber") },
        { chars: lastTicket.queueNumber, text: spellQueueNumber(lastTicket.queueNumber) },
        { text: ticketServiceName(), optional: true },
        { key: "doneHint", text: t("doneHint") },
      ];
    }
    return [
      { key: "greeting", text: t("greeting") },
      { key: "greetingSub", text: t("greetingSub") },
      { key: "startHint", text: t("startHint") },
    ];
  }

  function speakScreen() {
    announce(screenScript(), lang, speechLocale(lang));
  }

  // Re-announce whenever the screen or the language changes. `lastTicket` is in
  // the deps so a freshly issued number is read out, not the previous one.
  useEffect(() => {
    if (!speechOn || !speechSupported) return;
    speakScreen();
  }, [speechOn, speechSupported, step, lang, selectedService?.id, lastTicket?.queueNumber]);

  // Every kiosk screen renders through here: content scales, the control bar
  // stays fixed and unscaled so it is reachable at any text size.
  // Digits only for the phone field, matching the input's own filtering.
  function typeIntoField(next) {
    if (activeField === "name") setCustomerName(next);
    else if (activeField === "phone") setPhone(next.replace(/\D/g, ""));
  }

  function withKioskShell(content) {
    return (
      <div
        className={`kiosk-root ${activeField ? "keyboard-open" : ""}`}
        style={{
          "--kiosk-zoom": ZOOM_LEVELS[zoomIndex],
          // The control bar grows too — someone who needs 150% text has to be
          // able to read it — but capped, so it never swallows the screen.
          "--kiosk-ui-zoom": Math.min(ZOOM_LEVELS[zoomIndex], 1.25),
        }}
      >
        <div className="kiosk-zoom-area">{content}</div>
        <KioskAccessibilityBar
          lang={lang}
          onLangChange={changeLang}
          zoomIndex={zoomIndex}
          onZoomChange={changeZoom}
          speechSupported={speechSupported}
          speechOn={speechOn}
          onSpeechToggle={toggleSpeech}
          onSpeakAgain={speakScreen}
        />
        {/* Rendered here, outside .kiosk-zoom-area: a position:fixed element
            inside a zoomed subtree resolves against the zoomed viewport and
            lands in the wrong place. */}
        {activeField ? (
          <OnScreenKeyboard
            lang={lang}
            layout={activeField === "phone" ? "numeric" : "name"}
            value={activeField === "phone" ? phone : customerName}
            maxLength={activeField === "phone" ? 11 : 60}
            onChange={typeIntoField}
            onClose={() => setActiveField(null)}
          />
        ) : null}
      </div>
    );
  }

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
    setSendSmsAlerts(false);
    setConsent(false);
    setShowConsent(false);
    setMessage("");
    setStep("details");
  }

  // Gate submission on Data Privacy Act consent ONLY when the customer entered a
  // name or phone. Blank fields = nothing to protect, so no overlay — they fall
  // in line straight away.
  function handleFallInLine() {
    if (sendSmsAlerts && !phone.trim()) {
      setMessage(t("phoneRequired"));
      return;
    }
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
        phone: sendSmsAlerts ? phone : "",
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

  // Hands the terminal back in its default state. Accessibility settings belong
  // to the person standing there, not to the machine: leaving Ini at 150% for
  // the next customer means they walk up to a screen they cannot read. The
  // settings still persist DURING a transaction, so a mid-flow reload keeps
  // them — they are only dropped once that customer is finished.
  function resetAccessibility() {
    setLang(DEFAULT_LANG);
    setZoomIndex(0);
    setSpeechOn(false);
    stopSpeaking();
    try {
      window.localStorage.removeItem(LANG_KEY);
      window.localStorage.removeItem(ZOOM_KEY);
      window.localStorage.removeItem(SPEECH_KEY);
    } catch (_) {}
  }

  function resetFlow() {
    setStep("start");
    setSelectedService(null);
    setPriorityType(null);
    setLastTicket(null);
    setCustomerName("");
    setPhone("");
    setSendSmsAlerts(false);
    setConsent(false);
    setShowConsent(false);
    setMessage("");
    resetAccessibility();
  }

  if (setupError) {
    return (
      <div className="page">
        <div className="notice error">Firebase setup error: {setupError}</div>
      </div>
    );
  }

  if (step === "services") {
    return withKioskShell(
      <main className="page">
        <div className="topbar">
          <button className="btn btn-back" onClick={() => setStep("start")}>
            <span className="back-icon" aria-hidden="true">←</span>
            <span>{t("back")}</span>
          </button>
          <div className="brand">
            {logo ? <img src={logo} alt="" style={{ height: "1.5em", width: "1.5em", objectFit: "contain", borderRadius: 4 }} /> : <span className="brand-dot" />}
            <span>{orgName || "Queuing System"}</span>
          </div>
          {offlinePill}
        </div>
        <div className="kiosk-services">
          <h1 className="kiosk-heading">{t("servicesTitle")}</h1>
          <p className="kiosk-sub">{t("servicesSub")}</p>
          <div className="service-grid">
            {services.map((service) => (
              <button
                className="service-card"
                key={service.id}
                aria-label={`${serviceName(service, lang)} — ${t("queue")} ${service.prefix}`}
                onClick={() => selectService(service)}
              >
                <div className="service-icon" aria-hidden="true">{service.icon}</div>
                <div className="service-title">{serviceName(service, lang)}</div>
                <div className="service-prefix">{t("queue")} - {service.prefix}</div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (step === "details" && selectedService) {
    return withKioskShell(
      <main className="page">
        <div className="topbar">
          <button className="btn btn-back" onClick={() => setStep("services")}>
            <span className="back-icon" aria-hidden="true">←</span>
            <span>{t("back")}</span>
          </button>
          <div className="brand">
            {logo ? <img src={logo} alt="" style={{ height: "1.5em", width: "1.5em", objectFit: "contain", borderRadius: 4 }} /> : <span className="brand-dot" />}
            <span>{orgName || "Queuing System"}</span>
          </div>
          {offlinePill}
        </div>
        <div className="form-wrap">
          <div className="panel">
            <div className="ticket-preview">
              <div className="ticket-number ticket-number--service">{serviceName(selectedService, lang)}</div>
              <div className="ticket-preview-hint">{t("ticketPreviewHint")}</div>
            </div>
            <div className="field">
              <label htmlFor="nameInput">{t("nameLabel")} <span className="opt">{t("optional")}</span></label>
              <input
                id="nameInput"
                className={activeField === "name" ? "field-active" : ""}
                placeholder={t("namePlaceholder")}
                autoComplete="off"
                // inputMode="none" keeps a tablet's own keyboard from covering
                // ours; the on-screen one is the only way to type here.
                inputMode="none"
                value={customerName}
                onFocus={() => setActiveField("name")}
                onClick={() => setActiveField("name")}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="phoneInput">{t("phoneLabel")} <span className="opt">{t("optional")}</span></label>
              <input
                id="phoneInput"
                className={activeField === "phone" ? "field-active" : ""}
                type="tel"
                placeholder="09xxxxxxxxx"
                autoComplete="off"
                inputMode="none"
                pattern="[0-9]*"
                maxLength={11}
                value={phone}
                onFocus={() => setActiveField("phone")}
                onClick={() => setActiveField("phone")}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
              />
            </div>
            <label className="consent-row" htmlFor="sendSmsAlerts">
              <input
                id="sendSmsAlerts"
                type="checkbox"
                checked={sendSmsAlerts}
                onChange={(event) => setSendSmsAlerts(event.target.checked)}
              />
              <span className="consent-text">
                <strong>{t("smsTitle")}</strong><br />
                {t("smsDesc")}
                {/* Offline the send cannot leave the building, so say so rather
                    than take the tick and quietly deliver nothing. It is
                    queued and retried, not dropped. */}
                {!online && sendSmsAlerts ? (
                  <>
                    <br />
                    <em className="sms-queued-note">{t("smsQueued")}</em>
                  </>
                ) : null}
              </span>
            </label>
            <div className="section-label" id="priorityLabel">{t("priorityLane")}</div>
            <div className="priority-row" role="group" aria-labelledby="priorityLabel">
              <button
                className={`priority-option ${priorityType === null ? "active" : ""}`}
                aria-pressed={priorityType === null}
                onClick={() => setPriorityType(null)}
              >
                {t("regular")}
              </button>
              <button
                className={`priority-option ${priorityType === "PWD" ? "active" : ""}`}
                aria-pressed={priorityType === "PWD"}
                onClick={() => setPriorityType("PWD")}
              >
                {t("pwd")}
              </button>
              <button
                className={`priority-option ${priorityType === "SC" ? "active" : ""}`}
                aria-pressed={priorityType === "SC"}
                onClick={() => setPriorityType("SC")}
              >
                {t("senior")}
              </button>
              <button
                className={`priority-option ${priorityType === "PG" ? "active" : ""}`}
                aria-pressed={priorityType === "PG"}
                onClick={() => setPriorityType("PG")}
              >
                {t("pregnant")}
              </button>
            </div>
            <button
              className="tap-button full"
              disabled={submitting}
              onClick={handleFallInLine}
            >
              {submitting ? t("pleaseWait") : t("fallInLine")}
            </button>
            {message ? <div className="notice error" role="alert">{message}</div> : null}
          </div>
        </div>

        {showConsent ? (
          <div className="consent-overlay" role="dialog" aria-modal="true" aria-labelledby="dpaTitle">
            <div className="consent-modal">
              <div className="consent-modal-icon" aria-hidden="true">🔒</div>
              <h2 id="dpaTitle" className="consent-modal-title">{t("consentTitle")}</h2>
              <p className="consent-modal-text">
                {t("consentText1")} <strong>{t("consentLaw")}</strong>{t("consentText2")}{" "}
                <strong>{t("consentUse")}</strong>{t("consentText3")}
              </p>
              <div className="consent-modal-actions">
                <button
                  className="btn consent-decline"
                  onClick={() => setShowConsent(false)}
                  disabled={submitting}
                >
                  {t("cancel")}
                </button>
                <button
                  className="tap-button consent-accept"
                  onClick={acceptConsent}
                  disabled={submitting}
                >
                  {submitting ? t("pleaseWait") : t("agree")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  if (step === "done" && lastTicket) {
    return withKioskShell(
      <main className="page">
        <div className="done-wrap">
          <div className="done-card" role="status" aria-live="polite">
            <div className="done-label">{t("yourNumber")}</div>
            <div className="done-number">{lastTicket.queueNumber}</div>
            <div className="done-service">{ticketServiceName()}</div>
            {lastTicket.priorityType ? (
              <div className="done-priority">
                {priorityLabel(lastTicket.priorityType, t)} - {t("priorityLane")}
              </div>
            ) : null}
            <p className="done-hint">{t("doneHint")}</p>
            <button className="tap-button full" onClick={resetFlow}>{t("newTransaction")}</button>
          </div>
        </div>
      </main>
    );
  }

  return withKioskShell(
    <section className="kiosk-start">
      <div className="kiosk-bg" aria-hidden="true" style={kioskBg ? { backgroundImage: `url(${kioskBg})` } : undefined} />
      <div className="kiosk-overlay" aria-hidden="true" />

      <header className="kiosk-top">
        <div className="kiosk-brand-mark">
          <span className="brand-dot" aria-hidden="true" />
          <span>{orgName || "Queuing System"}</span>
        </div>
        <div className="kiosk-start-status">
          {offlinePill}
          <div className="kiosk-clock" suppressHydrationWarning>
            <div className="kiosk-time tabular">{now ? formatStartTime(now) : "--:--"}</div>
            <div className="kiosk-date">{now ? formatStartDate(now, languageLocale(lang)) : ""}</div>
          </div>
        </div>
      </header>

      <div className="kiosk-center">
        {logo ? <img src={logo} alt="" className="kiosk-seal" /> : null}
        <h1 className="kiosk-greeting">{t("greeting")}</h1>
        <div className="kiosk-greeting-sub">{t("greetingSub")}</div>
        <button
          className="tap-button start-only breathing"
          onClick={() => setStep("services")}
          aria-label={t("startButton")}
        >
          <span>{t("startButton")}</span>
        </button>
        <div className="kiosk-greeting-hint">{t("startHint")}</div>
      </div>

    </section>
  );
}
