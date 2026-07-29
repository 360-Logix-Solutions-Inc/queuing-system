"use client";

import { useState } from "react";
import { kioskT } from "../lib/kioskI18n";

// On-screen keyboard for touch terminals with no physical keyboard — the kiosk
// form and the staff login both need one.
//
// Layouts:
//   "numeric"  big keypad; the phone field takes digits only
//   "name"     letters, shift starts ON — names are typed in caps on tickets
//   "text"     letters + digits + @ . _ - , shift starts OFF (email, password)
//
// Case matters here: a password keyboard that silently lower-cases everything
// locks people out of their own account, so shift is a real, visible toggle.

const ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const NUMBER_ROW = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const SYMBOLS = ["@", ".", "_", "-"];

const DIGITS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

export default function OnScreenKeyboard({
  layout = "text",
  value = "",
  onChange,
  onClose,
  onSubmit,
  lang = "en",
  maxLength,
  mask = false,
}) {
  const t = (key) => kioskT(lang, key);
  const numeric = layout === "numeric";
  const [shift, setShift] = useState(layout === "name");

  function type(char) {
    if (maxLength && value.length >= maxLength) return;
    onChange(value + char);
  }

  function backspace() {
    onChange(value.slice(0, -1));
  }

  // Real <button>s, so the keyboard is reachable by the keyboard and switch
  // users the rest of the app already supports.
  const key = (label, handler, className = "", ariaLabel) => (
    <button
      key={label + className}
      type="button"
      className={`kb-key ${className}`}
      onClick={handler}
      aria-label={ariaLabel || label}
    >
      {label}
    </button>
  );

  const letter = (char) => {
    const shown = shift ? char.toUpperCase() : char;
    // Types exactly what the key shows — displaying "M" and inserting "m" is a
    // small lie the user watches happen on every letter.
    return key(shown, () => type(shown));
  };

  const preview = mask ? "•".repeat(value.length) : value;

  return (
    <div className="kb" role="group" aria-label={t("keyboard")}>
      <div className="kb-head">
        <span className="kb-preview" aria-live="polite">
          {preview || <span className="kb-preview-empty">{t("keyboardEmpty")}</span>}
        </span>
        <button type="button" className="kb-done" onClick={onSubmit || onClose}>
          {t("done")}
        </button>
      </div>

      {numeric ? (
        <div className="kb-numpad">
          {DIGITS.flat().map((d) => key(d, () => type(d)))}
          {key("⌫", backspace, "kb-key--wide", t("backspace"))}
          {key("0", () => type("0"))}
          {key("✓", onSubmit || onClose, "kb-key--accent", t("done"))}
        </div>
      ) : (
        <div className="kb-rows">
          {layout !== "name" ? (
            <div className="kb-row">{NUMBER_ROW.map((d) => key(d, () => type(d)))}</div>
          ) : null}

          {ROWS.map((row, index) => (
            <div className="kb-row" key={index}>
              {index === ROWS.length - 1
                ? key(
                    "⇧",
                    () => setShift((on) => !on),
                    `kb-key--wide ${shift ? "kb-key--on" : ""}`,
                    t("shift")
                  )
                : null}
              {row.map(letter)}
              {index === ROWS.length - 1
                ? key("⌫", backspace, "kb-key--wide", t("backspace"))
                : null}
            </div>
          ))}

          <div className="kb-row">
            {layout !== "name" ? SYMBOLS.map((s) => key(s, () => type(s))) : key("-", () => type("-"))}
            {key(t("space"), () => type(" "), "kb-key--space")}
            {layout === "name" ? key(".", () => type(".")) : null}
          </div>
        </div>
      )}
    </div>
  );
}
