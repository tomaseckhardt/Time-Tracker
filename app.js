const STORAGE_KEY = "tracker-data-v1";
const THEME_STORAGE_KEY = "tracker-theme-v1";
const DEFAULT_THEME = "sunrise";
const APP_VERSION = "v1.7.1";
const ACTIVITY_OPTIONS = ["Caroda", "AYM", "Automatizované testy"];
const SHORT_ENTRY_MS = 60 * 1000;
const LONG_ENTRY_MS = 3 * 60 * 60 * 1000;

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
const manualCancelBtn = document.getElementById("manualCancelBtn");
const manualStatus = document.getElementById("manualStatus");
const manualModeHint = document.getElementById("manualModeHint");
const recoveryBanner = document.getElementById("recoveryBanner");
const recoveryMessage = document.getElementById("recoveryMessage");
const recoveryKeepBtn = document.getElementById("recoveryKeepBtn");
const recoveryStopBtn = document.getElementById("recoveryStopBtn");
const recoveryDiscardBtn = document.getElementById("recoveryDiscardBtn");
const exportBackupBtn = document.getElementById("exportBackupBtn");
const importBackupBtn = document.getElementById("importBackupBtn");
const importBackupInput = document.getElementById("importBackupInput");
const dataToolsStatus = document.getElementById("dataToolsStatus");
const entriesActivityFilter = document.getElementById("entriesActivityFilter");
const entriesDateFrom = document.getElementById("entriesDateFrom");
const entriesDateTo = document.getElementById("entriesDateTo");
const entriesUnusualOnly = document.getElementById("entriesUnusualOnly");
const entriesResetFiltersBtn = document.getElementById("entriesResetFiltersBtn");
const entriesScopeButtons = Array.from(document.querySelectorAll(".entries-scope-btn"));
const startConfirmOverlay = document.getElementById("startConfirmOverlay");
const startConfirmMessage = document.getElementById("startConfirmMessage");
const startConfirmOk = document.getElementById("startConfirmOk");
const startConfirmCancel = document.getElementById("startConfirmCancel");

let startConfirmResolver = null;
let editingEntryIndex = null;
let currentEntriesScope = "all";
let recoveredSessionVisible = false;

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

function endOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
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

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("cs-CZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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

function makeEntryId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidActivity(activity) {
  return ACTIVITY_OPTIONS.includes(activity);
}

function sortEntries() {
  state.entries.sort((a, b) => a.startTs - b.startTs || a.endTs - b.endTs);
}

function createEntryRecord({ activity, startTs, endTs, source = "tracked", existingEntry = null }) {
  const nowTs = getNow();
  const nextSource = existingEntry?.source === "manual" ? "manual" : source;

  return {
    id: existingEntry?.id ?? makeEntryId(),
    activity,
    startTs,
    endTs,
    durationMs: endTs - startTs,
    dayKey: dayKey(startTs),
    source: nextSource,
    createdAt: existingEntry?.createdAt ?? nowTs,
    updatedAt: nowTs,
    editedManually: existingEntry ? true : Boolean(existingEntry?.editedManually),
  };
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const activity = entry.activity;
  const startTs = Number(entry.startTs);
  const endTs = Number(entry.endTs);

  if (!isValidActivity(activity) || !Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
    return null;
  }

  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : makeEntryId(),
    activity,
    startTs,
    endTs,
    durationMs: endTs - startTs,
    dayKey: dayKey(startTs),
    source: entry.source === "manual" ? "manual" : "tracked",
    createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : startTs,
    updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : endTs,
    editedManually: Boolean(entry.editedManually),
  };
}

function normalizeActive(active) {
  if (!active || typeof active !== "object") {
    return null;
  }

  const activity = active.activity;
  const startTs = Number(active.startTs);
  if (!isValidActivity(activity) || !Number.isFinite(startTs)) {
    return null;
  }

  return {
    activity,
    startTs,
  };
}

function normalizeState(rawState) {
  const entries = Array.isArray(rawState?.entries)
    ? rawState.entries.map(normalizeEntry).filter(Boolean)
    : [];

  entries.sort((a, b) => a.startTs - b.startTs || a.endTs - b.endTs);

  return {
    active: normalizeActive(rawState?.active),
    entries,
  };
}

function describeEntryRange(entry) {
  return `${formatDate(entry.startTs)} ${formatClock(entry.startTs)} - ${formatClock(entry.endTs)}`;
}

function findOverlappingEntry(startTs, endTs, excludeIndex = null) {
  for (let index = 0; index < state.entries.length; index += 1) {
    if (index === excludeIndex) {
      continue;
    }

    const entry = state.entries[index];
    if (startTs < entry.endTs && endTs > entry.startTs) {
      return {
        kind: "entry",
        entry,
      };
    }
  }

  if (state.active) {
    const activeEndTs = getNow();
    if (startTs < activeEndTs && endTs > state.active.startTs) {
      return {
        kind: "active",
        entry: {
          activity: state.active.activity,
          startTs: state.active.startTs,
          endTs: activeEndTs,
        },
      };
    }
  }

  return null;
}

function formatOverlapMessage(conflict) {
  if (!conflict) {
    return "";
  }

  const prefix = conflict.kind === "active"
    ? "Záznam se překrývá s právě běžící aktivitou"
    : "Záznam se překrývá s existujícím záznamem";

  return `${prefix} ${conflict.entry.activity} (${describeEntryRange(conflict.entry)}).`;
}

function getEntryFlags(entry) {
  const flags = [];

  if (entry.source === "manual") {
    flags.push({ key: "manual", label: "Ručně" });
  } else if (entry.editedManually) {
    flags.push({ key: "edited", label: "Upraveno" });
  }

  if (entry.durationMs < SHORT_ENTRY_MS) {
    flags.push({ key: "short", label: "Krátké" });
  }

  if (entry.durationMs >= LONG_ENTRY_MS) {
    flags.push({ key: "long", label: "Dlouhé" });
  }

  return flags;
}

function isEntryUnusual(entry) {
  return getEntryFlags(entry).length > 0;
}

function setDataToolsStatus(message, isError = false) {
  if (!dataToolsStatus) {
    return;
  }

  dataToolsStatus.textContent = message;
  dataToolsStatus.classList.toggle("error", Boolean(isError));
  dataToolsStatus.classList.toggle("success", !isError && Boolean(message));
}

function setManualMode(index = null) {
  editingEntryIndex = Number.isInteger(index) ? index : null;
  const isEditing = editingEntryIndex !== null;

  if (manualAddBtn) {
    manualAddBtn.textContent = isEditing ? "Uložit změny" : "Přidat záznam";
  }

  if (manualCancelBtn) {
    manualCancelBtn.classList.toggle("is-hidden", !isEditing);
  }

  if (manualModeHint) {
    manualModeHint.textContent = isEditing
      ? "Upravuješ existující záznam. Časy i aktivitu můžeš změnit a historie se přepočítá." 
      : "Můžeš doplnit chybějící blok nebo opravit historii.";
  }
}

function resetManualForm() {
  setManualMode(null);
  setManualDefaults();
  setManualStatus("");
}

function populateManualForm(entry) {
  if (!manualActivityInput || !manualDateInput || !manualStartInput || !manualEndInput) {
    return;
  }

  manualActivityInput.value = entry.activity;
  manualDateInput.value = formatDateInputValue(new Date(entry.startTs));
  manualStartInput.value = formatTimeInputValue(new Date(entry.startTs));
  manualEndInput.value = formatTimeInputValue(new Date(entry.endTs));
}

function setEntriesScope(scope) {
  currentEntriesScope = scope;
  for (const button of entriesScopeButtons) {
    button.classList.toggle("active", button.dataset.scope === scope);
  }
}

function getScopeRange(scope) {
  if (scope === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startTs: start.getTime(), endTs: end.getTime() };
  }

  if (scope === "week") {
    const start = getStartOfWeek(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { startTs: start.getTime(), endTs: end.getTime() };
  }

  return null;
}

function getFilteredEntries() {
  const scopeRange = getScopeRange(currentEntriesScope);
  const activityValue = entriesActivityFilter?.value ?? "all";
  const dateFromTs = entriesDateFrom?.value ? parseLocalDateTime(entriesDateFrom.value, "00:00") : null;
  const dateToTs = entriesDateTo?.value
    ? parseLocalDateTime(entriesDateTo.value, "00:00") + (24 * 60 * 60 * 1000)
    : null;
  const unusualOnly = Boolean(entriesUnusualOnly?.checked);

  return state.entries
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .filter(({ entry }) => {
      if (scopeRange && (entry.startTs < scopeRange.startTs || entry.startTs >= scopeRange.endTs)) {
        return false;
      }

      if (activityValue !== "all" && entry.activity !== activityValue) {
        return false;
      }

      if (dateFromTs !== null && entry.startTs < dateFromTs) {
        return false;
      }

      if (dateToTs !== null && entry.startTs >= dateToTs) {
        return false;
      }

      if (unusualOnly && !isEntryUnusual(entry)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.entry.startTs - a.entry.startTs || b.entry.endTs - a.entry.endTs);
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

  const conflict = findOverlappingEntry(startTs, endTs, editingEntryIndex);
  if (conflict) {
    setManualStatus(formatOverlapMessage(conflict), true);
    return;
  }

  if (editingEntryIndex !== null) {
    const currentEntry = state.entries[editingEntryIndex];
    if (!currentEntry) {
      resetManualForm();
      setManualStatus("Upravovaný záznam už v historii není.", true);
      return;
    }

    state.entries[editingEntryIndex] = createEntryRecord({
      activity: manualActivityInput.value,
      startTs,
      endTs,
      existingEntry: currentEntry,
      source: currentEntry.source,
    });

    sortEntries();
    save();
    render();
    resetManualForm();
    setManualStatus("Změny byly uloženy.");
    return;
  }

  state.entries.push(createEntryRecord({
    activity: manualActivityInput.value,
    startTs,
    endTs,
    source: "manual",
  }));

  sortEntries();

  save();
  render();
  setManualStatus("Záznam byl přidán.");
}

function formatHoursFromMs(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatHoursFromMsForReport(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  return totalMinutes === 0 ? "-" : formatHoursFromMs(ms);
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

function formatDayLabelCz(date) {
  return new Date(date).toLocaleDateString("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
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
      const days = [];
      const dayIndex = new Map();

      for (let offset = 0; offset < 7; offset += 1) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + offset);
        const dayStorageKey = dayKey(dayDate.getTime());

        dayIndex.set(dayStorageKey, days.length);
        days.push({
          day: formatDayLabelCz(dayDate),
          Caroda: 0,
          AYM: 0,
          "Automatizované testy": 0,
        });
      }

      byWeek.set(weekKey, {
        week: weekLabel,
        weekStartTs: weekStart.getTime(),
        Caroda: 0,
        AYM: 0,
        "Automatizované testy": 0,
        days,
        dayIndex,
      });
    }

    const weekData = byWeek.get(weekKey);
    if (activityNames.includes(entry.activity)) {
      weekData[entry.activity] += entry.durationMs;

      const entryDayKey = dayKey(entry.startTs);
      const index = weekData.dayIndex.get(entryDayKey);
      if (index !== undefined) {
        weekData.days[index][entry.activity] += entry.durationMs;
      }
    }
  }

  return Array.from(byWeek.values())
    .sort((a, b) => a.weekStartTs - b.weekStartTs)
    .map(({ weekStartTs, dayIndex, ...rest }) => rest);
}

function buildWeeklyCsv(rows) {
  const header = [
    "Týden",
    "Caroda",
    "AYM",
    "Automatizované testy",
    "Celkově",
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
    .map((row, weekIndex) => {
      const totalMs = row.Caroda + row.AYM + row["Automatizované testy"];
      const dayRows = row.days
        .map((day) => {
          const dayTotalMs = day.Caroda + day.AYM + day["Automatizované testy"];
          return `<tr>
            <td>${day.day}</td>
            <td>${formatHoursFromMsForReport(day.Caroda)}</td>
            <td>${formatHoursFromMsForReport(day.AYM)}</td>
            <td>${formatHoursFromMsForReport(day["Automatizované testy"])}</td>
            <td><strong>${formatHoursFromMsForReport(dayTotalMs)}</strong></td>
          </tr>`;
        })
        .join("");

      return `<tr class="week-row">
        <td>
          <button class="week-toggle" data-week-index="${weekIndex}" aria-expanded="false" type="button">
            <span class="week-toggle-arrow" aria-hidden="true">&#9654;</span>
            <span>${row.week}</span>
          </button>
        </td>
        <td>${formatHoursFromMsForReport(row.Caroda)}</td>
        <td>${formatHoursFromMsForReport(row.AYM)}</td>
        <td>${formatHoursFromMsForReport(row["Automatizované testy"])}</td>
        <td><strong>${formatHoursFromMsForReport(totalMs)}</strong></td>
      </tr>
      <tr class="week-details is-hidden" data-week-details="${weekIndex}">
        <td colspan="5">
          <table class="day-table">
            <thead>
              <tr>
                <th>Den</th>
                <th>Caroda</th>
                <th>AYM</th>
                <th>Automatizované testy</th>
                <th>Celkově</th>
              </tr>
            </thead>
            <tbody>
              ${dayRows}
            </tbody>
          </table>
        </td>
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

    .week-toggle {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: transparent;
      color: #1f2a37;
      border-radius: 7px;
      padding: 5px 6px;
      font-weight: 700;
      margin: -5px -6px;
      text-align: left;
    }

    .week-toggle:hover {
      background: #eef2f9;
    }

    .week-toggle-arrow {
      display: inline-block;
      transition: transform 0.2s ease;
      color: #0f766e;
      font-size: 0.72rem;
    }

    .week-toggle[aria-expanded="true"] .week-toggle-arrow {
      transform: rotate(90deg);
    }

    .week-details.is-hidden {
      display: none;
    }

    .week-details > td {
      background: #f8fafc;
      padding: 8px 10px 12px;
    }

    .day-table th,
    .day-table td {
      padding: 8px 7px;
      border-bottom: 1px solid #e7edf6;
      font-size: 0.95rem;
    }

    .day-table tbody tr:last-child td {
      border-bottom: 0;
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

    th:nth-child(n + 2),
    td:nth-child(n + 2) {
      text-align: center;
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
          <th>Caroda</th>
          <th>AYM</th>
          <th>Automatizované testy</th>
          <th>Celkově</th>
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
  const weekToggles = Array.from(reportWindow.document.querySelectorAll(".week-toggle"));

  for (const toggleBtn of weekToggles) {
    toggleBtn.addEventListener("click", () => {
      const weekIndex = toggleBtn.dataset.weekIndex;
      const detailsRow = reportWindow.document.querySelector(`[data-week-details="${weekIndex}"]`);
      if (!detailsRow) {
        return;
      }

      const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
      toggleBtn.setAttribute("aria-expanded", String(!expanded));
      detailsRow.classList.toggle("is-hidden", expanded);
    });
  }

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
    const normalized = normalizeState(parsed);
    state.active = normalized.active;
    state.entries = normalized.entries;
    recoveredSessionVisible = Boolean(state.active);
  } catch {
    state.active = null;
    state.entries = [];
    recoveredSessionVisible = false;
  }
}

function stopActive(nowTs = getNow()) {
  if (!state.active) {
    return;
  }

  state.entries.push(createEntryRecord({
    activity: state.active.activity,
    startTs: state.active.startTs,
    endTs: nowTs,
    source: "tracked",
  }));

  state.active = null;
  sortEntries();
  recoveredSessionVisible = false;
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

  recoveredSessionVisible = false;
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

function renderRecoveryBanner() {
  if (!recoveryBanner || !recoveryMessage) {
    return;
  }

  const shouldShow = recoveredSessionVisible && state.active;
  recoveryBanner.classList.toggle("is-hidden", !shouldShow);

  if (!shouldShow) {
    return;
  }

  recoveryMessage.textContent = `${state.active.activity} běží od ${formatDate(state.active.startTs)} ${formatClock(state.active.startTs)}. Můžeš ji nechat běžet, ukončit ji teď nebo ji zahodit.`;
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
  const recentEntries = getFilteredEntries();

  const toggleBtn = document.getElementById('entriesToggleBtn');

  if (recentEntries.length === 0) {
    const message = state.entries.length === 0
      ? 'Zatím žádné záznamy.'
      : 'Žádné záznamy neodpovídají aktivním filtrům.';

    entriesBody.innerHTML = `<tr><td colspan="6" class="empty">${message}</td></tr>`;
    toggleBtn.style.display = 'none';
    return;
  }

  const visible = entriesExpanded ? recentEntries : recentEntries.slice(0, ENTRIES_VISIBLE);

  entriesBody.innerHTML = visible
    .map(({ entry, originalIndex }) => {
      const flags = getEntryFlags(entry);
      const flagClasses = flags.map((flag) => `entry-row--${flag.key}`).join(' ');
      const flagsHtml = flags.length > 0
        ? `<div class="entry-flags">${flags.map((flag) => `<span class="entry-flag entry-flag--${flag.key}">${flag.label}</span>`).join('')}</div>`
        : '';

      return `<tr class="${flagClasses}">
        <td class="entry-activity-cell">
          <div class="entry-activity-name">${entry.activity}</div>
          ${flagsHtml}
        </td>
        <td>${formatDate(entry.startTs)}</td>
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

  if (recentEntries.length > ENTRIES_VISIBLE) {
    toggleBtn.style.display = '';
    const hidden = recentEntries.length - ENTRIES_VISIBLE;
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

  setManualMode(index);
  populateManualForm(entry);
  setManualStatus(`Upravuješ ${entry.activity} (${describeEntryRange(entry)}).`);
  manualAddBtn?.closest(".panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  if (editingEntryIndex === index) {
    resetManualForm();
  } else if (editingEntryIndex !== null && index < editingEntryIndex) {
    editingEntryIndex -= 1;
  }

  save();
  render();
}

function discardActiveSession() {
  if (!state.active) {
    return;
  }

  const confirmed = window.confirm(`Zahodit běžící aktivitu ${state.active.activity} bez uložení?`);
  if (!confirmed) {
    return;
  }

  state.active = null;
  recoveredSessionVisible = false;
  save();
  render();
}

function resetEntriesFilters() {
  setEntriesScope("all");
  if (entriesActivityFilter) {
    entriesActivityFilter.value = "all";
  }
  if (entriesDateFrom) {
    entriesDateFrom.value = "";
  }
  if (entriesDateTo) {
    entriesDateTo.value = "";
  }
  if (entriesUnusualOnly) {
    entriesUnusualOnly.checked = false;
  }
  entriesExpanded = false;
  renderEntries();
}

function exportBackup() {
  const exportedAt = new Date().toISOString();
  const payload = {
    app: "time-tracker",
    version: APP_VERSION,
    exportedAt,
    state,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `time-tracker-backup-${exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  setDataToolsStatus("JSON záloha byla stažena.");
}

async function importBackupFile(file) {
  if (!file) {
    return;
  }

  let importFormat = "unknown";
  let errorCategory = null;

  try {
    const raw = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      errorCategory = "parse";
      throw new Error("Soubor není platný JSON.");
    }

    // Detect format: wrapper (has state property) or raw (direct state)
    const isWrapper = parsed && typeof parsed === "object" && "state" in parsed;
    importFormat = isWrapper ? "wrapper" : "raw";
    const incomingState = isWrapper ? parsed.state : parsed;

    // Pre-normalization validation (fail-closed)
    if (!incomingState || typeof incomingState !== "object") {
      errorCategory = "validation";
      throw new Error("Neplatný formát zálohy.");
    }
    if (!Array.isArray(incomingState.entries)) {
      errorCategory = "schema";
      throw new Error("Soubor neobsahuje pole entries.");
    }

    // Validate that at least some entries have required fields (if any exist)
    if (incomingState.entries.length > 0) {
      const hasValidEntry = incomingState.entries.some(
        (e) =>
          e &&
          typeof e === "object" &&
          typeof e.activity === "string" &&
          typeof e.startTs === "number" &&
          typeof e.endTs === "number"
      );
      if (!hasValidEntry) {
        errorCategory = "schema";
        throw new Error("Záloha obsahuje neplatné záznamy.");
      }
    }

    // NOW safe to normalize
    const normalized = normalizeState(incomingState);

    state.active = normalized.active;
    state.entries = normalized.entries;
    recoveredSessionVisible = Boolean(state.active);
    save();
    resetManualForm();
    resetEntriesFilters();
    render();

    console.info("[import]", {
      format: importFormat,
      result: "success",
      errorCategory: null,
      entryCount: normalized.entries.length,
    });

    setDataToolsStatus(`Data byla obnovena ze souboru ${file.name}.`);
  } catch (error) {
    console.info("[import]", {
      format: importFormat,
      result: "error",
      errorCategory: errorCategory || "unknown",
      entryCount: 0,
    });

    setDataToolsStatus(error instanceof Error ? error.message : "Import se nepovedl.", true);
  }
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
  renderRecoveryBanner();
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

if (recoveryKeepBtn) {
  recoveryKeepBtn.addEventListener("click", () => {
    recoveredSessionVisible = false;
    renderRecoveryBanner();
  });
}

if (recoveryStopBtn) {
  recoveryStopBtn.addEventListener("click", () => {
    stopActive();
    render();
  });
}

if (recoveryDiscardBtn) {
  recoveryDiscardBtn.addEventListener("click", () => {
    discardActiveSession();
  });
}

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

if (manualCancelBtn) {
  manualCancelBtn.addEventListener("click", () => {
    resetManualForm();
  });
}

for (const button of entriesScopeButtons) {
  button.addEventListener("click", () => {
    setEntriesScope(button.dataset.scope ?? "all");
    entriesExpanded = false;
    renderEntries();
  });
}

for (const input of [entriesActivityFilter, entriesDateFrom, entriesDateTo, entriesUnusualOnly]) {
  input?.addEventListener("change", () => {
    entriesExpanded = false;
    renderEntries();
  });
}

if (entriesResetFiltersBtn) {
  entriesResetFiltersBtn.addEventListener("click", () => {
    resetEntriesFilters();
  });
}

if (exportBackupBtn) {
  exportBackupBtn.addEventListener("click", () => {
    exportBackup();
  });
}

if (importBackupBtn && importBackupInput) {
  importBackupBtn.addEventListener("click", () => {
    importBackupInput.click();
  });

  importBackupInput.addEventListener("change", async () => {
    const [file] = importBackupInput.files ?? [];
    if (!file) {
      return;
    }

    const shouldReplace = window.confirm("Import nahradí aktuální data trackeru. Pokračovat?");
    if (!shouldReplace) {
      importBackupInput.value = "";
      return;
    }

    await importBackupFile(file);
    importBackupInput.value = "";
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

// INIT CHECKPOINT: Handle cross-day active session (Product Rule A: Auto-stop)
if (state.active) {
  const activeStartDayKey = dayKey(state.active.startTs);
  const nowDayKey = dayKey(Date.now());

  if (activeStartDayKey !== nowDayKey) {
    // Auto-stop at end of day when session started
    const autoStopTs = endOfDay(state.active.startTs);
    stopActive(autoStopTs);
    console.info("[init/day-cycle]", {
      nowDayKey,
      activeStartDayKey,
      actionTaken: "autoStop",
    });
    showNewDayBanner();
  } else {
    console.info("[init/day-cycle]", {
      nowDayKey,
      activeStartDayKey,
      actionTaken: "none",
    });
  }
} else {
  console.info("[init/day-cycle]", {
    nowDayKey: dayKey(Date.now()),
    activeStartDayKey: null,
    actionTaken: "none",
  });
}

setEntriesScope("all");
resetManualForm();
trackedDayKey = dayKey(Date.now());
if (appVersion) {
  appVersion.textContent = APP_VERSION;
}
render();
setInterval(render, 1000);
scheduleMidnightCheck();
