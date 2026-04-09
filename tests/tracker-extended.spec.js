import { test, expect } from '@playwright/test';
import path from 'path';

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function resetApp(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function acceptStart(page) {
  const overlay = page.locator('#startConfirmOverlay');
  if (await overlay.isVisible()) {
    await page.locator('#startConfirmOk').click();
  }
}

async function addManualEntry(page, { activity, date, from, to }) {
  await page.locator('#manualActivityInput').selectOption(activity);
  await page.locator('#manualDateInput').fill(date);
  await page.locator('#manualStartInput').fill(from);
  await page.locator('#manualEndInput').fill(to);
  await page.locator('#manualAddBtn').click();
}

async function seedEntries(page, entries) {
  await page.evaluate((list) => {
    const stored = JSON.parse(localStorage.getItem('tracker-data-v1') || '{"active":null,"entries":[]}');
    for (const e of list) {
      stored.entries.push(e);
    }
    localStorage.setItem('tracker-data-v1', JSON.stringify(stored));
  }, entries);
  await page.reload();
}

function makeEntry(activity, startTs, endTs, overrides = {}) {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    activity,
    startTs,
    endTs,
    durationMs: endTs - startTs,
    dayKey: new Date(startTs).toISOString().slice(0, 10),
    source: 'tracked',
    createdAt: startTs,
    updatedAt: endTs,
    editedManually: false,
    ...overrides,
  };
}

// ───────────────────────────────────────────────
// 1. Switch activity while one is running
// ───────────────────────────────────────────────
test('switching activity stops previous and starts new one', async ({ page }) => {
  await resetApp(page);

  await page.locator('.activity-btn[data-activity="Caroda"]').click();
  await acceptStart(page);
  await expect(page.locator('#activeBadgeText')).toContainText('Caroda');

  await page.locator('.activity-btn[data-activity="AYM"]').click();
  await acceptStart(page);
  await expect(page.locator('#activeBadgeText')).toContainText('AYM');

  // Previous Caroda entry should exist now.
  await expect(page.locator('#entriesBody tr').first()).toContainText('Caroda');
});

// ───────────────────────────────────────────────
// 2. Cancel edit mode resets the form
// ───────────────────────────────────────────────
test('cancel edit resets form back to add mode', async ({ page }) => {
  await resetApp(page);
  await addManualEntry(page, { activity: 'AYM', date: todayStr(), from: '08:00', to: '09:00' });

  await page.locator('#entriesBody button.edit').first().click();
  await expect(page.locator('#manualAddBtn')).toHaveText('Uložit změny');
  await expect(page.locator('#manualCancelBtn')).toBeVisible();

  await page.locator('#manualCancelBtn').click();
  await expect(page.locator('#manualAddBtn')).toHaveText('Přidat záznam');
  await expect(page.locator('#manualCancelBtn')).toBeHidden();
});

// ───────────────────────────────────────────────
// 3. Delete entry removes it from the list
// ───────────────────────────────────────────────
test('delete entry removes it after confirmation', async ({ page }) => {
  await resetApp(page);
  await addManualEntry(page, { activity: 'Caroda', date: todayStr(), from: '09:00', to: '10:00' });
  await expect(page.locator('#entriesBody tr')).toHaveCount(1);

  page.once('dialog', (d) => d.accept());
  await page.locator('#entriesBody button.delete').first().click();

  await expect(page.locator('#entriesBody')).toContainText('Zatím žádné záznamy');
});

// ───────────────────────────────────────────────
// 4. Filter by activity
// ───────────────────────────────────────────────
test('activity filter shows only matching entries', async ({ page }) => {
  await resetApp(page);
  await addManualEntry(page, { activity: 'Caroda', date: todayStr(), from: '06:00', to: '07:00' });
  await addManualEntry(page, { activity: 'AYM', date: todayStr(), from: '07:00', to: '08:00' });

  await page.locator('#entriesActivityFilter').selectOption('AYM');

  const rows = page.locator('#entriesBody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('AYM');
});

// ───────────────────────────────────────────────
// 5. Scope buttons: "Dnes" filter
// ───────────────────────────────────────────────
test('scope "Dnes" shows only today entries', async ({ page }) => {
  await resetApp(page);

  // Add today entry via form.
  await addManualEntry(page, { activity: 'Caroda', date: todayStr(), from: '11:00', to: '12:00' });

  // Seed a yesterday entry directly.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(10, 0, 0, 0);
  const yEnd = new Date(yesterday);
  yEnd.setHours(11, 0, 0, 0);

  await seedEntries(page, [makeEntry('AYM', yesterday.getTime(), yEnd.getTime())]);

  // "Vše" should show both.
  await page.locator('.entries-scope-btn[data-scope="all"]').click();
  await expect(page.locator('#entriesBody tr')).toHaveCount(2);

  // "Dnes" should show only 1.
  await page.locator('.entries-scope-btn[data-scope="today"]').click();
  await expect(page.locator('#entriesBody tr')).toHaveCount(1);
  await expect(page.locator('#entriesBody tr').first()).toContainText('Caroda');
});

// ───────────────────────────────────────────────
// 6. Reset filters clears everything
// ───────────────────────────────────────────────
test('reset filters restores full list', async ({ page }) => {
  await resetApp(page);
  await addManualEntry(page, { activity: 'Caroda', date: todayStr(), from: '06:00', to: '07:00' });
  await addManualEntry(page, { activity: 'AYM', date: todayStr(), from: '07:00', to: '08:00' });

  await page.locator('#entriesActivityFilter').selectOption('AYM');
  await expect(page.locator('#entriesBody tr')).toHaveCount(1);

  await page.locator('#entriesResetFiltersBtn').click();
  await expect(page.locator('#entriesBody tr')).toHaveCount(2);
});

// ───────────────────────────────────────────────
// 7. Recovery banner: "Pokračovat" hides it
// ───────────────────────────────────────────────
test('recovery banner shows on reload with active session and "Pokračovat" hides it', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('tracker-data-v1', JSON.stringify({
      active: { activity: 'AYM', startTs: now - 60000 },
      entries: [],
    }));
  });
  await page.reload();

  const banner = page.locator('#recoveryBanner');
  // NOTE: Using class check instead of toBeVisible/toBeHidden because CSS specificity bug:
  // .session-recovery { display:grid } overrides .is-hidden { display:none } (same specificity, later in file wins).
  await expect(banner).not.toHaveClass(/is-hidden/);
  await expect(banner).toContainText('AYM');

  await page.locator('#recoveryKeepBtn').click();
  await expect(banner).toHaveClass(/is-hidden/);

  // Activity should still be running.
  await expect(page.locator('#activeBadgeText')).toContainText('AYM');
});

// ───────────────────────────────────────────────
// 8. Recovery banner: "Ukončit teď" stops session
// ───────────────────────────────────────────────
test('recovery "Ukončit teď" stops session and creates entry', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('tracker-data-v1', JSON.stringify({
      active: { activity: 'Caroda', startTs: now - 120000 },
      entries: [],
    }));
  });
  await page.reload();

  await page.locator('#recoveryStopBtn').click();

  await expect(page.locator('#recoveryBanner')).toHaveClass(/is-hidden/);
  await expect(page.locator('#activeBadgeText')).toContainText('Nic neběží');
  await expect(page.locator('#entriesBody tr').first()).toContainText('Caroda');
});

// ───────────────────────────────────────────────
// 9. Recovery banner: "Zahodit" discards session
// ───────────────────────────────────────────────
test('recovery "Zahodit" removes session without creating entry', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('tracker-data-v1', JSON.stringify({
      active: { activity: 'Automatizované testy', startTs: now - 300000 },
      entries: [],
    }));
  });
  await page.reload();

  page.once('dialog', (d) => d.accept());
  await page.locator('#recoveryDiscardBtn').click();

  await expect(page.locator('#recoveryBanner')).toHaveClass(/is-hidden/);
  await expect(page.locator('#activeBadgeText')).toContainText('Nic neběží');
  await expect(page.locator('#entriesBody')).toContainText('Zatím žádné záznamy');
});

// ───────────────────────────────────────────────
// 10. Data persists across page reload
// ───────────────────────────────────────────────
test('entries survive page reload', async ({ page }) => {
  await resetApp(page);
  await addManualEntry(page, { activity: 'AYM', date: todayStr(), from: '16:00', to: '17:00' });
  await expect(page.locator('#entriesBody tr')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('#entriesBody tr')).toHaveCount(1);
  await expect(page.locator('#entriesBody tr').first()).toContainText('AYM');
});

// ───────────────────────────────────────────────
// 11. Today totals reflect manual entries
// ───────────────────────────────────────────────
test('today summary cards show totals from today entries', async ({ page }) => {
  await resetApp(page);
  await addManualEntry(page, { activity: 'Caroda', date: todayStr(), from: '09:00', to: '10:00' });
  await addManualEntry(page, { activity: 'AYM', date: todayStr(), from: '10:00', to: '10:30' });

  await expect(page.locator('#totalCaroda')).toContainText('01:00:00');
  await expect(page.locator('#totalAYM')).toContainText('00:30:00');
});

// ───────────────────────────────────────────────
// 12. Manual add: end before start shows error
// ───────────────────────────────────────────────
test('manual add with end before start shows validation error', async ({ page }) => {
  await resetApp(page);
  await addManualEntry(page, { activity: 'Caroda', date: todayStr(), from: '12:00', to: '11:00' });
  await expect(page.locator('#manualStatus')).toContainText('Čas Do musí být později');
});

// ───────────────────────────────────────────────
// 13. Theme persists across reload
// ───────────────────────────────────────────────
test('theme selection persists after reload', async ({ page }) => {
  await resetApp(page);

  await page.locator('#themeSelect').selectOption('citrus');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'citrus');

  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'citrus');
});

// ───────────────────────────────────────────────
// 14. Toggle "Zobrazit vše" when >5 entries
// ───────────────────────────────────────────────
test('show more/less toggle works when entries exceed 5', async ({ page }) => {
  await resetApp(page);

  // Create 7 non-overlapping entries.
  for (let i = 0; i < 7; i++) {
    const from = `0${i}:00`;
    const to = `0${i}:30`;
    await addManualEntry(page, { activity: 'Caroda', date: todayStr(), from, to });
  }

  // Only 5 visible initially.
  await expect(page.locator('#entriesBody tr')).toHaveCount(5);
  const toggleBtn = page.locator('#entriesToggleBtn');
  await expect(toggleBtn).toBeVisible();
  await expect(toggleBtn).toContainText('Zobrazit vše');

  await toggleBtn.click();
  await expect(page.locator('#entriesBody tr')).toHaveCount(7);
  await expect(toggleBtn).toContainText('Zobrazit méně');

  await toggleBtn.click();
  await expect(page.locator('#entriesBody tr')).toHaveCount(5);
});

// ───────────────────────────────────────────────
// 15. Edit can change activity type
// ───────────────────────────────────────────────
test('editing entry can change activity type', async ({ page }) => {
  await resetApp(page);
  await addManualEntry(page, { activity: 'Caroda', date: todayStr(), from: '14:00', to: '15:00' });

  await page.locator('#entriesBody button.edit').first().click();
  await page.locator('#manualActivityInput').selectOption('AYM');
  await page.locator('#manualAddBtn').click();

  await expect(page.locator('#manualStatus')).toContainText('Změny byly uloženy');
  await expect(page.locator('#entriesBody tr').first()).toContainText('AYM');
});

// ───────────────────────────────────────────────
// 16. Long entry gets "Dlouhé" flag
// ───────────────────────────────────────────────
test('entry longer than 3 hours is flagged as Dlouhé', async ({ page }) => {
  await resetApp(page);
  await addManualEntry(page, { activity: 'Caroda', date: todayStr(), from: '06:00', to: '09:01' });
  await expect(page.locator('#entriesBody tr').first()).toContainText('Dlouhé');
});

// ───────────────────────────────────────────────
// 17. Edited entry gets "Upraveno" flag
// ───────────────────────────────────────────────
test('tracked entry gets Upraveno flag after edit', async ({ page }) => {
  await resetApp(page);

  // Seed a tracked entry (source: "tracked") directly.
  const now = new Date();
  now.setHours(3, 0, 0, 0);
  const end = new Date(now);
  end.setHours(4, 0, 0, 0);

  await seedEntries(page, [makeEntry('AYM', now.getTime(), end.getTime(), { source: 'tracked' })]);

  // Before edit - no "Upraveno" flag.
  await expect(page.locator('#entriesBody tr').first()).not.toContainText('Upraveno');

  await page.locator('#entriesBody button.edit').first().click();
  await page.locator('#manualEndInput').fill('04:30');
  await page.locator('#manualAddBtn').click();

  await expect(page.locator('#entriesBody tr').first()).toContainText('Upraveno');
});

// ───────────────────────────────────────────────
// 18. Valid backup import restores data
// ───────────────────────────────────────────────
test('importing a valid backup restores entries', async ({ page }) => {
  await resetApp(page);

  const backupPath = path.resolve('tests/fixtures/valid-backup.json');
  page.once('dialog', (d) => d.accept());
  await page.locator('#importBackupInput').setInputFiles(backupPath);

  await expect(page.locator('#dataToolsStatus')).toContainText('Data byla obnovena');
  await expect(page.locator('#entriesBody tr')).toHaveCount(1);
  await expect(page.locator('#entriesBody tr').first()).toContainText('Caroda');
});

// ───────────────────────────────────────────────
// 19. Date range filter works
// ───────────────────────────────────────────────
test('date range filter narrows visible entries', async ({ page }) => {
  await resetApp(page);

  // Seed entries on two different days.
  const today = new Date();
  today.setHours(10, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(11, 0, 0, 0);

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(10, 0, 0, 0);
  const twoDaysAgoEnd = new Date(twoDaysAgo);
  twoDaysAgoEnd.setHours(11, 0, 0, 0);

  await seedEntries(page, [
    makeEntry('Caroda', twoDaysAgo.getTime(), twoDaysAgoEnd.getTime()),
    makeEntry('AYM', today.getTime(), todayEnd.getTime()),
  ]);

  // Filter: from today only.
  await page.locator('#entriesDateFrom').fill(todayStr());
  await expect(page.locator('#entriesBody tr')).toHaveCount(1);
  await expect(page.locator('#entriesBody tr').first()).toContainText('AYM');
});

// ───────────────────────────────────────────────
// 20. Collapsible panels work
// ───────────────────────────────────────────────
test('panels can be collapsed and expanded', async ({ page }) => {
  await resetApp(page);

  // The "Aktivita" panel toggle.
  const firstToggle = page.locator('.panel-toggle').first();
  const firstPanel = page.locator('.panel-collapsible').first();

  await expect(firstPanel).toHaveClass(/is-open/);
  await firstToggle.click();
  await expect(firstPanel).not.toHaveClass(/is-open/);
  await firstToggle.click();
  await expect(firstPanel).toHaveClass(/is-open/);
});
