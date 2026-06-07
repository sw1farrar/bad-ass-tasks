/**
 * Captures real app screenshots for the marketing landing page.
 * Run: npm run capture:landing
 *
 * Starts demo mode on :3002 (Supabase env cleared).
 */
import { test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "landing", "screenshots");

async function dismissDevOverlay(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    document.querySelectorAll("[data-landing-capture-hide]").forEach((el) => el.remove());
  });
}

async function prepareMarketingShot(page: Page) {
  await dismissDevOverlay(page);

  const dismissSupabase = page.getByRole("button", {
    name: /Dismiss Supabase setup banner/i,
  });
  if (await dismissSupabase.count()) {
    await dismissSupabase.first().click({ force: true });
    await page.waitForTimeout(400);
  }

  await page.evaluate(() => {
    const hideText = (needle: string) => {
      for (const el of document.querySelectorAll("*")) {
        const text = el.textContent?.trim() ?? "";
        if (text === needle || (text.includes(needle) && text.length < 160)) {
          const target =
            el.closest(".fixed") ??
            el.closest(".glass") ??
            (el.childElementCount === 0 ? el : null);
          if (target instanceof HTMLElement) target.style.display = "none";
        }
      }
    };

    hideText("Demo mode");
    hideText("Connect Supabase");
    hideText("Connect to Supabase for real data");

    for (const el of document.querySelectorAll("button, a, span")) {
      const text = el.textContent?.trim();
      if (text === "Sign in" || text === "DEMO") {
        (el as HTMLElement).style.visibility = "hidden";
      }
    }

    for (const el of document.querySelectorAll("div")) {
      if (el.textContent?.trim() === "Real-time sync active.") {
        (el as HTMLElement).style.display = "none";
      }
    }
  });

  await page.waitForTimeout(500);
}

async function waitForAppReady(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Home", exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
  await prepareMarketingShot(page);
}

async function tapNav(page: Page, name: string) {
  await dismissDevOverlay(page);
  const bottomNav = page.getByRole("navigation", { name: "Primary navigation" });
  if (await bottomNav.count()) {
    await bottomNav.getByRole("button", { name: new RegExp(name, "i") }).click({ force: true });
  } else {
    await page.getByRole("button", { name, exact: true }).first().click({ force: true });
  }
  await page.waitForTimeout(700);
  await prepareMarketingShot(page);
}

async function goHome(page: Page) {
  await tapNav(page, "Home");
}

async function goTasks(page: Page) {
  await tapNav(page, "Tasks");
  await page.locator("#task-quick-add").waitFor({ state: "visible", timeout: 8000 });
  const allFilter = page.getByRole("button", { name: "All", exact: true });
  if (await allFilter.count()) {
    await allFilter.first().click({ force: true });
    await page.waitForTimeout(500);
  }
}

async function goNotes(page: Page) {
  await tapNav(page, "Notes");
  await page.getByLabel("Notes tree").waitFor({ state: "visible", timeout: 8000 });
}

async function goTeam(page: Page) {
  await tapNav(page, "Team");
  await page.waitForTimeout(800);
}

async function captureAppChrome(page: Page, filename: string) {
  await prepareMarketingShot(page);
  const filePath = path.join(OUT_DIR, filename);
  await page.screenshot({
    path: filePath,
    type: "png",
    fullPage: false,
  });
}

test.describe("Capture landing screenshots", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test("desktop views @1440x900", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await waitForAppReady(page);

    await goHome(page);
    await captureAppChrome(page, "desktop-home.png");

    await goTasks(page);
    await captureAppChrome(page, "desktop-tasks.png");

    await goNotes(page);
    await captureAppChrome(page, "desktop-notes.png");

    await goTeam(page);
    await captureAppChrome(page, "desktop-team.png");

    await context.close();
  });

  test("mobile views @390x844", async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await waitForAppReady(page);

    await goHome(page);
    await captureAppChrome(page, "mobile-home.png");

    await goTasks(page);
    await captureAppChrome(page, "mobile-tasks.png");

    await goNotes(page);
    await captureAppChrome(page, "mobile-notes.png");

    await goTeam(page);
    await captureAppChrome(page, "mobile-team.png");

    await context.close();
  });
});