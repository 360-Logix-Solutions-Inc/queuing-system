"use client";

import { useState } from "react";
import { KIOSK_LANGUAGES, ZOOM_LEVELS, kioskT, languageInfo } from "../lib/kioskI18n";

// Always-on kiosk control strip: language, text size, read-aloud. It lives
// OUTSIDE the zoomed area so it keeps a constant, reachable size at every zoom
// level — a Senior who bumps text to 150% must still be able to hit these.
export default function KioskAccessibilityBar({
  lang,
  onLangChange,
  zoomIndex,
  onZoomChange,
  speechSupported,
  speechOn,
  onSpeechToggle,
  onSpeakAgain,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const t = (key) => kioskT(lang, key);
  const current = languageInfo(lang);
  const atMin = zoomIndex <= 0;
  const atMax = zoomIndex >= ZOOM_LEVELS.length - 1;
  const percent = Math.round(ZOOM_LEVELS[zoomIndex] * 100);

  function chooseLang(code) {
    onLangChange(code);
    setPickerOpen(false);
  }

  return (
    <>
      <div className="a11y-bar" role="region" aria-label={t("accessibility")}>
        <button
          type="button"
          className="a11y-lang-button"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          aria-label={`${t("language")}: ${current.label}. ${t("chooseLanguage")}`}
        >
          <span className="a11y-icon" aria-hidden="true">🌐</span>
          <span className="a11y-lang-native" lang={current.code}>{current.native}</span>
        </button>

        <span className="a11y-divider" aria-hidden="true" />

        <div className="a11y-group">
          {/* No visible label: A− / % / A+ reads on its own, and the extra words
              were what pushed the bar into a ragged second row at large sizes. */}
          <div className="a11y-seg" role="group" aria-label={t("textSize")} title={t("textSize")}>
            <button
              type="button"
              className="a11y-btn"
              onClick={() => onZoomChange(zoomIndex - 1)}
              disabled={atMin}
              aria-label={t("decreaseText")}
            >
              A<span className="a11y-sign a11y-sign--small" aria-hidden="true">−</span>
            </button>
            <span className="a11y-zoom-value tabular" aria-live="polite" aria-atomic="true">
              {percent}%
            </span>
            <button
              type="button"
              className="a11y-btn"
              onClick={() => onZoomChange(zoomIndex + 1)}
              disabled={atMax}
              aria-label={t("increaseText")}
            >
              A<span className="a11y-sign" aria-hidden="true">+</span>
            </button>
          </div>
          {zoomIndex > 0 ? (
            <button
              type="button"
              className="a11y-reset"
              onClick={() => onZoomChange(0)}
              aria-label={t("resetText")}
            >
              {t("reset")}
            </button>
          ) : null}
        </div>

        {speechSupported ? (
          <>
            <span className="a11y-divider" aria-hidden="true" />
            <div className="a11y-group">
              <button
                type="button"
                className="a11y-btn a11y-btn--wide"
                aria-pressed={speechOn}
                onClick={onSpeechToggle}
                aria-label={t("readAloud")}
              >
                <span className="a11y-icon" aria-hidden="true">{speechOn ? "🔊" : "🔈"}</span>
                <span>{t("readAloud")}</span>
              </button>
              {speechOn ? (
                <button
                  type="button"
                  className="a11y-reset"
                  onClick={onSpeakAgain}
                  aria-label={t("speakAgain")}
                >
                  ↻
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {pickerOpen ? (
        <div
          className="lang-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="langPickerTitle"
        >
          <div className="lang-modal">
            <h2 id="langPickerTitle" className="lang-modal-title">{t("chooseLanguage")}</h2>
            {/* One flat grid: six local languages need no grouping. */}
            <div className="lang-grid">
              {KIOSK_LANGUAGES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className={`lang-card ${lang === item.code ? "active" : ""}`}
                  lang={item.code}
                  aria-pressed={lang === item.code}
                  onClick={() => chooseLang(item.code)}
                >
                  <span className="lang-card-native">{item.native}</span>
                  <span className="lang-card-label">{item.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn lang-close"
              onClick={() => setPickerOpen(false)}
            >
              {t("close")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
