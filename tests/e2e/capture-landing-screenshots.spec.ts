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
  await page.goto("/?capture=1");
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
    await page.getByRole("button", { name: new RegExp(name, "i") }).first().click({ force: true });
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

async function goFilesWorkspace(page: Page) {
  await tapNav(page, "Files");
  await page.locator(".files-root").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(400);
}

async function goFilesReview(page: Page) {
  await goFilesWorkspace(page);
  const reviewButton = page.getByRole("button", { name: /^Review$/i });
  if (await reviewButton.count()) {
    await reviewButton.first().click({ force: true });
    await page.waitForTimeout(500);
  }
}

async function goLists(page: Page) {
  await tapNav(page, "Lists");
  await page.locator(".lists-root").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(400);
}

async function goTeam(page: Page) {
  await tapNav(page, "Team");
  await page.waitForTimeout(800);
}

async function goSettingsFilesEmail(page: Page) {
  await page.goto("/?capture=1&view=settings");
  await page.locator(".settings-root").waitFor({ state: "visible", timeout: 10000 });
  await prepareMarketingShot(page);

  await page.evaluate(() => {
    const emailHeading = Array.from(document.querySelectorAll(".settings-panel")).find((panel) =>
      panel.textContent?.includes("Files review email"),
    );
    emailHeading?.scrollIntoView({ block: "center" });

    const panel = emailHeading;
    if (!panel) return;

    for (const hint of panel.querySelectorAll(".settings-inbox-hint, button.settings-inbox-create")) {
      hint.remove();
    }

    const placeholder = panel.querySelector(".text-xs.text-text-muted");
    if (placeholder?.textContent?.includes("No files review email")) {
      placeholder.remove();
    }

    const mount = document.createElement("div");
    mount.innerHTML = `
      <div class="settings-inbox-card rounded-xl border border-border-glass bg-surface-hover p-4 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-medium text-text-primary truncate">Files review email</div>
            <div class="text-[11px] text-text-muted mt-0.5">One address per workspace</div>
          </div>
        </div>
        <div class="settings-inbox-email flex items-center gap-2 rounded-xl border border-neon-purple/20 bg-neon-purple/5 px-3 py-2.5">
          <code class="flex-1 min-w-0 text-xs text-neon-purple-tint font-mono break-all sm:truncate">acme-workspace@inbound.badazztasks.com</code>
          <span class="settings-inbox-copy flex items-center gap-1 rounded-lg border border-border-glass px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-text-secondary shrink-0">Copy</span>
        </div>
      </div>
    `;

    const panels = panel.querySelectorAll("p");
    const lastDesc = panels[panels.length - 1];
    if (lastDesc?.parentElement) {
      lastDesc.parentElement.appendChild(mount.firstElementChild!);
    }
  });

  await page.waitForTimeout(500);
  await prepareMarketingShot(page);
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
    test.setTimeout(120_000);
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

    await goFilesWorkspace(page);
    await captureAppChrome(page, "desktop-notes.png");

    await goLists(page);
    await captureAppChrome(page, "desktop-lists.png");

    await goFilesReview(page);
    await captureAppChrome(page, "desktop-files.png");

    await goSettingsFilesEmail(page);
    await captureAppChrome(page, "desktop-files-email.png");

    await goTeam(page);
    await captureAppChrome(page, "desktop-team.png");

    await context.close();
  });

  test("mobile views @390x844", async ({ browser }) => {
    test.setTimeout(90_000);
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

    await goFilesWorkspace(page);
    await captureAppChrome(page, "mobile-notes.png");

    await goLists(page);
    await captureAppChrome(page, "mobile-lists.png");

    await goFilesReview(page);
    await captureAppChrome(page, "mobile-files.png");

    await goSettingsFilesEmail(page);
    await captureAppChrome(page, "mobile-files-email.png");

    await goTeam(page);
    await captureAppChrome(page, "mobile-team.png");

    await context.close();
  });
});