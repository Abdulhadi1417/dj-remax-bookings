(function () {
  "use strict";

  // ---------- الثوابت ----------
  const MONTHS = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];
  const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const EXPENSE_CATEGORIES = ["معدات وأجهزة", "صيانة", "إيجار معدات", "نقل ومواصلات", "مساعدين وفنيين", "اشتراكات موسيقى", "تسويق", "أخرى"];
  const PAGE_TITLES = { bookings: "الحجوزات", expenses: "المصاريف", finance: "المالية", settings: "الإعدادات" };
  const STATUS_LABELS = { confirmed: "مؤكد", pending: "غير مؤكد" };

  const DEFAULT_POLICY = [
    "سياسة الإلغاء والاسترجاع:",
    "- الإلغاء قبل 14 يومًا من تاريخ الحجز يسترد المبلغ بالكامل.",
    "- الإلغاء خلال 7-13 يومًا يسترد 50% من العربون.",
    "- الإلغاء أقل من 7 أيام لا يسترد العربون.",
    "- يتم تحويل المبلغ المسترد إلى الحساب البنكي خلال 14 يوم عمل.",
  ].join("\n");

  const DEFAULT_SETTINGS = {
    name: "DJ Remax - دي جي ريمكس",
    phone: "0566452281",
    location: "الشرقية - الأحساء",
    eventTypes: ["زواج", "سبحة", "شبكة", "اصباحية", "عيد ميلاد", "حفل تخرج"],
    serviceTypes: ["تشغيل دي جي", "بدون مشغل", "إيجار مكسر", "إيجار سماعات"],
    extras: ["بدون إضافات", "زيادة سماعة", "زيادة سماعتين"],
    paymentMethods: ["تحويل بنكي", "كاش", "مدى", "STC Pay"],
    policy: DEFAULT_POLICY,
  };

  // قوائم الاختيارات اللي تتعدل من الإعدادات
  const OPTION_LISTS = [
    { key: "eventTypes", label: "أنواع المناسبات" },
    { key: "serviceTypes", label: "نوع الخدمة" },
    { key: "extras", label: "الإضافات" },
    { key: "paymentMethods", label: "طرق الدفع" },
  ];
  const OLD_EVENT_TYPES = "زواج, ملكة, حفل تخرج, عيد ميلاد, حفلة خاصة, فعالية شركة";

  function normalizeSettings(raw) {
    const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
    OPTION_LISTS.forEach(({ key }) => {
      let v = s[key];
      if (typeof v === "string") v = v === OLD_EVENT_TYPES ? null : v.split(/[,،]/);
      s[key] = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [...DEFAULT_SETTINGS[key]];
    });
    return s;
  }

  // تحويل الأرقام العربية/الفارسية إلى إنجليزية
  function toEnDigits(v) {
    return String(v ?? "")
      .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
      .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06f0)
      .replace(/٫/g, ".");
  }

  // ---------- التخزين ----------
  const KEYS = { bookings: "djremax_bookings", expenses: "djremax_expenses", settings: "djremax_settings" };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      toast("تعذّر حفظ البيانات في المتصفح");
    }
  }

  const state = {
    bookings: load(KEYS.bookings, []),
    expenses: load(KEYS.expenses, []),
    settings: normalizeSettings(load(KEYS.settings, {})),
    page: "bookings",
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    activeBookingId: null,
  };

  const cloud = window.Cloud && window.Cloud.enabled ? window.Cloud : null;
  const DIRTY_KEY = "djremax_dirty";

  const persistBookings = () => save(KEYS.bookings, state.bookings);
  const persistExpenses = () => save(KEYS.expenses, state.expenses);
  const persistSettings = () => save(KEYS.settings, state.settings);

  // ---------- أدوات ----------
  const $ = (id) => document.getElementById(id);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const todayStr = () => {
    const t = new Date();
    return ymd(t.getFullYear(), t.getMonth(), t.getDate());
  };
  const monthPrefix = (y, m) => `${y}-${pad(m + 1)}`;
  const num = (v) => Number(toEnDigits(v).replace(/[,٬\s]/g, "")) || 0;
  const money = (v) => `${num(v).toLocaleString("en-US", { maximumFractionDigits: 2 })} ر.س`;
  const remainingOf = (b) => num(b.total) - num(b.deposit);

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateLong(str) {
    if (!str) return "";
    const d = parseDate(str);
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const suffix = h < 12 ? "ص" : "م";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad(m)} ${suffix}`;
  }

  function timeRange(b) {
    if (b.timeFrom && b.timeTo) return `من ${formatTime(b.timeFrom)} إلى ${formatTime(b.timeTo)}`;
    if (b.timeFrom) return `من ${formatTime(b.timeFrom)}`;
    if (b.timeTo) return `إلى ${formatTime(b.timeTo)}`;
    return "";
  }

  const sortBookings = (a, b) => (a.date + (a.timeFrom || "")).localeCompare(b.date + (b.timeFrom || ""));

  let toastTimer;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  }

  // نافذة تأكيد داخل الصفحة بدل confirm()
  function askConfirm(message, yesLabel = "تأكيد") {
    return new Promise((resolve) => {
      $("confirmText").textContent = message;
      $("confirmYes").textContent = yesLabel;
      const done = (val) => {
        $("confirmModal").classList.add("hidden");
        $("confirmYes").onclick = $("confirmNo").onclick = null;
        resolve(val);
      };
      $("confirmYes").onclick = () => done(true);
      $("confirmNo").onclick = () => done(false);
      $("confirmModal").classList.remove("hidden");
    });
  }

  function openModal(id) {
    $(id).classList.remove("hidden");
  }
  function closeModal(id) {
    $(id).classList.add("hidden");
  }
  document.querySelectorAll(".overlay").forEach((ov) => {
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-close]")) ov.classList.add("hidden");
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".overlay").forEach((ov) => ov.classList.add("hidden"));
  });

  // ---------- التنقل ----------
  function setPage(page) {
    state.page = page;
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("hidden", p.id !== `page-${page}`));
    $("pageTitle").textContent = PAGE_TITLES[page];
    $("monthNav").classList.toggle("hidden", page === "settings");
    try {
      localStorage.setItem("djremax_page", page);
    } catch {}
    render();
  }

  document.querySelectorAll(".nav-item").forEach((btn) => btn.addEventListener("click", () => setPage(btn.dataset.page)));

  function shiftMonth(delta) {
    const d = new Date(state.year, state.month + delta, 1);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    render();
  }
  $("prevMonth").addEventListener("click", () => shiftMonth(-1));
  $("nextMonth").addEventListener("click", () => shiftMonth(1));
  $("monthLabel").addEventListener("click", () => {
    const t = new Date();
    state.year = t.getFullYear();
    state.month = t.getMonth();
    render();
  });

  function render() {
    $("monthLabel").textContent = `${MONTHS[state.month]} ${state.year}`;
    if (state.page === "bookings") renderCalendar();
    else if (state.page === "expenses") renderExpenses();
    else if (state.page === "finance") renderFinance();
    else if (state.page === "settings") renderSettings();
  }

  // ---------- التقويم ----------
  $("calHead").innerHTML = WEEKDAYS.map((w) => `<div>${w}</div>`).join("");

  function renderCalendar() {
    const { year, month } = state;
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const today = todayStr();
    const prefix = monthPrefix(year, month);

    const byDate = {};
    state.bookings
      .filter((b) => b.date.startsWith(prefix))
      .sort(sortBookings)
      .forEach((b) => (byDate[b.date] = byDate[b.date] || []).push(b));

    const cells = [];
    for (let i = 0; i < first; i++) cells.push(`<div class="day out"></div>`);
    for (let d = 1; d <= days; d++) {
      const date = ymd(year, month, d);
      const chips = (byDate[date] || [])
        .map(
          (b) => `<button type="button" class="chip ${b.status}" data-booking="${b.id}" title="${esc(b.name)}">
            ${esc(b.name)}${b.timeFrom ? `<small>${formatTime(b.timeFrom)}</small>` : ""}
          </button>`
        )
        .join("");
      cells.push(`<div class="day${date === today ? " today" : ""}" data-date="${date}">
        <div class="day-num"><span>${d}</span><span class="add">+</span></div>
        ${chips}
      </div>`);
    }
    while (cells.length % 7) cells.push(`<div class="day out"></div>`);
    $("calGrid").innerHTML = cells.join("");
  }

  $("calGrid").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-booking]");
    if (chip) {
      openActions(chip.dataset.booking);
      return;
    }
    const day = e.target.closest("[data-date]");
    if (day) openBookingForm(null, day.dataset.date);
  });

  // ---------- نموذج الحجز ----------
  // أي رقم عربي يُكتب في أي خانة يتحول مباشرة للإنجليزي
  const HAS_AR_DIGIT = /[٠-٩۰-۹٫]/;
  const isTextField = (el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

  // الكتابة: نستبدل الحرف قبل إدخاله عشان يبقى المؤشر في مكانه
  document.addEventListener(
    "beforeinput",
    (e) => {
      const el = e.target;
      if (!isTextField(el) || e.isComposing || !e.data || !HAS_AR_DIGIT.test(e.data)) return;
      let start, end;
      try {
        start = el.selectionStart;
        end = el.selectionEnd;
      } catch {}
      if (start == null) return;
      e.preventDefault();
      el.setRangeText(toEnDigits(e.data), start, end, "end");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    true
  );

  // اللصق والتعبئة التلقائية: نحوّل القيمة كاملة
  document.addEventListener(
    "input",
    (e) => {
      const el = e.target;
      if (!isTextField(el) || !HAS_AR_DIGIT.test(el.value)) return;
      el.value = toEnDigits(el.value);
    },
    true
  );

  // يعبّي القائمة المنسدلة، ويحافظ على القيمة القديمة حتى لو انحذفت من الإعدادات
  function fillSelect(id, items, value, placeholder = "— اختر —") {
    const list = [...items];
    if (value && !list.includes(value)) list.push(value);
    $(id).innerHTML =
      (placeholder ? `<option value="">${placeholder}</option>` : "") +
      list.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
    $(id).value = value || "";
  }

  const isNoExtras = (x) => !x || x.startsWith("بدون");
  const withMethod = (amount, method) => (method ? `${money(amount)} (${method})` : money(amount));

  function updateRemaining() {
    const rem = num($("bTotal").value) - num($("bDeposit").value);
    $("bRemaining").textContent = money(rem);
  }
  $("bTotal").addEventListener("input", updateRemaining);
  $("bDeposit").addEventListener("input", updateRemaining);

  function openBookingForm(bookingId, date) {
    const b = bookingId ? state.bookings.find((x) => x.id === bookingId) : null;
    const s = state.settings;
    fillSelect("bEventType", s.eventTypes, b ? b.eventType : "");
    fillSelect("bService", s.serviceTypes, b ? b.service || "" : s.serviceTypes[0] || "");
    fillSelect("bExtras", s.extras, b ? b.extras || "" : s.extras[0] || "");
    fillSelect("bDepositMethod", s.paymentMethods, b ? b.depositMethod || "" : "");
    fillSelect("bRemainingMethod", s.paymentMethods, b ? b.remainingMethod || "" : "");
    $("bookingModalTitle").textContent = b ? "تعديل الحجز" : `حجز جديد — ${formatDateLong(date)}`;
    $("bId").value = b ? b.id : "";
    $("bDate").value = b ? b.date : date;
    $("bName").value = b ? b.name : "";
    $("bPhone").value = b ? b.phone : "";
    $("bTotal").value = b ? b.total : "";
    $("bDeposit").value = b ? b.deposit : "";
    $("bVenue").value = b ? b.venue || "" : "";
    $("bPackage").value = b ? b.package || "" : "";
    $("bFrom").value = b ? b.timeFrom : "";
    $("bTo").value = b ? b.timeTo : "";
    $("bNotes").value = b ? b.notes : "";
    document.querySelector(`input[name="bStatus"][value="${b ? b.status : "confirmed"}"]`).checked = true;
    updateRemaining();
    openModal("bookingModal");
    setTimeout(() => $("bName").focus(), 50);
  }

  $("bookingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const total = num($("bTotal").value);
    const deposit = num($("bDeposit").value);
    if (deposit > total) {
      toast("العربون أكبر من السعر الإجمالي");
      return;
    }
    const id = $("bId").value;
    const existing = id ? state.bookings.find((x) => x.id === id) : null;
    const booking = {
      id: id || uid(),
      date: $("bDate").value,
      name: $("bName").value.trim(),
      phone: toEnDigits($("bPhone").value.trim()),
      total,
      deposit,
      status: document.querySelector('input[name="bStatus"]:checked').value,
      eventType: $("bEventType").value,
      service: $("bService").value,
      extras: $("bExtras").value,
      depositMethod: $("bDepositMethod").value,
      remainingMethod: $("bRemainingMethod").value,
      venue: $("bVenue").value.trim(),
      package: $("bPackage").value.trim(),
      timeFrom: $("bFrom").value,
      timeTo: $("bTo").value,
      notes: $("bNotes").value.trim(),
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
    };
    if (existing) Object.assign(existing, booking);
    else state.bookings.push(booking);
    persistBookings();
    sync(() => cloud.upsert("bookings", booking));
    closeModal("bookingModal");
    toast(existing ? "تم تعديل الحجز" : "تم إضافة الحجز");
    render();
  });

  // ---------- خيارات الحجز ----------
  function openActions(id) {
    const b = state.bookings.find((x) => x.id === id);
    if (!b) return;
    state.activeBookingId = id;
    $("actionsTitle").textContent = `${b.name} — ${formatDateLong(b.date)}`;
    openModal("actionsModal");
  }

  const activeBooking = () => state.bookings.find((x) => x.id === state.activeBookingId);

  $("actInfo").addEventListener("click", () => {
    closeModal("actionsModal");
    showInfo(activeBooking());
  });
  $("actCopy").addEventListener("click", () => {
    closeModal("actionsModal");
    copyMessage(activeBooking());
  });

  function linkedExpenses(bookingId) {
    return state.expenses.filter((x) => x.bookingId === bookingId);
  }

  function showInfo(b) {
    if (!b) return;
    const exps = linkedExpenses(b.id);
    const expTotal = exps.reduce((s, x) => s + num(x.amount), 0);
    const rows = [
      ["اسم العميل", esc(b.name)],
      ["رقم الجوال", b.phone ? `<a href="tel:${esc(b.phone)}" dir="ltr">${esc(b.phone)}</a>` : "—"],
      ["تاريخ الحدث", formatDateLong(b.date)],
      ["وقت المناسبة", timeRange(b) || "—"],
      ["نوع المناسبة", esc(b.eventType) || "—"],
      ["الموقع / القاعة", esc(b.venue) || "—"],
      ["نوع الخدمة", esc(b.service) || "—"],
      ["الإضافات", esc(b.extras) || "—"],
      ["وصف الباقة", b.package ? esc(b.package).replace(/\n/g, "<br>") : "—"],
      ["الحالة", `<span class="tag ${b.status}">${STATUS_LABELS[b.status]}</span>`],
      ["السعر الإجمالي", money(b.total)],
      ["العربون المدفوع", esc(withMethod(b.deposit, b.depositMethod))],
      ["المتبقي للدفع", `<span class="${remainingOf(b) > 0 ? "neg" : "pos"}">${esc(withMethod(remainingOf(b), b.remainingMethod))}</span>`],
    ];
    if (exps.length) {
      rows.push(["مصاريف الحجز", money(expTotal)]);
      rows.push(["صافي الحجز", `<span class="${num(b.total) - expTotal >= 0 ? "pos" : "neg"}">${money(num(b.total) - expTotal)}</span>`]);
    }
    if (b.notes) rows.push(["ملاحظات", esc(b.notes).replace(/\n/g, "<br>")]);
    $("infoBody").innerHTML = `<dl class="info-list">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
    openModal("infoModal");
  }

  $("infoEdit").addEventListener("click", () => {
    closeModal("infoModal");
    openBookingForm(state.activeBookingId);
  });
  $("infoCopy").addEventListener("click", () => copyMessage(activeBooking()));
  $("infoDelete").addEventListener("click", async () => {
    const b = activeBooking();
    if (!b || !(await askConfirm(`حذف حجز ${b.name}؟`, "حذف"))) return;
    state.bookings = state.bookings.filter((x) => x.id !== b.id);
    // المصاريف المرتبطة تبقى لكن تصير مصاريف عامة
    const unlinked = state.expenses.filter((x) => x.bookingId === b.id);
    unlinked.forEach((x) => (x.bookingId = ""));
    persistBookings();
    persistExpenses();
    sync(async () => {
      await cloud.remove("bookings", b.id);
      await cloud.upsert("expenses", unlinked);
    });
    closeModal("infoModal");
    toast("تم حذف الحجز");
    render();
  });

  // ---------- رسالة الحجز ----------
  function buildMessage(b) {
    const s = state.settings;
    const line = "━━━━━━━━━━━━";
    const parts = [
      `🎧 تأكيد حجز ${s.name}`.trim(),
      line,
      `👤 اسم العميل: ${b.name}`,
      b.phone ? `📱 رقم الجوال: ${b.phone}` : "",
      `📅 تاريخ الحدث: ${formatDateLong(b.date)}`,
      timeRange(b) ? `⏰ الوقت: ${timeRange(b)}` : "",
      b.eventType ? `🎉 نوع المناسبة: ${b.eventType}` : "",
      b.venue ? `📍 الموقع / القاعة: ${b.venue}` : "",
      b.service ? `🎛️ نوع الخدمة: ${b.service}` : "",
      !isNoExtras(b.extras) ? `🔊 الإضافات: ${b.extras}` : "",
      b.package ? `🎶 الباقة: ${b.package}` : "",
      `📌 حالة الحجز: ${STATUS_LABELS[b.status]}`,
      line,
      `💰 السعر الإجمالي: ${money(b.total)}`,
      `💵 العربون المدفوع: ${withMethod(b.deposit, b.depositMethod)}`,
      `🧾 المتبقي: ${withMethod(remainingOf(b), b.remainingMethod)}`,
      line,
      s.policy ? `📋 ${s.policy.trim()}` : "",
      s.policy ? line : "",
      s.location ? `🗺️ ${s.location}` : "",
      s.phone ? `📞 للتواصل: ${s.phone}` : "",
      "Feel the Music 🎵",
    ];
    return parts.filter(Boolean).join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {}
      ta.remove();
      return ok;
    }
  }

  async function copyMessage(b) {
    if (!b) return;
    const ok = await copyText(buildMessage(b));
    toast(ok ? "تم نسخ رسالة الحجز ✓" : "تعذّر النسخ");
  }

  // ---------- المصاريف ----------
  $("expCategory").innerHTML = EXPENSE_CATEGORIES.map((c) => `<option>${c}</option>`).join("");

  function fillExpenseBookingSelect(selected) {
    const prefix = ($("expDate").value || monthPrefix(state.year, state.month)).slice(0, 7);
    const list = state.bookings.filter((b) => b.date.startsWith(prefix) || b.id === selected).sort(sortBookings);
    $("expBooking").innerHTML =
      `<option value="">— مصروف عام (بدون حجز) —</option>` +
      list.map((b) => `<option value="${b.id}">${b.date} — ${esc(b.name)}</option>`).join("");
    $("expBooking").value = selected || "";
  }
  $("expDate").addEventListener("change", () => fillExpenseBookingSelect($("expBooking").value));

  function defaultExpenseDate() {
    const t = new Date();
    if (t.getFullYear() === state.year && t.getMonth() === state.month) return todayStr();
    return ymd(state.year, state.month, 1);
  }

  function resetExpenseForm() {
    $("expenseForm").reset();
    $("expId").value = "";
    $("expDate").value = defaultExpenseDate();
    $("expSubmit").textContent = "إضافة مصروف";
    $("expCancel").classList.add("hidden");
    fillExpenseBookingSelect("");
  }
  $("expCancel").addEventListener("click", resetExpenseForm);

  $("expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("expId").value;
    const exp = {
      id: id || uid(),
      date: $("expDate").value,
      title: $("expTitle").value.trim(),
      category: $("expCategory").value,
      amount: num($("expAmount").value),
      bookingId: $("expBooking").value,
    };
    const existing = id ? state.expenses.find((x) => x.id === id) : null;
    if (existing) Object.assign(existing, exp);
    else state.expenses.push(exp);
    persistExpenses();
    sync(() => cloud.upsert("expenses", exp));
    toast(existing ? "تم تعديل المصروف" : "تم إضافة المصروف");
    const [y, m] = exp.date.split("-").map(Number);
    state.year = y;
    state.month = m - 1;
    render();
    resetExpenseForm();
  });

  function renderExpenses() {
    if (!$("expId").value) {
      $("expDate").value = defaultExpenseDate();
      fillExpenseBookingSelect($("expBooking").value);
    }
    const prefix = monthPrefix(state.year, state.month);
    const list = state.expenses.filter((x) => x.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date));
    const total = list.reduce((s, x) => s + num(x.amount), 0);
    $("expTotal").textContent = money(total);
    if (!list.length) {
      $("expList").innerHTML = `<div class="empty">لا توجد مصاريف في ${MONTHS[state.month]}</div>`;
      return;
    }
    $("expList").innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>التاريخ</th><th>البيان</th><th>التصنيف</th><th>الحجز</th><th class="num">المبلغ</th><th></th></tr></thead>
      <tbody>${list
        .map((x) => {
          const b = x.bookingId ? state.bookings.find((bk) => bk.id === x.bookingId) : null;
          return `<tr>
            <td>${x.date}</td>
            <td>${esc(x.title)}</td>
            <td><span class="tag">${esc(x.category)}</span></td>
            <td>${b ? esc(b.name) : '<span class="muted">عام</span>'}</td>
            <td class="num">${money(x.amount)}</td>
            <td><button class="link-btn" data-edit-exp="${x.id}">تعديل</button><button class="link-btn danger" data-del-exp="${x.id}">حذف</button></td>
          </tr>`;
        })
        .join("")}
        <tr class="total-row"><td colspan="4">الإجمالي</td><td class="num">${money(total)}</td><td></td></tr>
      </tbody></table></div>`;
  }

  $("expList").addEventListener("click", async (e) => {
    const editId = e.target.closest("[data-edit-exp]")?.dataset.editExp;
    const delId = e.target.closest("[data-del-exp]")?.dataset.delExp;
    if (editId) {
      const x = state.expenses.find((ex) => ex.id === editId);
      if (!x) return;
      $("expId").value = x.id;
      $("expDate").value = x.date;
      $("expTitle").value = x.title;
      $("expCategory").value = x.category;
      $("expAmount").value = x.amount;
      fillExpenseBookingSelect(x.bookingId);
      $("expSubmit").textContent = "حفظ التعديل";
      $("expCancel").classList.remove("hidden");
      $("expenseForm").scrollIntoView({ behavior: "smooth" });
    }
    if (delId && (await askConfirm("حذف هذا المصروف؟", "حذف"))) {
      state.expenses = state.expenses.filter((ex) => ex.id !== delId);
      persistExpenses();
      sync(() => cloud.remove("expenses", delId));
      if ($("expId").value === delId) resetExpenseForm();
      renderExpenses();
    }
  });

  // ---------- المالية ----------
  function monthSummary(y, m) {
    const prefix = monthPrefix(y, m);
    const bookings = state.bookings.filter((b) => b.date.startsWith(prefix));
    const confirmed = bookings.filter((b) => b.status === "confirmed");
    const pending = bookings.filter((b) => b.status !== "confirmed");
    const expenses = state.expenses.filter((x) => x.date.startsWith(prefix));
    const revenue = confirmed.reduce((s, b) => s + num(b.total), 0);
    const collected = confirmed.reduce((s, b) => s + num(b.deposit), 0);
    const expTotal = expenses.reduce((s, x) => s + num(x.amount), 0);
    return {
      bookings,
      confirmed,
      pending,
      expenses,
      revenue,
      collected,
      remaining: revenue - collected,
      pendingValue: pending.reduce((s, b) => s + num(b.total), 0),
      expTotal,
      net: revenue - expTotal,
    };
  }

  function renderFinance() {
    const { year, month } = state;
    const s = monthSummary(year, month);
    const kpi = (label, value, cls = "") => `<div class="kpi ${cls}"><div class="v">${value}</div><div class="l">${label}</div></div>`;
    $("finKpis").innerHTML = [
      kpi("عدد الحجوزات المؤكدة", s.confirmed.length),
      kpi("إجمالي الإيرادات", money(s.revenue)),
      kpi("المحصّل (العربون)", money(s.collected)),
      kpi("المتبقي على العملاء", money(s.remaining)),
      kpi("إجمالي المصاريف", money(s.expTotal)),
      kpi("صافي الربح", money(s.net), "net"),
    ].join("");

    // صافي كل حجز: قيمة الحجز - مصاريفه المرتبطة - نصيبه من المصاريف العامة
    const general = s.expenses.filter((x) => !x.bookingId || !s.confirmed.some((b) => b.id === x.bookingId));
    const generalTotal = general.reduce((acc, x) => acc + num(x.amount), 0);
    const share = s.confirmed.length ? generalTotal / s.confirmed.length : 0;

    if (!s.bookings.length) {
      $("finBookings").innerHTML = `<div class="empty">لا توجد حجوزات في ${MONTHS[month]}${
        s.expTotal ? ` — المصاريف: ${money(s.expTotal)}` : ""
      }</div>`;
    } else {
      const rows = s.bookings
        .slice()
        .sort(sortBookings)
        .map((b) => {
          if (b.status !== "confirmed") {
            return `<tr class="muted"><td>${b.date}</td><td>${esc(b.name)}</td><td><span class="tag pending">غير مؤكد</span></td>
              <td class="num">${money(b.total)}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`;
          }
          const own = linkedExpenses(b.id).filter((x) => x.date.startsWith(monthPrefix(year, month))).reduce((acc, x) => acc + num(x.amount), 0);
          const net = num(b.total) - own - share;
          return `<tr><td>${b.date}</td><td>${esc(b.name)}</td><td><span class="tag confirmed">مؤكد</span></td>
            <td class="num">${money(b.total)}</td><td class="num">${money(own)}</td><td class="num">${money(share)}</td>
            <td class="num ${net >= 0 ? "pos" : "neg"}">${money(net)}</td></tr>`;
        })
        .join("");
      $("finBookings").innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>التاريخ</th><th>العميل</th><th>الحالة</th><th class="num">قيمة الحجز</th><th class="num">مصاريف الحجز</th><th class="num">حصته من المصاريف العامة</th><th class="num">الصافي</th></tr></thead>
        <tbody>${rows}
          <tr class="total-row"><td colspan="3">الإجمالي (المؤكد)</td><td class="num">${money(s.revenue)}</td>
          <td class="num" colspan="2">${money(s.expTotal)}</td><td class="num ${s.net >= 0 ? "pos" : "neg"}">${money(s.net)}</td></tr>
        </tbody></table></div>
        <p class="muted">المصاريف العامة (غير المرتبطة بحجز) تُوزَّع بالتساوي على الحجوزات المؤكدة في الشهر.${
          s.pending.length ? ` الحجوزات غير المؤكدة (${money(s.pendingValue)}) لا تُحسب ضمن الإيرادات.` : ""
        }</p>`;
    }

    $("finYear").textContent = year;
    let tRev = 0, tExp = 0, tCount = 0;
    const yearRows = MONTHS.map((name, m) => {
      const ms = monthSummary(year, m);
      tRev += ms.revenue;
      tExp += ms.expTotal;
      tCount += ms.confirmed.length;
      return `<tr${m === month ? ' class="total-row"' : ""}><td>${name}</td><td class="num">${ms.confirmed.length}</td>
        <td class="num">${money(ms.revenue)}</td><td class="num">${money(ms.expTotal)}</td>
        <td class="num ${ms.net > 0 ? "pos" : ms.net < 0 ? "neg" : ""}">${money(ms.net)}</td></tr>`;
    }).join("");
    $("finYearTable").innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>الشهر</th><th class="num">الحجوزات</th><th class="num">الإيرادات</th><th class="num">المصاريف</th><th class="num">الصافي</th></tr></thead>
      <tbody>${yearRows}
        <tr class="total-row"><td>المجموع</td><td class="num">${tCount}</td><td class="num">${money(tRev)}</td>
        <td class="num">${money(tExp)}</td><td class="num ${tRev - tExp >= 0 ? "pos" : "neg"}">${money(tRev - tExp)}</td></tr>
      </tbody></table></div>`;
  }

  // ---------- الإعدادات ----------
  function renderSettings() {
    const s = state.settings;
    $("setName").value = s.name;
    $("setPhone").value = s.phone;
    $("setLocation").value = s.location;
    $("setPolicy").value = s.policy;
    renderListEditors();
  }

  function listRow(value = "") {
    return `<div class="list-row"><input type="text" value="${esc(value)}" /><button type="button" class="icon-btn" data-remove-item title="حذف">×</button></div>`;
  }

  function renderListEditors() {
    $("listEditors").innerHTML = OPTION_LISTS.map(
      ({ key, label }) => `<div class="list-editor" data-list="${key}">
        <h4>${label}</h4>
        <div class="list-rows">${state.settings[key].map((v) => listRow(v)).join("")}</div>
        <button type="button" class="add-item" data-add-item>+ إضافة خيار</button>
      </div>`
    ).join("");
  }

  $("listEditors").addEventListener("click", (e) => {
    if (e.target.closest("[data-remove-item]")) e.target.closest(".list-row").remove();
    const add = e.target.closest("[data-add-item]");
    if (add) {
      const rows = add.parentElement.querySelector(".list-rows");
      rows.insertAdjacentHTML("beforeend", listRow());
      rows.lastElementChild.querySelector("input").focus();
    }
  });

  function readListEditors() {
    const out = {};
    OPTION_LISTS.forEach(({ key }) => {
      out[key] = [...document.querySelectorAll(`[data-list="${key}"] .list-row input`)]
        .map((i) => i.value.trim())
        .filter(Boolean);
    });
    return out;
  }

  $("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.settings = {
      name: $("setName").value.trim(),
      phone: $("setPhone").value.trim(),
      location: $("setLocation").value.trim(),
      policy: $("setPolicy").value,
      ...readListEditors(),
    };
    persistSettings();
    sync(() => cloud.saveSettings(state.settings));
    $("savedMsg").classList.remove("hidden");
    setTimeout(() => $("savedMsg").classList.add("hidden"), 2000);
  });

  const backupJson = () =>
    JSON.stringify({ bookings: state.bookings, expenses: state.expenses, settings: state.settings, exportedAt: new Date().toISOString() }, null, 2);

  $("copyBackupBtn").addEventListener("click", async () => {
    const ok = await copyText(backupJson());
    toast(ok ? "تم نسخ البيانات، احفظها في ملاحظة أو ملف" : "تعذّر النسخ");
  });

  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([backupJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `djremax-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.bookings) || !Array.isArray(data.expenses)) throw new Error("bad file");
      if (!(await askConfirm("سيتم استبدال البيانات الحالية بالنسخة المستوردة. متابعة؟", "استيراد"))) return;
      state.bookings = data.bookings;
      state.expenses = data.expenses;
      state.settings = normalizeSettings(data.settings);
      persistBookings();
      persistExpenses();
      persistSettings();
      sync(() => cloud.replaceAll(state));
      toast("تم استيراد النسخة ✓");
      render();
    } catch {
      toast("الملف غير صالح");
    }
  });

  // ---------- المزامنة أونلاين ----------
  let syncing = 0;

  function setSyncStatus(kind) {
    const el = $("syncStatus");
    if (!cloud) return;
    const labels = { saving: "جاري الحفظ…", ok: "محفوظ أونلاين ✓", error: "غير محفوظ أونلاين", loading: "جاري التحميل…" };
    el.textContent = labels[kind];
    el.className = `sync-pill ${kind}`;
  }

  function isDirty() {
    try {
      return localStorage.getItem(DIRTY_KEY) === "1";
    } catch {
      return false;
    }
  }
  function setDirty(v) {
    try {
      if (v) localStorage.setItem(DIRTY_KEY, "1");
      else localStorage.removeItem(DIRTY_KEY);
    } catch {}
  }

  // كل تعديل يُحفظ على الجهاز أولًا ثم يُرسل أونلاين. لو فشل الإرسال، نرفع النسخة الكاملة في المزامنة القادمة.
  function sync(fn) {
    if (!cloud) return;
    syncing++;
    setSyncStatus("saving");
    fn()
      .then(() => {
        if (!isDirty()) setSyncStatus("ok");
      })
      .catch((err) => {
        console.error(err);
        setDirty(true);
        setSyncStatus("error");
        toast("تعذّر الحفظ أونلاين، بيتم الرفع تلقائيًا لما يرجع الاتصال");
      })
      .finally(() => syncing--);
  }

  function applyData(data) {
    state.bookings = data.bookings;
    state.expenses = data.expenses;
    state.settings = normalizeSettings(data.settings);
    persistBookings();
    persistExpenses();
    persistSettings();
  }

  async function loadFromCloud() {
    if (syncing) return;
    setSyncStatus("loading");
    try {
      if (isDirty()) {
        await cloud.replaceAll(state);
        setDirty(false);
      }
      const data = await cloud.fetchAll();
      const cloudEmpty = !data.bookings.length && !data.expenses.length && !data.settings;
      const localHasData = state.bookings.length || state.expenses.length;
      if (cloudEmpty && localHasData) {
        if (await askConfirm("عندك بيانات محفوظة على هذا الجهاز. تبي ترفعها لحسابك أونلاين؟", "رفع البيانات")) {
          await cloud.replaceAll(state);
          setSyncStatus("ok");
          render();
          return;
        }
      }
      applyData(data);
      setSyncStatus("ok");
      render();
    } catch (err) {
      console.error(err);
      setSyncStatus("error");
      toast("تعذّر تحميل البيانات أونلاين، المعروض هو آخر نسخة على الجهاز");
    }
  }

  function renderAccount(sess) {
    if (!cloud) {
      $("accountInfo").textContent = "البيانات محفوظة على هذا الجهاز فقط. للمزامنة بين الأجهزة، اربط قاعدة البيانات في ملف config.js.";
      return;
    }
    $("accountInfo").textContent = sess ? `مسجّل دخول بـ ${sess.user.email}. بياناتك تتزامن بين كل أجهزتك.` : "";
    $("signOutBtn").classList.toggle("hidden", !sess);
    $("syncNowBtn").classList.toggle("hidden", !sess);
  }

  function showLogin(show) {
    $("loginScreen").classList.toggle("hidden", !show);
    if (show) setTimeout(() => $("loginEmail").focus(), 50);
  }

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginError").classList.add("hidden");
    $("loginBtn").disabled = true;
    try {
      await cloud.signIn($("loginEmail").value.trim(), $("loginPassword").value);
      $("loginPassword").value = "";
      showLogin(false);
      renderAccount(await cloud.session());
      await loadFromCloud();
    } catch (err) {
      $("loginError").textContent = /invalid/i.test(err.message || "")
        ? "البريد أو كلمة المرور غير صحيحة"
        : "تعذّر تسجيل الدخول، تأكد من الاتصال بالإنترنت";
      $("loginError").classList.remove("hidden");
    } finally {
      $("loginBtn").disabled = false;
    }
  });

  $("signOutBtn").addEventListener("click", async () => {
    if (!(await askConfirm("تسجيل الخروج من هذا الجهاز؟", "خروج"))) return;
    await cloud.signOut();
    // نمسح النسخة المحلية عشان ما تبقى بيانات العملاء على الجهاز
    applyData({ bookings: [], expenses: [], settings: null });
    setDirty(false);
    render();
    showLogin(true);
  });

  $("syncNowBtn").addEventListener("click", loadFromCloud);

  document.addEventListener("visibilitychange", async () => {
    if (!cloud || document.visibilityState !== "visible") return;
    const anyOpen = [...document.querySelectorAll(".overlay")].some((o) => !o.classList.contains("hidden"));
    if (!anyOpen && (await cloud.session())) loadFromCloud();
  });

  // ---------- البداية ----------
  let startPage = "bookings";
  try {
    startPage = localStorage.getItem("djremax_page") || "bookings";
  } catch {}
  setPage(PAGE_TITLES[startPage] ? startPage : "bookings");

  (async () => {
    if (!cloud) {
      renderAccount(null);
      return;
    }
    $("syncStatus").classList.remove("hidden");
    const sess = await cloud.session().catch(() => null);
    renderAccount(sess);
    if (sess) loadFromCloud();
    else showLogin(true);
  })();
})();
