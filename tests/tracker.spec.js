import { test, expect } from '@playwright/test';

async function acceptStartConfirmation(page) {
  const overlay = page.locator('#startConfirmOverlay');
  if (await overlay.isVisible()) {
    await page.locator('#startConfirmOk').click();
  }
}

async function resetAppStorage(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test('start/stop creates an entry in Recent entries', async ({ page }) => {
  await resetAppStorage(page);

  await page.locator('.activity-btn[data-activity="Caroda"]').click();
  await acceptStartConfirmation(page);

  await expect(page.locator('#activeBadgeText')).toContainText('Caroda');
  await expect(page.locator('#stopBtn')).toBeEnabled();

  await page.locator('#stopBtn').click();

  const rows = page.locator('#entriesBody tr');
  await expect(rows.first()).toContainText('Caroda');
  await expect(rows.first()).toContainText(/\d{2}\.\s?\d{2}\.\s?\d{4}/);
});

test('manual add blocks overlaps with existing entries', async ({ page }) => {
  await resetAppStorage(page);

  // Create an entry 10:00 - 11:00 today.
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  await page.locator('#manualActivityInput').selectOption('AYM');
  await page.locator('#manualDateInput').fill(dateStr);
  await page.locator('#manualStartInput').fill('10:00');
  await page.locator('#manualEndInput').fill('11:00');
  await page.locator('#manualAddBtn').click();

  await expect(page.locator('#manualStatus')).toContainText('Záznam byl přidán');

  // Attempt overlap 10:30 - 10:45
  await page.locator('#manualActivityInput').selectOption('Caroda');
  await page.locator('#manualStartInput').fill('10:30');
  await page.locator('#manualEndInput').fill('10:45');
  await page.locator('#manualAddBtn').click();

  await expect(page.locator('#manualStatus')).toContainText('překrývá');
});

test('edit entry uses manual form and saves changes', async ({ page }) => {
  await resetAppStorage(page);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  await page.locator('#manualActivityInput').selectOption('Automatizované testy');
  await page.locator('#manualDateInput').fill(dateStr);
  await page.locator('#manualStartInput').fill('12:00');
  await page.locator('#manualEndInput').fill('12:30');
  await page.locator('#manualAddBtn').click();

  await page.locator('#entriesBody button.edit').first().click();
  await expect(page.locator('#manualAddBtn')).toHaveText('Uložit změny');

  await page.locator('#manualEndInput').fill('12:45');
  await page.locator('#manualAddBtn').click();

  await expect(page.locator('#manualStatus')).toContainText('Změny byly uloženy');
  await expect(page.locator('#entriesBody tr').first()).toContainText('00:45');
});

test('filters: unusual-only shows manual/short/long flagged entries only', async ({ page }) => {
  await resetAppStorage(page);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // Normal tracked-like entry (but we only have manual entry input). Create 2 entries: 30s (short) and 5min.
  await page.locator('#manualActivityInput').selectOption('Caroda');
  await page.locator('#manualDateInput').fill(dateStr);
  await page.locator('#manualStartInput').fill('13:00');
  await page.locator('#manualEndInput').fill('13:00');
  await page.locator('#manualEndInput').fill('13:01');
  await page.locator('#manualAddBtn').click();

  await page.locator('#manualStartInput').fill('14:00');
  await page.locator('#manualEndInput').fill('14:05');
  await page.locator('#manualAddBtn').click();

  await page.locator('#entriesUnusualOnly').check();

  const rows = page.locator('#entriesBody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Ručně');
});

test('import invalid backup should show an error and not wipe existing entries', async ({ page }) => {
  await resetAppStorage(page);

  // Create a single entry.
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  await page.locator('#manualActivityInput').selectOption('AYM');
  await page.locator('#manualDateInput').fill(dateStr);
  await page.locator('#manualStartInput').fill('15:00');
  await page.locator('#manualEndInput').fill('15:10');
  await page.locator('#manualAddBtn').click();

  await expect(page.locator('#entriesBody tr')).toHaveCount(1);

  // Import invalid backup.
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#importBackupInput').setInputFiles('tests/fixtures/invalid-backup.json');

  await expect(page.locator('#dataToolsStatus')).toHaveClass(/error/);
  await expect(page.locator('#entriesBody tr')).toHaveCount(1);
});

test('active session started yesterday should be auto-stopped on load', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 0, 0, 0);

    const payload = {
      active: { activity: 'Caroda', startTs: yesterday.getTime() },
      entries: []
    };

    localStorage.setItem('tracker-data-v1', JSON.stringify(payload));
  });

  await page.reload();

  // Session from yesterday should be auto-stopped with entry created
  const rows = page.locator('#entriesBody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Caroda');
});

test('session started today survives reload without auto-stop', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const now = Date.now();
    const payload = {
      active: { activity: 'AYM', startTs: now - 60000 }, // 1 min ago (today)
      entries: []
    };
    localStorage.setItem('tracker-data-v1', JSON.stringify(payload));
  });

  await page.reload();

  // Session should still be active
  await expect(page.locator('#activeBadgeText')).toContainText('AYM');
  // No entry should have been created
  const rows = page.locator('#entriesBody tr');
  await expect(rows.first()).toContainText('Zatím žádné záznamy');
});
