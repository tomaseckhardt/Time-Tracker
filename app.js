const STORAGE_KEY = "tracker-data-v1";
const THEME_STORAGE_KEY = "tracker-theme-v1";
const DEFAULT_THEME = "sunrise";
const APP_VERSION = "v1.5.0";

const state = {
  active: null,
  entries: [],
};

let trackedDayKey = dayKey(Date.now());

const activityButtons = Array.from(document.querySelectorAll(".activity-btn"));
const stopBtn = document.getElementById("stopBtn");
const sessionTimer = document.getElementById("sessionTimer");
const activeBadge = document.getElementById("activeBadge");
const activeBadgeText = document.getElementById("activeBadgeText");
const entriesBody = document.getElementById("entriesBody");
const todayLabel = document.getElementById("todayLabel");

const totalCaroda = document.getElementById("totalCaroda");
const totalAYM = document.getElementById("totalAYM");
const totalTests = document.getElementById("totalTests");
const totalAll = document.getElementById("totalAll");
const appVersion = document.getElementById("appVersion");
const themeSelect = document.getElementById("themeSelect");
const exportWeeklyBtn = document.getElementById("exportWeeklyBtn");
const manualActivityInput = document.getElementById("manualActivityInput");
const manualDateInput = document.getElementById("manualDateInput");
const manualStartInput = document.getElementById("manualStartInput");
const manualEndInput = document.getElementById("manualEndInput");
const manualAddBtn = document.getElementById("manualAddBtn");
const manualStatus = document.getElementById("manualStatus");
const startConfirmOverlay = document.getElementById("startConfirmOverlay");
const startConfirmMessage = document.getElementById("startConfirmMessage");
const startConfirmOk = document.getElementById("startConfirmOk");
const startConfirmCancel = document.getElementById("startConfirmCancel");

let startConfirmResolver = null;

function askStartConfirmation(message) {
  if (!startConfirmOverlay || !startConfirmMessage || !startConfirmOk || !startConfirmCancel) {
    return Promise.resolve(window.confirm(message));
  }

  if (startConfirmResolver) {
    startConfirmResolver(false);
    startConfirmResolver = null;
  }

  startConfirmMessage.textContent = message;
  startConfirmOverlay.classList.remove("is-hidden");
  startConfirmOverlay.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    startConfirmResolver = resolve;
    startConfirmOk.focus();
  });
}

function finishStartConfirmation(accepted) {
  if (!startConfirmOverlay) {
    return;
  }

  startConfirmOverlay.classList.add("is-hidden");
  startConfirmOverlay.setAttribute("aria-hidden", "true");

  if (!startConfirmResolver) {
    return;
  }

  const resolve = startConfirmResolver;
  startConfirmResolver = null;
  resolve(accepted);
}

if (startConfirmOk) {
  startConfirmOk.addEventListener("click", () => {
    finishStartConfirmation(true);
  });
}

if (startConfirmCancel) {
  startConfirmCancel.addEventListener("click", () => {
    finishStartConfirmation(false);
  });
}

if (startConfirmOverlay) {
  startConfirmOverlay.addEventListener("click", (event) => {
    if (event.target === startConfirmOverlay) {
      finishStartConfirmation(false);
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && startConfirmResolver) {
    finishStartConfirmation(false);
  }
});

function applyTheme(themeName) {
  document.body.dataset.theme = themeName;
  if (themeSelect) {
    themeSelect.value = themeName;
  }
}

function loadTheme() {
  const savedThemeRaw = localStorage.getItem(THEME_STORAGE_KEY);
  const savedTheme = savedThemeRaw === "r2b2" || savedThemeRaw === "caroda"
    ? "r2b2-caroda"
    : savedThemeRaw;

  const validThemes = ["sunrise", "slate", "citrus", "r2b2-caroda"];
  if (savedTheme && validThemes.includes(savedTheme)) {
    applyTheme(savedTheme);
    return;
  }

  applyTheme(DEFAULT_THEME);
}

function getNow() {
  return Date.now();
}

function dayKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatClock(ts) {
  return new Date(ts).toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeInputValue(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function parseLocalDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return null;
  }

  const [y, m, d] = dateValue.split("-").map(Number);
  const [hh, mm] = timeValue.split(":").map(Number);
  if (![y, m, d, hh, mm].every(Number.isFinite)) {
    return null;
  }

  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

function setManualStatus(message, isError = false) {
  if (!manualStatus) {
    return;
  }

  manualStatus.textContent = message;
  manualStatus.classList.toggle("error", Boolean(isError));
  manualStatus.classList.toggle("success", !isError && Boolean(message));
}

function setManualDefaults() {
  if (!manualDateInput || !manualStartInput || !manualEndInput) {
    return;
  }

  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60000);
  manualDateInput.value = formatDateInputValue(now);
  manualStartInput.value = formatTimeInputValue(start);
  manualEndInput.value = formatTimeInputValue(now);
}

function addManualEntry() {
  if (!manualActivityInput || !manualDateInput || !manualStartInput || !manualEndInput) {
    return;
  }

  const startTs = parseLocalDateTime(manualDateInput.value, manualStartInput.value);
  const endTs = parseLocalDateTime(manualDateInput.value, manualEndInput.value);

  if (startTs === null || endTs === null) {
    setManualStatus("Vyplň prosím datum a čas Od/Do.", true);
    return;
  }

  if (endTs <= startTs) {
    setManualStatus("Čas Do musí být později než čas Od.", true);
    return;
  }

  const durationMs = endTs - startTs;
  state.entries.push({
    activity: manualActivityInput.value,
    startTs,
    endTs,
    durationMs,
    dayKey: dayKey(startTs),
  });

  save();
  render();
  setManualStatus("Záznam byl přidán.");
}

function formatHoursFromMs(ms) {
  return (ms / 3600000).toFixed(2);
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateCz(date) {
  const d = new Date(date);
  const monthNames = [
    "leden",
    "unor",
    "brezen",
    "duben",
    "kveten",
    "cerven",
    "cervenec",
    "srpen",
    "zari",
    "rijen",
    "listopad",
    "prosinec",
  ];
  return `${d.getDate()}. ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function getWeekKey(ts) {
  const start = getStartOfWeek(new Date(ts));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${isoDate(start)}_to_${isoDate(end)}`;
}

function getEntriesForExport() {
  const allEntries = [...state.entries];

  if (state.active) {
    const nowTs = getNow();
    allEntries.push({
      activity: state.active.activity,
      startTs: state.active.startTs,
      endTs: nowTs,
      durationMs: nowTs - state.active.startTs,
    });
  }

  return allEntries;
}

function buildWeeklySummaryRows() {
  const entries = getEntriesForExport();
  const activityNames = ["Caroda", "AYM", "Automatizované testy"];
  const byWeek = new Map();

  for (const entry of entries) {
    const weekStart = getStartOfWeek(new Date(entry.startTs));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekKey = getWeekKey(entry.startTs);
    const weekLabel = `${formatDateCz(weekStart)} - ${formatDateCz(weekEnd)}`;

    if (!byWeek.has(weekKey)) {
      byWeek.set(weekKey, {
        week: weekLabel,
        weekStartTs: weekStart.getTime(),
        Caroda: 0,
        AYM: 0,
        "Automatizované testy": 0,
      });
    }

    const weekData = byWeek.get(weekKey);
    if (activityNames.includes(entry.activity)) {
      weekData[entry.activity] += entry.durationMs;
    }
  }

  return Array.from(byWeek.values())
    .sort((a, b) => a.weekStartTs - b.weekStartTs)
    .map(({ weekStartTs, ...rest }) => rest);
}

function buildWeeklyCsv(rows) {
  const header = [
    "Týden",
    "Caroda (h)",
    "AYM (h)",
    "Automatizované testy (h)",
    "Celkově (h)",
  ];

  const lines = [header.join(";")];
  for (const row of rows) {
    const totalMs = row.Caroda + row.AYM + row["Automatizované testy"];
    lines.push([
      row.week,
      formatHoursFromMs(row.Caroda),
      formatHoursFromMs(row.AYM),
      formatHoursFromMs(row["Automatizované testy"]),
      formatHoursFromMs(totalMs),
    ].join(";"));
  }

  return lines.join("\n");
}

function openWeeklyReportPage(rows) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    window.alert("Prohlizec zablokoval nove okno. Povol prosim popup pro tento web.");
    return;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const csvContent = buildWeeklyCsv(rows);
  const tableRows = rows
    .map((row) => {
      const totalMs = row.Caroda + row.AYM + row["Automatizované testy"];
      return `<tr>
        <td>${row.week}</td>
        <td>${formatHoursFromMs(row.Caroda)}</td>
        <td>${formatHoursFromMs(row.AYM)}</td>
        <td>${formatHoursFromMs(row["Automatizované testy"])}</td>
        <td><strong>${formatHoursFromMs(totalMs)}</strong></td>
      </tr>`;
    })
    .join("");

  reportWindow.document.write(`<!doctype html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tydenni report</title>
  <style>
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #f5f7fb;
      color: #1f2a37;
    }

    main {
      width: min(980px, 94vw);
      margin: 22px auto;
      background: #ffffff;
      border: 1px solid #d8e0ea;
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 8px 24px rgba(21, 39, 62, 0.08);
    }

    h1 {
      margin: 0 0 6px;
      font-size: 1.4rem;
    }

    p {
      margin: 0 0 14px;
      color: #4b5563;
    }

    .actions {
      margin-bottom: 14px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    button {
      border: 0;
      border-radius: 9px;
      padding: 10px 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .download {
      background: #0f766e;
      color: #ffffff;
    }

    .sheets {
      background: #1a73e8;
      color: #ffffff;
    }

    .print {
      background: #e2e8f0;
      color: #1f2a37;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      border-bottom: 1px solid #e4e9f1;
      padding: 10px 8px;
      text-align: left;
    }

    th {
      color: #4b5563;
      font-weight: 600;
      background: #f8fafc;
    }

    @media print {
      body {
        background: #ffffff;
      }

      main {
        border: 0;
        box-shadow: none;
        margin: 0;
        width: 100%;
      }

      .actions {
        display: none;
      }
    }
  </style>
</head>
<body>
  <main>
    <h1>Týdenní souhrn aktivit</h1>
    <p>Vytvořeno: ${stamp}</p>
    <div class="actions">
      <button class="download" id="downloadCsvBtn">Stáhnout CSV pro Excel</button>
      <button class="sheets" id="openSheetsBtn">Otevřít v Google Sheets</button>
      <button class="print" id="printBtn">Tisk</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>Týden</th>
          <th>Caroda (h)</th>
          <th>AYM (h)</th>
          <th>Automatizované testy (h)</th>
          <th>Celkově (h)</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </main>
</body>
</html>`);
  reportWindow.document.close();

  const downloadBtn = reportWindow.document.getElementById("downloadCsvBtn");
  const openSheetsBtn = reportWindow.document.getElementById("openSheetsBtn");
  const printBtn = reportWindow.document.getElementById("printBtn");

  openSheetsBtn.addEventListener("click", async () => {
    try {
      await reportWindow.navigator.clipboard.writeText(csvContent);
      openSheetsBtn.textContent = "✓ Zkopírováno! Vlož Ctrl+Shift+V";
    } catch {
      openSheetsBtn.textContent = "Otevírám Sheets...";
    }
    reportWindow.open("https://sheets.new", "_blank");
    setTimeout(() => { openSheetsBtn.textContent = "Otevřít v Google Sheets"; }, 4000);
  });

  downloadBtn.addEventListener("click", () => {
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = reportWindow.URL.createObjectURL(blob);
    const a = reportWindow.document.createElement("a");
    a.href = url;
    a.download = `time-tracker-weekly-${stamp}.csv`;
    reportWindow.document.body.appendChild(a);
    a.click();
    a.remove();
    reportWindow.URL.revokeObjectURL(url);
  });

  printBtn.addEventListener("click", () => {
    reportWindow.print();
  });
}

function exportWeeklySummary() {
  const rows = buildWeeklySummaryRows();
  if (rows.length === 0) {
    window.alert("Zatím nejsou žádné záznamy k exportu.");
    return;
  }

  openWeeklyReportPage(rows);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      state.active = parsed.active ?? null;
      state.entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    }
  } catch {
    state.active = null;
    state.entries = [];
  }
}

function stopActive(nowTs = getNow()) {
  if (!state.active) {
    return;
  }

  const durationMs = nowTs - state.active.startTs;
  state.entries.push({
    activity: state.active.activity,
    startTs: state.active.startTs,
    endTs: nowTs,
    durationMs,
    dayKey: dayKey(state.active.startTs),
  });

  state.active = null;
  save();
}

async function startActivity(activity) {
  const nowTs = getNow();

  if (state.active && state.active.activity === activity) {
    return;
  }

  const confirmMessage = state.active
    ? `Právě běží ${state.active.activity}. Opravdu chceš přepnout na ${activity}?`
    : `Opravdu chceš spustit aktivitu ${activity}?`;

  const confirmed = await askStartConfirmation(confirmMessage);
  if (!confirmed) {
    return;
  }

  if (state.active) {
    stopActive(nowTs);
  }

  state.active = {
    activity,
    startTs: nowTs,
  };

  save();
  render();
}

function computeTodayTotals() {
  const today = dayKey(getNow());
  const totals = {
    Caroda: 0,
    AYM: 0,
    "Automatizované testy": 0,
  };

  for (const entry of state.entries) {
    if (entry.dayKey === today && totals[entry.activity] !== undefined) {
      totals[entry.activity] += entry.durationMs;
    }
  }

  if (state.active && dayKey(state.active.startTs) === today && totals[state.active.activity] !== undefined) {
    totals[state.active.activity] += getNow() - state.active.startTs;
  }

  return totals;
}

function renderButtons() {
  for (const btn of activityButtons) {
    const isActive = state.active && state.active.activity === btn.dataset.activity;
    btn.classList.toggle("active", Boolean(isActive));
  }

  stopBtn.disabled = !state.active;
}

function renderActiveStatus() {
  if (!state.active) {
    if (activeBadge && activeBadgeText) {
      activeBadgeText.textContent = "Nic neběží";
      activeBadge.classList.remove("is-hidden", "is-running");
      activeBadge.classList.add("is-idle");
    }
    sessionTimer.textContent = "00:00:00";
    return;
  }

  const elapsed = getNow() - state.active.startTs;
  if (activeBadge && activeBadgeText) {
    activeBadgeText.textContent = `Běží: ${state.active.activity}`;
    activeBadge.classList.remove("is-hidden", "is-idle");
    activeBadge.classList.add("is-running");
  }
  sessionTimer.textContent = formatTime(elapsed);
}

function renderTotals() {
  const totals = computeTodayTotals();
  totalCaroda.textContent = formatTime(totals.Caroda);
  totalAYM.textContent = formatTime(totals.AYM);
  totalTests.textContent = formatTime(totals["Automatizované testy"]);
  totalAll.textContent = formatTime(totals.Caroda + totals.AYM + totals["Automatizované testy"]);
}

const ENTRIES_VISIBLE = 5;
let entriesExpanded = false;

function renderEntries() {
  const today = dayKey(getNow());
  const todayEntries = [];

  for (let i = state.entries.length - 1; i >= 0; i -= 1) {
    const entry = state.entries[i];
    if (entry.dayKey === today) {
      todayEntries.push({ entry, originalIndex: i });
    }
  }

  const toggleBtn = document.getElementById('entriesToggleBtn');

  if (todayEntries.length === 0) {
    entriesBody.innerHTML = '<tr><td colspan="5" class="empty">Zatím žádné záznamy.</td></tr>';
    toggleBtn.style.display = 'none';
    return;
  }

  const visible = entriesExpanded ? todayEntries : todayEntries.slice(0, ENTRIES_VISIBLE);

  entriesBody.innerHTML = visible
    .map(({ entry, originalIndex }) => {
      return `<tr>
        <td>${entry.activity}</td>
        <td>${formatClock(entry.startTs)}</td>
        <td>${formatClock(entry.endTs)}</td>
        <td>${formatTime(entry.durationMs)}</td>
        <td class="entry-actions">
          <button class="entry-action-btn edit" data-entry-index="${originalIndex}" type="button">Upravit</button>
          <button class="entry-action-btn delete" data-entry-index="${originalIndex}" type="button">Smazat</button>
        </td>
      </tr>`;
    })
    .join("");

  if (todayEntries.length > ENTRIES_VISIBLE) {
    toggleBtn.style.display = '';
    const hidden = todayEntries.length - ENTRIES_VISIBLE;
    toggleBtn.textContent = entriesExpanded
      ? 'Zobrazit méně ▲'
      : `Zobrazit vše (${hidden} další) ▼`;
    toggleBtn.onclick = () => {
      entriesExpanded = !entriesExpanded;
      renderEntries();
    };
  } else {
    toggleBtn.style.display = 'none';
  }
}

function editEntry(index) {
  const entry = state.entries[index];
  if (!entry) {
    return;
  }

  const currentMinutes = Math.max(1, Math.round(entry.durationMs / 60000));
  const raw = window.prompt("Upravit trvání v minutách:", String(currentMinutes));
  if (raw === null) {
    return;
  }

  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    window.alert("Zadej prosím platné číslo minut větší než 0.");
    return;
  }

  const durationMs = Math.round(parsed * 60000);
  entry.durationMs = durationMs;
  entry.endTs = entry.startTs + durationMs;
  save();
  render();
}

function deleteEntry(index) {
  const entry = state.entries[index];
  if (!entry) {
    return;
  }

  const ok = window.confirm(`Smazat záznam ${entry.activity} (${formatClock(entry.startTs)} - ${formatClock(entry.endTs)})?`);
  if (!ok) {
    return;
  }

  state.entries.splice(index, 1);
  save();
  render();
}

if (entriesBody) {
  entriesBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const btn = target.closest("button[data-entry-index]");
    if (!(btn instanceof HTMLElement)) {
      return;
    }

    const index = Number(btn.dataset.entryIndex);
    if (!Number.isInteger(index)) {
      return;
    }

    if (btn.classList.contains("edit")) {
      editEntry(index);
      return;
    }

    if (btn.classList.contains("delete")) {
      deleteEntry(index);
    }
  });
}

function showNewDayBanner() {
  const existing = document.getElementById("newDayBanner");
  if (existing) {
    return;
  }

  const banner = document.createElement("div");
  banner.id = "newDayBanner";
  banner.className = "new-day-banner";
  banner.textContent = "Nový den! Aktivita byla automaticky zastavena.";

  const app = document.querySelector(".app");
  if (app) {
    app.prepend(banner);
  }

  setTimeout(() => {
    banner.classList.add("is-fading");
    setTimeout(() => banner.remove(), 600);
  }, 4000);
}

function checkDayCycle() {
  const nowKey = dayKey(Date.now());
  if (nowKey === trackedDayKey) {
    return;
  }

  trackedDayKey = nowKey;

  if (state.active) {
    stopActive();
    showNewDayBanner();
  }
}

function renderTodayLabel() {
  todayLabel.textContent = new Date().toLocaleDateString("cs-CZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function initCollapsiblePanels() {
  const panels = Array.from(document.querySelectorAll(".panel"));

  for (const panel of panels) {
    if (panel.classList.contains("is-collapsible-ready")) {
      continue;
    }

    const heading = panel.querySelector(":scope > h2");
    if (!heading) {
      continue;
    }

    const title = heading.textContent?.trim() || "Sekce";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "panel-toggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.innerHTML = `<span class="panel-toggle-title">${title}</span><span class="panel-toggle-arrow" aria-hidden="true">&#9660;</span>`;

    const body = document.createElement("div");
    body.className = "panel-body";

    const inner = document.createElement("div");
    inner.className = "panel-body-inner";

    let node = heading.nextSibling;
    while (node) {
      const next = node.nextSibling;
      inner.appendChild(node);
      node = next;
    }

    body.appendChild(inner);
    heading.remove();

    panel.prepend(body);
    panel.prepend(toggle);
    panel.classList.add("panel-collapsible", "is-open", "is-collapsible-ready");

    toggle.addEventListener("click", () => {
      const isOpen = panel.classList.contains("is-open");
      panel.classList.toggle("is-open", !isOpen);
      toggle.setAttribute("aria-expanded", String(!isOpen));
    });
  }
}

function render() {
  renderTodayLabel();
  renderButtons();
  renderActiveStatus();
  renderTotals();
  renderEntries();
}

for (const btn of activityButtons) {
  btn.addEventListener("click", async () => {
    const activity = btn.dataset.activity;
    await startActivity(activity);
  });
}

stopBtn.addEventListener("click", () => {
  stopActive();
  render();
});

if (themeSelect) {
  themeSelect.addEventListener("change", (event) => {
    const selectedTheme = event.target.value;
    applyTheme(selectedTheme);
    localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
  });
}

if (exportWeeklyBtn) {
  exportWeeklyBtn.addEventListener("click", () => {
    exportWeeklySummary();
  });
}

if (manualAddBtn) {
  manualAddBtn.addEventListener("click", () => {
    addManualEntry();
  });
}

function scheduleMidnightCheck() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const msUntilTarget = target.getTime() - now.getTime();

  setTimeout(() => {
    checkDayCycle();
    scheduleMidnightCheck();
  }, msUntilTarget);
}

loadTheme();
initCollapsiblePanels();
load();
setManualDefaults();
trackedDayKey = dayKey(Date.now());
if (appVersion) {
  appVersion.textContent = APP_VERSION;
}
render();
setInterval(render, 1000);
scheduleMidnightCheck();
