import { test, expect } from "@playwright/test";

test.describe("mobile primary navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps daily tabs on the bar and routes overflow through More", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(nav).toBeVisible();

    await expect(nav.getByRole("button", { name: "Home" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Tasks" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Files" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Lists" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "More" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Team" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Settings" })).toHaveCount(0);

    await nav.getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog", { name: "More navigation" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Team/i })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Settings/i })).toBeVisible();

    await sheet.getByPlaceholder("Go to…").fill("set");
    await expect(sheet.getByRole("button", { name: /Settings/i })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Team/i })).toHaveCount(0);

    await sheet.getByRole("button", { name: /Settings/i }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator(".settings-root")).toBeVisible({ timeout: 8000 });
    await expect(nav.getByRole("button", { name: "More" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("button", { name: /^Tasks/i }).click({ force: true });
    await expect(page.locator(".tasks-root")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("#task-quick-add")).toBeVisible({ timeout: 8000 });
    await expect(nav.getByRole("button", { name: /^Tasks/i })).toHaveAttribute("aria-current", "page");
  });
});
