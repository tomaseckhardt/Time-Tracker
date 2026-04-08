const STORAGE_KEY = "tracker-data-v1";
const THEME_STORAGE_KEY = "tracker-theme-v1";
const DEFAULT_THEME = "sunrise";

const state = {
  active: null,
  entries: [],
};

let trackedDayKey = dayKey(Date.now());

const activityButtons = Array.from(document.querySelectorAll(".activity-btn"));
const stopBtn = document.getElementById("stopBtn");
const activeStatus = document.getElementById("activeStatus");
const sessionTimer = document.getElementById("sessionTimer");
const entriesBody = document.getElementById("entriesBody");
const todayLabel = document.getElementById("todayLabel");

const totalCaroda = document.getElementById("totalCaroda");
const totalAYM = document.getElementById("totalAYM");
const totalTests = document.getElementById("totalTests");
const totalAll = document.getElementById("totalAll");
const themeSelect = document.getElementById("themeSelect");
const exportWeeklyBtn = document.getElementById("exportWeeklyBtn");
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

function startActivity(activity) {
  const nowTs = getNow();

  if (state.active && state.active.activity === activity) {
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
    activeStatus.textContent = "Aktuálně: nic neběží";
    sessionTimer.textContent = "00:00:00";
    return;
  }

  const elapsed = getNow() - state.active.startTs;
  activeStatus.textContent = `Aktuálně: ${state.active.activity}`;
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
  const todayEntries = state.entries
    .filter((entry) => entry.dayKey === today)
    .reverse();

  const toggleBtn = document.getElementById('entriesToggleBtn');

  if (todayEntries.length === 0) {
    entriesBody.innerHTML = '<tr><td colspan="4" class="empty">Zatím žádné záznamy.</td></tr>';
    toggleBtn.style.display = 'none';
    return;
  }

  const visible = entriesExpanded ? todayEntries : todayEntries.slice(0, ENTRIES_VISIBLE);

  entriesBody.innerHTML = visible
    .map((entry) => {
      return `<tr>
        <td>${entry.activity}</td>
        <td>${formatClock(entry.startTs)}</td>
        <td>${formatClock(entry.endTs)}</td>
        <td>${formatTime(entry.durationMs)}</td>
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

function render() {
  renderTodayLabel();
  renderButtons();
  renderActiveStatus();
  renderTotals();
  renderEntries();
}

for (const btn of activityButtons) {
  btn.addEventListener("click", () => {
    const activity = btn.dataset.activity;
    startActivity(activity);
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
load();
trackedDayKey = dayKey(Date.now());
render();
setInterval(render, 1000);
scheduleMidnightCheck();
