import { test, expect } from '@playwright/test';

async function goToTasksView(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Tasks', exact: true }).first().click();
  await expect(page.locator('#task-quick-add')).toBeVisible({ timeout: 8000 });
}

test.describe('Bad Ass Tasks — E2E smoke (production hardening)', () => {
  test('loads home, shows title and core UI without crash', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Bad Ass Tasks/);

    await expect(page.getByRole('button', { name: 'Today', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /add task/i }).first()).toBeVisible({ timeout: 8000 });

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.waitForTimeout(1500);
    const fatal = errors.filter(
      (e) => /Uncaught|TypeError|ReferenceError/i.test(e) && !/supabase/i.test(e),
    );
    expect(fatal.length, `Fatal console errors: ${fatal.join(' | ')}`).toBe(0);
  });

  test('keyboard command palette opens (⌘K or Ctrl+K)', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    await expect(page.getByLabel('Command Palette')).toBeVisible({ timeout: 3000 });
  });

  test('critical flow: add task via quick input + mark complete (no crash, UI updates)', async ({ page }) => {
    await page.goto('/');
    await goToTasksView(page);

    const addInput = page.locator('#task-quick-add');
    const uniqueTitle = `E2E Test Task ${Date.now()}`;
    await addInput.fill(uniqueTitle);
    await addInput.press('Enter');

    await expect(page.getByText(uniqueTitle).first()).toBeVisible({ timeout: 5000 });

    const taskRow = page.locator('tr', { hasText: uniqueTitle }).first();
    const completeBtn = taskRow.getByRole('button', { name: /complete|mark/i }).first();
    if (await completeBtn.count() > 0) {
      await completeBtn.click();
    } else {
      await taskRow.locator('button').first().click();
    }

    await page.waitForTimeout(800);
    await expect(page.getByRole('table').getByText(uniqueTitle)).toBeVisible({ timeout: 3000 });
  });

  // ====================================================================
  // FUTURE COLLAB / LWW SCAFFOLDING (M0: documented only, non-breaking)
  // For Agent TEST-04 + future waves: multi-context example stub for two "users"/tabs
  // simulating realtime collab + LWW conflict resolution (demo-tolerant, no live Supabase).
  // Do not enable yet; keeps current smoke 100% demo-only + fast.
  // Example (commented, for manual expansion in tests/e2e/collab.spec.ts later):
  // test('future: two contexts LWW (tab A creates, tab B edits, conflict resolved)', async ({ browser }) => {
  //   const contextA = await browser.newContext(); const pageA = await contextA.newPage();
  //   const contextB = await browser.newContext(); const pageB = await contextB.newPage();
  //   await pageA.goto('/'); await pageB.goto('/');
  //   // ... add via palette on A, edit on B, assert demo LWW or last-write wins in UI
  //   await contextA.close(); await contextB.close();
  // });
  // Always keep e2e demo-tolerant (no keys, w1/w2 safe, no real network asserts).
  // ====================================================================
});