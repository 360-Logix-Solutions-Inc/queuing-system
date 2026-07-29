// Kiosk-facing copy, one flat table per language. Keys stay flat so a missing
// translation quietly falls back to English instead of blanking a live terminal.
//
// LANGUAGE SET — tuned for a San Agustin, Romblon terminal:
//   Local     : English, Filipino, Romblomanon (Ini), Asi (Bantoanon), Onhan, Cebuano
//   Visitors  : Korean, Chinese, Japanese, German, French, Spanish
//               (the largest inbound-tourist languages for the province)
//
// ⚠ The three Romblon languages (rol / bno / loc) are best-effort translations
// and have NOT been reviewed by native speakers. Have someone from Romblon,
// Banton/Odiongan, and Looc proofread their table before public rollout —
// only the strings in this file need changing, no component edits required.

// `locale` drives date formatting. `speech` is what we hand the Web Speech API —
// the Romblon languages have no TTS voice anywhere, so they borrow the Filipino
// voice, which pronounces their shared Bisayan/Tagalog orthography acceptably.
export const KIOSK_LANGUAGES = [
  // --- Philippines / Romblon ---
  { code: "en", short: "EN", native: "English", label: "English", locale: "en-PH", speech: "en-US", group: "local" },
  { code: "fil", short: "FIL", native: "Filipino", label: "Filipino / Tagalog", locale: "fil-PH", speech: "fil-PH", group: "local" },
  { code: "rol", short: "INI", native: "Ini", label: "Romblomanon", locale: "fil-PH", speech: "fil-PH", group: "local" },
  { code: "bno", short: "ASI", native: "Asi", label: "Bantoanon", locale: "fil-PH", speech: "fil-PH", group: "local" },
  { code: "loc", short: "ONH", native: "Inunhan", label: "Onhan", locale: "fil-PH", speech: "fil-PH", group: "local" },
  { code: "ceb", short: "CEB", native: "Bisaya", label: "Cebuano", locale: "fil-PH", speech: "fil-PH", group: "local" },
  // --- International visitors ---
  { code: "ko", short: "KO", native: "한국어", label: "Korean", locale: "ko-KR", speech: "ko-KR", group: "intl" },
  { code: "zh", short: "ZH", native: "中文", label: "Chinese", locale: "zh-CN", speech: "zh-CN", group: "intl" },
  { code: "ja", short: "JA", native: "日本語", label: "Japanese", locale: "ja-JP", speech: "ja-JP", group: "intl" },
  { code: "de", short: "DE", native: "Deutsch", label: "German", locale: "de-DE", speech: "de-DE", group: "intl" },
  { code: "fr", short: "FR", native: "Français", label: "French", locale: "fr-FR", speech: "fr-FR", group: "intl" },
  { code: "es", short: "ES", native: "Español", label: "Spanish", locale: "es-ES", speech: "es-ES", group: "intl" },
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
    localLanguages: "Philippines / Romblon",
    internationalLanguages: "International",
    textSize: "Text size",
    decreaseText: "Decrease text size",
    increaseText: "Increase text size",
    resetText: "Reset text size to normal",
    reset: "Reset",
    close: "Close",
    readAloud: "Read aloud",
    speakAgain: "Read this screen again",
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
    localLanguages: "Pilipinas / Romblon",
    internationalLanguages: "Internasyonal",
    textSize: "Laki ng teksto",
    decreaseText: "Paliitin ang teksto",
    increaseText: "Palakihin ang teksto",
    resetText: "Ibalik sa normal na laki ng teksto",
    reset: "I-reset",
    close: "Isara",
    readAloud: "Basahin nang malakas",
    speakAgain: "Ulitin ang pagbasa",
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
    localLanguages: "Pilipinas / Romblon",
    internationalLanguages: "Internasyonal",
    textSize: "Kadakuon it letra",
    decreaseText: "Gamayan ang letra",
    increaseText: "Dakuon ang letra",
    resetText: "Ibalik sa normal nga kadakuon it letra",
    reset: "Ibalik",
    close: "Isara",
    readAloud: "Basahon it makusog",
    speakAgain: "Basahon liwat",
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
    localLanguages: "Pilipinas / Romblon",
    internationalLanguages: "Internasyonal",
    textSize: "Kadakuan it yetra",
    decreaseText: "Gamayan ang yetra",
    increaseText: "Dakuan ang yetra",
    resetText: "Ibayik sa normal nak kadakuan it yetra",
    reset: "Ibayik",
    close: "Isadho",
    readAloud: "Basahon it makusog",
    speakAgain: "Basahon yiwat",
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
    localLanguages: "Pilipinas / Romblon",
    internationalLanguages: "Internasyonal",
    textSize: "Kadakuon it letra",
    decreaseText: "Gamayan ang letra",
    increaseText: "Dakuon ang letra",
    resetText: "Ibalik sa normal nga kadakuon it letra",
    reset: "Ibalik",
    close: "Isara",
    readAloud: "Basahon it makusog",
    speakAgain: "Basahon liwat",
  },

  ceb: {
    greeting: "Mabuhay!",
    greetingSub: "Malipayong Pag-abot",
    startButton: "Pindota Aron Magsugod",
    startHint: "Pindota ang button aron magsugod",

    back: "Balik",
    servicesTitle: "Pagpili ug serbisyo",
    servicesSub: "Pindota ang serbisyo nga imong gikinahanglan aron magsugod.",
    queue: "Pila",

    nameLabel: "Ngalan",
    optional: "(dili kinahanglan)",
    namePlaceholder: "Isulat ang imong ngalan",
    phoneLabel: "Numero sa Telepono",
    ticketPreviewHint: "Ihatag ang imong numero human nimo pindota ang Pumila.",
    smsTitle: "Padad-i ko ug SMS",
    smsDesc: "Makadawat ka ug pahibalo sa kumpirmasyon, kung duol na ang imong turno, ug kung gitawag ka na.",
    priorityLane: "Priority Lane",
    regular: "Regular",
    pwd: "PWD",
    senior: "Senior",
    pregnant: "Mabdos",
    seniorCitizen: "Senior Citizen",
    fallInLine: "Pumila",
    pleaseWait: "Palihug hulat...",
    phoneRequired: "Pagsulat ug numero sa telepono aron makadawat ug SMS.",

    consentTitle: "Pahibalo sa Data Privacy",
    consentText1:
      "Sa paghatag sa imong ngalan ug/o numero sa telepono, mitugot ka sa pagkolekta ug pagproseso sa imong personal nga impormasyon subay sa",
    consentLaw: "Data Privacy Act of 2012 (RA 10173)",
    consentText2: ". Ang imong impormasyon gamiton",
    consentUse: "alang lamang sa pagdumala sa pila ug sa mga pahibalo sa SMS",
    consentText3: ", ug dili ipaambit sa laing partido.",
    cancel: "Kanselahon",
    agree: "Mitugot Ko, Padayon",

    yourNumber: "Ang imong numero sa pila",
    doneHint: "Palihug hulat hangtod matawag ang imong numero.",
    newTransaction: "Bag-ong Transaksyon",

    accessibility: "Mga opsyon sa accessibility",
    language: "Pinulongan",
    chooseLanguage: "Pagpili ug pinulongan",
    localLanguages: "Pilipinas / Romblon",
    internationalLanguages: "Internasyonal",
    textSize: "Gidak-on sa letra",
    decreaseText: "Gamayi ang letra",
    increaseText: "Dakoi ang letra",
    resetText: "Ibalik sa normal nga gidak-on sa letra",
    reset: "Ibalik",
    close: "Sirad-i",
    readAloud: "Basaha ug kusog",
    speakAgain: "Basaha usab",
  },

  ko: {
    greeting: "환영합니다!",
    greetingSub: "어서 오세요",
    startButton: "화면을 눌러 시작",
    startHint: "버튼을 눌러 시작하세요",

    back: "뒤로",
    servicesTitle: "서비스를 선택하세요",
    servicesSub: "원하는 서비스를 누르면 시작됩니다.",
    queue: "대기",

    nameLabel: "이름",
    optional: "(선택 사항)",
    namePlaceholder: "이름을 입력하세요",
    phoneLabel: "전화번호",
    ticketPreviewHint: "‘줄 서기’를 누르면 대기번호가 발급됩니다.",
    smsTitle: "SMS 알림 받기",
    smsDesc: "접수 확인, 순서 임박, 호출 알림을 문자로 받습니다.",
    priorityLane: "우선 창구",
    regular: "일반",
    pwd: "장애인",
    senior: "고령자",
    pregnant: "임산부",
    seniorCitizen: "고령자",
    fallInLine: "줄 서기",
    pleaseWait: "잠시만 기다려 주세요...",
    phoneRequired: "SMS 알림을 받으려면 전화번호를 입력하세요.",

    consentTitle: "개인정보 처리 안내",
    consentText1:
      "이름 및 전화번호를 제공함으로써, 귀하는 다음 법률에 따라 개인정보의 수집 및 처리에 동의하게 됩니다:",
    consentLaw: "2012년 개인정보보호법 (RA 10173)",
    consentText2: ". 귀하의 정보는",
    consentUse: "대기열 관리 및 SMS 알림에만 사용",
    consentText3: "되며, 제3자에게 제공되지 않습니다.",
    cancel: "취소",
    agree: "동의하고 계속",

    yourNumber: "귀하의 대기번호",
    doneHint: "번호가 호출될 때까지 기다려 주세요.",
    newTransaction: "새 접수",

    accessibility: "접근성 설정",
    language: "언어",
    chooseLanguage: "언어를 선택하세요",
    localLanguages: "필리핀 / 롬블론",
    internationalLanguages: "해외 언어",
    textSize: "글자 크기",
    decreaseText: "글자 작게",
    increaseText: "글자 크게",
    resetText: "글자 크기를 기본값으로",
    reset: "초기화",
    close: "닫기",
    readAloud: "소리 내어 읽기",
    speakAgain: "이 화면을 다시 읽기",
  },

  zh: {
    greeting: "欢迎光临！",
    greetingSub: "欢迎",
    startButton: "触摸屏幕开始",
    startHint: "点击按钮即可开始",

    back: "返回",
    servicesTitle: "请选择服务",
    servicesSub: "点击任一服务即可开始办理。",
    queue: "排队",

    nameLabel: "姓名",
    optional: "（选填）",
    namePlaceholder: "请输入您的姓名",
    phoneLabel: "手机号码",
    ticketPreviewHint: "点击“取号排队”后将生成您的排队号码。",
    smsTitle: "接收短信通知",
    smsDesc: "接收取号确认、即将轮到您以及叫号通知。",
    priorityLane: "优先通道",
    regular: "普通",
    pwd: "残障人士",
    senior: "长者",
    pregnant: "孕妇",
    seniorCitizen: "长者",
    fallInLine: "取号排队",
    pleaseWait: "请稍候…",
    phoneRequired: "请输入手机号码以接收短信通知。",

    consentTitle: "数据隐私声明",
    consentText1:
      "提供姓名及／或手机号码，即表示您同意依据下列法规收集和处理您的个人信息：",
    consentLaw: "2012年数据隐私法 (RA 10173)",
    consentText2: "。您的信息",
    consentUse: "仅用于排队管理和短信通知",
    consentText3: "，不会提供给第三方。",
    cancel: "取消",
    agree: "同意并继续",

    yourNumber: "您的排队号码",
    doneHint: "请等候叫号。",
    newTransaction: "新的办理",

    accessibility: "无障碍设置",
    language: "语言",
    chooseLanguage: "请选择语言",
    localLanguages: "菲律宾 / 朗布隆",
    internationalLanguages: "国际语言",
    textSize: "字体大小",
    decreaseText: "缩小字体",
    increaseText: "放大字体",
    resetText: "恢复默认字体大小",
    reset: "重置",
    close: "关闭",
    readAloud: "朗读",
    speakAgain: "再朗读一次本页",
  },

  ja: {
    greeting: "ようこそ！",
    greetingSub: "いらっしゃいませ",
    startButton: "タッチして開始",
    startHint: "ボタンをタップして開始してください",

    back: "戻る",
    servicesTitle: "サービスを選択",
    servicesSub: "ご希望のサービスをタップしてください。",
    queue: "受付",

    nameLabel: "お名前",
    optional: "（任意）",
    namePlaceholder: "お名前を入力してください",
    phoneLabel: "電話番号",
    ticketPreviewHint: "「受付する」をタップすると番号が発行されます。",
    smsTitle: "SMS通知を受け取る",
    smsDesc: "受付確認、順番が近づいたお知らせ、呼び出し通知を受け取れます。",
    priorityLane: "優先レーン",
    regular: "一般",
    pwd: "障がい者",
    senior: "高齢者",
    pregnant: "妊婦",
    seniorCitizen: "高齢者",
    fallInLine: "受付する",
    pleaseWait: "しばらくお待ちください…",
    phoneRequired: "SMS通知を受け取るには電話番号を入力してください。",

    consentTitle: "個人情報の取り扱いについて",
    consentText1:
      "お名前および電話番号をご提供いただくことで、次の法律に基づく個人情報の収集および処理に同意したものとみなされます:",
    consentLaw: "2012年データプライバシー法 (RA 10173)",
    consentText2: "。お客様の情報は",
    consentUse: "受付管理とSMS通知のみに使用",
    consentText3: "され、第三者には提供されません。",
    cancel: "キャンセル",
    agree: "同意して続ける",

    yourNumber: "お客様の受付番号",
    doneHint: "番号が呼ばれるまでお待ちください。",
    newTransaction: "新しい受付",

    accessibility: "アクセシビリティ設定",
    language: "言語",
    chooseLanguage: "言語を選択してください",
    localLanguages: "フィリピン / ロンブロン",
    internationalLanguages: "海外の言語",
    textSize: "文字サイズ",
    decreaseText: "文字を小さく",
    increaseText: "文字を大きく",
    resetText: "文字サイズを標準に戻す",
    reset: "リセット",
    close: "閉じる",
    readAloud: "読み上げ",
    speakAgain: "この画面をもう一度読み上げる",
  },

  de: {
    greeting: "Willkommen!",
    greetingSub: "Herzlich willkommen",
    startButton: "Zum Starten tippen",
    startHint: "Tippen Sie auf die Schaltfläche, um zu beginnen",

    back: "Zurück",
    servicesTitle: "Service auswählen",
    servicesSub: "Tippen Sie auf einen Service, um zu beginnen.",
    queue: "Warteschlange",

    nameLabel: "Name",
    optional: "(optional)",
    namePlaceholder: "Geben Sie Ihren Namen ein",
    phoneLabel: "Telefonnummer",
    ticketPreviewHint: "Ihre Wartenummer wird erstellt, sobald Sie auf „Anstellen“ tippen.",
    smsTitle: "SMS-Benachrichtigungen erhalten",
    smsDesc: "Erhalten Sie Bestätigung, Vorwarnung und Aufruf per SMS.",
    priorityLane: "Vorrangschalter",
    regular: "Regulär",
    pwd: "Behinderung",
    senior: "Senior",
    pregnant: "Schwanger",
    seniorCitizen: "Senior",
    fallInLine: "Anstellen",
    pleaseWait: "Bitte warten...",
    phoneRequired: "Geben Sie eine Telefonnummer ein, um SMS zu erhalten.",

    consentTitle: "Datenschutzhinweis",
    consentText1:
      "Mit der Angabe Ihres Namens und/oder Ihrer Telefonnummer stimmen Sie der Erhebung und Verarbeitung Ihrer personenbezogenen Daten gemäß dem",
    consentLaw: "Datenschutzgesetz von 2012 (RA 10173)",
    consentText2: " zu. Ihre Daten werden",
    consentUse: "ausschließlich für die Warteschlangenverwaltung und SMS-Benachrichtigungen verwendet",
    consentText3: " und nicht an Dritte weitergegeben.",
    cancel: "Abbrechen",
    agree: "Zustimmen & Fortfahren",

    yourNumber: "Ihre Wartenummer",
    doneHint: "Bitte warten Sie, bis Ihre Nummer aufgerufen wird.",
    newTransaction: "Neuer Vorgang",

    accessibility: "Barrierefreiheit",
    language: "Sprache",
    chooseLanguage: "Wählen Sie Ihre Sprache",
    localLanguages: "Philippinen / Romblon",
    internationalLanguages: "International",
    textSize: "Schriftgröße",
    decreaseText: "Schrift verkleinern",
    increaseText: "Schrift vergrößern",
    resetText: "Schriftgröße zurücksetzen",
    reset: "Zurücksetzen",
    close: "Schließen",
    readAloud: "Vorlesen",
    speakAgain: "Diesen Bildschirm erneut vorlesen",
  },

  fr: {
    greeting: "Bienvenue !",
    greetingSub: "Soyez les bienvenus",
    startButton: "Touchez pour commencer",
    startHint: "Appuyez sur le bouton pour commencer",

    back: "Retour",
    servicesTitle: "Choisissez un service",
    servicesSub: "Appuyez sur un service pour commencer votre démarche.",
    queue: "File",

    nameLabel: "Nom",
    optional: "(facultatif)",
    namePlaceholder: "Saisissez votre nom",
    phoneLabel: "Numéro de téléphone",
    ticketPreviewHint: "Votre numéro sera généré lorsque vous appuierez sur « Prendre un ticket ».",
    smsTitle: "Recevoir des alertes SMS",
    smsDesc: "Recevez la confirmation, l'avis d'approche de votre tour et l'appel.",
    priorityLane: "File prioritaire",
    regular: "Standard",
    pwd: "Handicap",
    senior: "Senior",
    pregnant: "Enceinte",
    seniorCitizen: "Senior",
    fallInLine: "Prendre un ticket",
    pleaseWait: "Veuillez patienter...",
    phoneRequired: "Saisissez un numéro de téléphone pour recevoir les SMS.",

    consentTitle: "Avis de confidentialité",
    consentText1:
      "En fournissant votre nom et/ou votre numéro de téléphone, vous consentez à la collecte et au traitement de vos données personnelles conformément à la",
    consentLaw: "Loi sur la protection des données de 2012 (RA 10173)",
    consentText2: ". Vos données seront utilisées",
    consentUse: "uniquement pour la gestion de la file et les notifications SMS",
    consentText3: ", et ne seront pas communiquées à des tiers.",
    cancel: "Annuler",
    agree: "J'accepte et je continue",

    yourNumber: "Votre numéro de file",
    doneHint: "Veuillez attendre l'appel de votre numéro.",
    newTransaction: "Nouvelle démarche",

    accessibility: "Options d'accessibilité",
    language: "Langue",
    chooseLanguage: "Choisissez votre langue",
    localLanguages: "Philippines / Romblon",
    internationalLanguages: "International",
    textSize: "Taille du texte",
    decreaseText: "Réduire le texte",
    increaseText: "Agrandir le texte",
    resetText: "Rétablir la taille normale du texte",
    reset: "Réinitialiser",
    close: "Fermer",
    readAloud: "Lecture vocale",
    speakAgain: "Relire cet écran",
  },

  es: {
    greeting: "¡Bienvenido!",
    greetingSub: "Le damos la bienvenida",
    startButton: "Toque para comenzar",
    startHint: "Pulse el botón para comenzar",

    back: "Atrás",
    servicesTitle: "Seleccione un servicio",
    servicesSub: "Pulse cualquier servicio para iniciar su trámite.",
    queue: "Fila",

    nameLabel: "Nombre",
    optional: "(opcional)",
    namePlaceholder: "Escriba su nombre",
    phoneLabel: "Número de teléfono",
    ticketPreviewHint: "Su número se generará al pulsar «Ponerse en fila».",
    smsTitle: "Recibir avisos por SMS",
    smsDesc: "Reciba la confirmación, el aviso de turno próximo y la llamada.",
    priorityLane: "Fila prioritaria",
    regular: "Regular",
    pwd: "Discapacidad",
    senior: "Adulto mayor",
    pregnant: "Embarazada",
    seniorCitizen: "Adulto mayor",
    fallInLine: "Ponerse en fila",
    pleaseWait: "Espere un momento...",
    phoneRequired: "Escriba un número de teléfono para recibir SMS.",

    consentTitle: "Aviso de privacidad de datos",
    consentText1:
      "Al proporcionar su nombre y/o número de teléfono, usted consiente la recopilación y el tratamiento de sus datos personales conforme a la",
    consentLaw: "Ley de Privacidad de Datos de 2012 (RA 10173)",
    consentText2: ". Su información se usará",
    consentUse: "únicamente para la gestión de la fila y las notificaciones por SMS",
    consentText3: ", y no se compartirá con terceros.",
    cancel: "Cancelar",
    agree: "Acepto y continúo",

    yourNumber: "Su número de fila",
    doneHint: "Espere a que llamen su número.",
    newTransaction: "Nuevo trámite",

    accessibility: "Opciones de accesibilidad",
    language: "Idioma",
    chooseLanguage: "Elija su idioma",
    localLanguages: "Filipinas / Romblon",
    internationalLanguages: "Internacional",
    textSize: "Tamaño del texto",
    decreaseText: "Reducir el texto",
    increaseText: "Aumentar el texto",
    resetText: "Restablecer el tamaño del texto",
    reset: "Restablecer",
    close: "Cerrar",
    readAloud: "Lectura en voz alta",
    speakAgain: "Volver a leer esta pantalla",
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
