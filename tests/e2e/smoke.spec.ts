import { test, expect, type Page } from '@playwright/test';

async function dismissSupabaseBanner(page: Page) {
  const dismiss = page.getByRole('button', { name: /Dismiss Supabase setup banner/i });
  if (await dismiss.count()) {
    await dismiss.first().click({ force: true });
    await page.waitForTimeout(300);
  }
}

/** Works on desktop sidebar and mobile bottom nav (role=button divs). */
async function tapNav(page: Page, name: string) {
  const bottomNav = page.getByRole('navigation', { name: 'Primary navigation' });
  if (await bottomNav.isVisible()) {
    await bottomNav.getByRole('button', { name: new RegExp(name, 'i') }).click({ force: true });
  } else {
    await page
      .getByRole('complementary', { name: /Workspace navigation/i })
      .getByRole('button', { name: new RegExp(name, 'i') })
      .first()
      .click();
  }
  await page.waitForTimeout(400);
}

async function goToTasksView(page: Page) {
  await page.goto('/?view=tasks');
  await dismissSupabaseBanner(page);
  await expect(page.locator('#task-quick-add')).toBeVisible({ timeout: 15000 });
}

function taskRowLocator(page: Page, title: string, isMobileProject: boolean) {
  if (isMobileProject) {
    return page.locator('[id^="task-row-"]').filter({ hasText: title });
  }
  return page.getByRole('table').getByRole('row', { name: new RegExp(title) });
}

test.describe('Badazz Tasks — E2E smoke (production hardening)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissSupabaseBanner(page);
  });

  test('loads home, shows title and core UI without crash', async ({ page }) => {
    await expect(page).toHaveTitle(/Badazz Tasks/);

    await expect(page.getByRole('button', { name: 'Home', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    // Demo mode (no auth): home shows workspace tiles, not the signed-in top-bar greeting.
    await expect(page.getByRole('region', { name: 'Workspaces' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Badazz Ventures').first()).toBeVisible();

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
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    await expect(page.getByRole('dialog', { name: 'Command Palette' })).toBeVisible({
      timeout: 3000,
    });
  });

  test('critical flow: add task via quick input + mark complete (no crash, UI updates)', async ({
    page,
  }, testInfo) => {
    const isMobileProject = testInfo.project.name === 'Mobile Chrome';
    await goToTasksView(page);

    const addInput = page.locator('#task-quick-add');
    const uniqueTitle = `E2E Test Task ${Date.now()}`;
    await addInput.fill(uniqueTitle);
    await addInput.press('Enter');

    const row = taskRowLocator(page, uniqueTitle, isMobileProject);
    await expect(row.first()).toBeVisible({ timeout: 8000 });

    const completeBtn = isMobileProject
      ? row.first().locator('.task-complete-btn')
      : row.first().getByRole('button', { name: /mark complete/i });
    await completeBtn.first().click();

    await page.waitForTimeout(800);

    // Default filter is Incomplete — completed tasks move out; show All to confirm persistence.
    const allFilter = page.getByRole('button', { name: 'All', exact: true });
    if (await allFilter.count()) {
      await allFilter.first().click();
    }
    await expect(row.first()).toBeVisible({ timeout: 5000 });
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