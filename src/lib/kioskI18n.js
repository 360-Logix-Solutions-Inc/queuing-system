// Kiosk-facing copy, one flat table per language. Keys stay flat so a missing
// translation quietly falls back to English instead of blanking a live terminal.
//
// LANGUAGE SET — local languages only, for a San Agustin, Romblon terminal:
//   English, Filipino, and the three Romblon languages:
//   Romblomanon (Ini), Asi (Bantoanon), Onhan (Inunhan)
//
// ⚠ The three Romblon languages (rol / bno / loc) are best-effort translations
// and have NOT been reviewed by native speakers. Have someone from Romblon,
// Banton/Odiongan, and Looc proofread their table before public rollout —
// only the strings in this file need changing, no component edits required.

// `locale` drives date formatting. `speech` is the Web Speech API fallback, used
// only when a language has no recorded clip set; the Romblon languages borrow
// the Filipino voice, which reads their shared Bisayan orthography acceptably.
export const KIOSK_LANGUAGES = [
  { code: "en", short: "EN", native: "English", label: "English", locale: "en-PH", speech: "en-US" },
  { code: "fil", short: "FIL", native: "Filipino", label: "Filipino / Tagalog", locale: "fil-PH", speech: "fil-PH" },
  { code: "rol", short: "INI", native: "Ini", label: "Romblomanon", locale: "fil-PH", speech: "fil-PH" },
  { code: "bno", short: "ASI", native: "Asi", label: "Bantoanon", locale: "fil-PH", speech: "fil-PH" },
  { code: "loc", short: "ONH", native: "Inunhan", label: "Onhan", locale: "fil-PH", speech: "fil-PH" },
];

export const DEFAULT_LANG = "en";

// Text-size steps offered by the accessibility bar. 1 = the design's native size.
export const ZOOM_LEVELS = [1, 1.15, 1.3, 1.5];

const STRINGS = {
  en: {
    greeting: "Mabuhay!",
    greetingSub: "Welcome",
    startButton: "Touch to Start",
    startHint: "Tap the button to begin",

    back: "Back",
    servicesTitle: "Select a service",
    servicesSub: "Tap any service to begin your transaction.",
    queue: "Queue",

    nameLabel: "Name",
    optional: "(optional)",
    namePlaceholder: "Enter your name",
    phoneLabel: "Phone Number",
    ticketPreviewHint: "Your queue number is generated when you tap Fall in Line.",
    smsTitle: "Send me SMS alerts",
    smsDesc: "Receive ticket confirmation, near-turn, and now-serving notifications.",
    priorityLane: "Priority Lane",
    regular: "Regular",
    pwd: "PWD",
    senior: "Senior",
    pregnant: "Pregnant",
    seniorCitizen: "Senior Citizen",
    fallInLine: "Fall in Line",
    pleaseWait: "Please wait...",
    phoneRequired: "Enter a phone number to receive SMS alerts.",

    consentTitle: "Data Privacy Notice",
    consentText1:
      "By providing your name and/or phone number, you consent to the collection and processing of your personal information in compliance with the",
    consentLaw: "Data Privacy Act of 2012 (RA 10173)",
    consentText2: ". Your information will be used",
    consentUse: "only for queue management and SMS notifications",
    consentText3: ", and will not be shared with third parties.",
    cancel: "Cancel",
    agree: "I Agree & Continue",

    yourNumber: "Your queue number",
    doneHint: "Please wait for your number to be called.",
    newTransaction: "New Transaction",

    accessibility: "Accessibility options",
    language: "Language",
    chooseLanguage: "Choose your language",
    textSize: "Text size",
    decreaseText: "Decrease text size",
    increaseText: "Increase text size",
    resetText: "Reset text size to normal",
    reset: "Reset",
    close: "Close",
    readAloud: "Read aloud",
    speakAgain: "Read this screen again",
    keyboard: "Keyboard",
    keyboardEmpty: "Tap the keys to type",
    done: "Done",
    space: "Space",
    backspace: "Backspace",
    offline: "Offline",
    offlineHint: "Works without internet",
    shift: "Shift",
  },

  fil: {
    greeting: "Mabuhay!",
    greetingSub: "Maligayang Pagdating",
    startButton: "Pindutin para Magsimula",
    startHint: "I-tap ang button upang magsimula",

    back: "Bumalik",
    servicesTitle: "Pumili ng serbisyo",
    servicesSub: "I-tap ang serbisyong kailangan mo upang magsimula.",
    queue: "Pila",

    nameLabel: "Pangalan",
    optional: "(opsyonal)",
    namePlaceholder: "Ilagay ang iyong pangalan",
    phoneLabel: "Numero ng Telepono",
    ticketPreviewHint: "Ibibigay ang iyong numero kapag pinindot mo ang Pumila.",
    smsTitle: "Padalhan ako ng SMS",
    smsDesc: "Makakatanggap ka ng abiso sa kumpirmasyon, malapit nang turno, at kapag tinatawag ka na.",
    priorityLane: "Priority Lane",
    regular: "Regular",
    pwd: "PWD",
    senior: "Senior",
    pregnant: "Buntis",
    seniorCitizen: "Senior Citizen",
    fallInLine: "Pumila",
    pleaseWait: "Sandali lang po...",
    phoneRequired: "Maglagay ng numero ng telepono para makatanggap ng SMS.",

    consentTitle: "Paunawa sa Data Privacy",
    consentText1:
      "Sa pagbibigay ng iyong pangalan at/o numero ng telepono, pumapayag ka sa pangongolekta at pagproseso ng iyong personal na impormasyon alinsunod sa",
    consentLaw: "Data Privacy Act of 2012 (RA 10173)",
    consentText2: ". Ang iyong impormasyon ay gagamitin",
    consentUse: "para lamang sa pamamahala ng pila at mga abiso sa SMS",
    consentText3: ", at hindi ibabahagi sa ibang partido.",
    cancel: "Kanselahin",
    agree: "Sang-ayon Ako, Magpatuloy",

    yourNumber: "Ang iyong numero sa pila",
    doneHint: "Maghintay po hanggang tawagin ang inyong numero.",
    newTransaction: "Bagong Transaksyon",

    accessibility: "Mga opsyon sa accessibility",
    language: "Wika",
    chooseLanguage: "Pumili ng wika",
    textSize: "Laki ng teksto",
    decreaseText: "Paliitin ang teksto",
    increaseText: "Palakihin ang teksto",
    resetText: "Ibalik sa normal na laki ng teksto",
    reset: "I-reset",
    close: "Isara",
    readAloud: "Basahin nang malakas",
    speakAgain: "Ulitin ang pagbasa",
    keyboard: "Keyboard",
    keyboardEmpty: "I-tap ang mga letra",
    done: "Tapos na",
    space: "Space",
    backspace: "Burahin",
    offline: "Offline",
    offlineHint: "Gumagana kahit walang internet",
    shift: "Shift",
  },

  // Romblomanon (Ini) — Romblon, San Agustin, Cajidiocan, Magdiwang, San Fernando
  rol: {
    greeting: "Mabuhay!",
    greetingSub: "Malipayon nga Pag-abot",
    startButton: "Pindutan Para Magsugod",
    startHint: "Pindutan ang button para magsugod",

    back: "Balik",
    servicesTitle: "Magpili it serbisyo",
    servicesSub: "Pindutan ang serbisyo nga kinahanglan mo para magsugod.",
    queue: "Pila",

    nameLabel: "Ngayan",
    optional: "(pwede laktawan)",
    namePlaceholder: "Isulat ang imo ngayan",
    phoneLabel: "Numero it Telepono",
    ticketPreviewHint: "Mahatag ang imo numero pagkatapos mo pindutan ang Pumila.",
    smsTitle: "Padal-i ako it SMS",
    smsDesc: "Makabaton ka it abiso sa kumpirmasyon, kon malapit run ang imo turno, kag kon ginatawag ka run.",
    priorityLane: "Priority Lane",
    regular: "Regular",
    pwd: "PWD",
    senior: "Senior",
    pregnant: "Nagabusong",
    seniorCitizen: "Senior Citizen",
    fallInLine: "Pumila",
    pleaseWait: "Maghulat lang po...",
    phoneRequired: "Magsulat it numero it telepono para makabaton it SMS.",

    consentTitle: "Paandam nahanungod sa Data Privacy",
    consentText1:
      "Sa paghatag it imo ngayan kag/o numero it telepono, nagatugot ka sa pagkolekta kag pagproseso it imo personal nga impormasyon suno sa",
    consentLaw: "Data Privacy Act of 2012 (RA 10173)",
    consentText2: ". Ang imo impormasyon gamiton",
    consentUse: "para lang sa pagdumala it pila kag sa mga abiso sa SMS",
    consentText3: ", kag indi ipaambit sa iba nga partido.",
    cancel: "Kanselahon",
    agree: "Nagatugot Ako, Padayon",

    yourNumber: "Ang imo numero sa pila",
    doneHint: "Maghulat lang hasta matawag ang imo numero.",
    newTransaction: "Bag-o nga Transaksyon",

    accessibility: "Mga opsyon sa accessibility",
    language: "Lengguwahe",
    chooseLanguage: "Magpili it lengguwahe",
    textSize: "Kadakuon it letra",
    decreaseText: "Gamayan ang letra",
    increaseText: "Dakuon ang letra",
    resetText: "Ibalik sa normal nga kadakuon it letra",
    reset: "Ibalik",
    close: "Isara",
    readAloud: "Basahon it makusog",
    speakAgain: "Basahon liwat",
    keyboard: "Keyboard",
    keyboardEmpty: "Pindutan ang mga letra",
    done: "Tapos ron",
    space: "Space",
    backspace: "Panason",
    offline: "Offline",
    offlineHint: "Nagaandar bisan wara it internet",
    shift: "Shift",
  },

  // Asi / Bantoanon — Banton, Odiongan, Calatrava, Corcuera, Concepcion, San Andres
  bno: {
    greeting: "Mabuhay!",
    greetingSub: "Maayad nak Pag-abot",
    startButton: "Pindoton Para Magsugod",
    startHint: "Pindoton ang button para magsugod",

    back: "Bayik",
    servicesTitle: "Mamili it serbisyo",
    servicesSub: "Pindoton ang serbisyo nak kinahangyan nimo para magsugod.",
    queue: "Pila",

    nameLabel: "Ngayan",
    optional: "(pwede yaktawan)",
    namePlaceholder: "Isuyat ang imong ngayan",
    phoneLabel: "Numero it Teyepono",
    ticketPreviewHint: "Ihatag ang imong numero pagkatapos nimo pindoton ang Pumila.",
    smsTitle: "Padayhan ako it SMS",
    smsDesc: "Makabaton ka it abiso sa kumpirmasyon, kung hariani ra ang imong turno, ag kung ginatawag ka ra.",
    priorityLane: "Priority Lane",
    regular: "Regular",
    pwd: "PWD",
    senior: "Senior",
    pregnant: "Nagabusong",
    seniorCitizen: "Senior Citizen",
    fallInLine: "Pumila",
    pleaseWait: "Maghuyat yang...",
    phoneRequired: "Magsuyat it numero it teyepono para makabaton it SMS.",

    consentTitle: "Paandam nahanungod sa Data Privacy",
    consentText1:
      "Sa paghatag it imong ngayan ag/o numero it teyepono, nagatugot ka sa pagkoyekta ag pagproseso it imong personal nak impormasyon suno sa",
    consentLaw: "Data Privacy Act of 2012 (RA 10173)",
    consentText2: ". Ang imong impormasyon gamiton",
    consentUse: "para yang sa pagdumaya it pila ag sa mga abiso sa SMS",
    consentText3: ", ag indi ipaambit sa ibang partido.",
    cancel: "Kanseyahon",
    agree: "Nagatugot Ako, Padayon",

    yourNumber: "Ang imong numero sa pila",
    doneHint: "Maghuyat yang hasta matawag ang imong numero.",
    newTransaction: "Bag-ong Transaksyon",

    accessibility: "Mga opsyon sa accessibility",
    language: "Lengguwahe",
    chooseLanguage: "Mamili it lengguwahe",
    textSize: "Kadakuan it yetra",
    decreaseText: "Gamayan ang yetra",
    increaseText: "Dakuan ang yetra",
    resetText: "Ibayik sa normal nak kadakuan it yetra",
    reset: "Ibayik",
    close: "Isadho",
    readAloud: "Basahon it makusog",
    speakAgain: "Basahon yiwat",
    keyboard: "Keyboard",
    keyboardEmpty: "Pindoton ang mga yetra",
    done: "Tapos ra",
    space: "Space",
    backspace: "Panason",
    offline: "Offline",
    offlineHint: "Nagaandar bisan wayay internet",
    shift: "Shift",
  },

  // Onhan / Inunhan — Looc, Alcantara, Santa Fe, Santa Maria, San Jose
  loc: {
    greeting: "Mabuhay!",
    greetingSub: "Mayad nga Pag-abot",
    startButton: "Pisilon Para Magsugod",
    startHint: "Pisilon ang button para magsugod",

    back: "Balik",
    servicesTitle: "Magpili it serbisyo",
    servicesSub: "Pisilon ang serbisyo nga kinahanglan mo para magsugod.",
    queue: "Pila",

    nameLabel: "Ngaran",
    optional: "(pwede laktawan)",
    namePlaceholder: "Isulat ang imo ngaran",
    phoneLabel: "Numero it Telepono",
    ticketPreviewHint: "Ihatag ang imo numero pagkatapos mo pisilon ang Pumila.",
    smsTitle: "Padal-i ako it SMS",
    smsDesc: "Makabaton ka it abiso sa kumpirmasyon, kon malapit ron ang imo turno, ag kon ginatawag ka ron.",
    priorityLane: "Priority Lane",
    regular: "Regular",
    pwd: "PWD",
    senior: "Senior",
    pregnant: "Nagabusong",
    seniorCitizen: "Senior Citizen",
    fallInLine: "Pumila",
    pleaseWait: "Maghulat lang...",
    phoneRequired: "Magsulat it numero it telepono para makabaton it SMS.",

    consentTitle: "Paandam nahanungod sa Data Privacy",
    consentText1:
      "Sa paghatag it imo ngaran ag/o numero it telepono, nagatugot ka sa pagkolekta ag pagproseso it imo personal nga impormasyon suno sa",
    consentLaw: "Data Privacy Act of 2012 (RA 10173)",
    consentText2: ". Ang imo impormasyon gamiton",
    consentUse: "para lang sa pagdumala it pila ag sa mga abiso sa SMS",
    consentText3: ", ag indi ipaambit sa iba nga partido.",
    cancel: "Kanselahon",
    agree: "Nagatugot Ako, Padayon",

    yourNumber: "Ang imo numero sa pila",
    doneHint: "Maghulat lang hasta matawag ang imo numero.",
    newTransaction: "Bag-o nga Transaksyon",

    accessibility: "Mga opsyon sa accessibility",
    language: "Lengguwahe",
    chooseLanguage: "Magpili it lengguwahe",
    textSize: "Kadakuon it letra",
    decreaseText: "Gamayan ang letra",
    increaseText: "Dakuon ang letra",
    resetText: "Ibalik sa normal nga kadakuon it letra",
    reset: "Ibalik",
    close: "Isara",
    readAloud: "Basahon it makusog",
    speakAgain: "Basahon liwat",
    keyboard: "Keyboard",
    keyboardEmpty: "Pisilon ang mga letra",
    done: "Tapos ron",
    space: "Space",
    backspace: "Panason",
    offline: "Offline",
    offlineHint: "Nagaandar bisan wara it internet",
    shift: "Shift",
  },

};

export function kioskT(lang, key) {
  const table = STRINGS[lang] || STRINGS[DEFAULT_LANG];
  const value = table[key];
  if (value !== undefined) return value;
  return STRINGS[DEFAULT_LANG][key] ?? key;
}

// Service names live in Firestore, not in this file, so they need their own
// lookup: an optional `names` map on the service document, falling back to the
// plain `name`. Storing the translations alongside the service keeps them
// available offline — Firestore's cache carries them — instead of needing a
// translation call at the moment a customer is standing there.
export function serviceName(service, lang) {
  if (!service) return "";
  return service.names?.[lang] || service.name || "";
}

export function languageInfo(lang) {
  return KIOSK_LANGUAGES.find((item) => item.code === lang) || KIOSK_LANGUAGES[0];
}

// Intl has no data for rol/bno/loc, so those fall back to a Philippine locale
// for date formatting rather than throwing a RangeError.
export function languageLocale(lang) {
  return languageInfo(lang).locale;
}

export function speechLocale(lang) {
  return languageInfo(lang).speech;
}
