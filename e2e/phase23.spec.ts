import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { type CliServer, startCli, stopCli } from "./helpers/cli";

const PHASE23_FIXTURE = resolve("test/fixtures/phase4.1-real-shapes.safe.jsonl");
const PHASE23_LONG_FIXTURE = resolve("test/fixtures/long-realistic-ahp.jsonl");
const SCREENSHOT_DIR = resolve("screenshots/phase23");

async function assertNoPathLeak(page: Page): Promise<void> {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\/Users\//);
  expect(body).not.toMatch(/\/home\//);
  expect(body).not.toMatch(/[A-Za-z]:\\/);
}

async function switchToHacker(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Theme picker/ }).click();
  await page.getByRole("menuitemradio", { name: "Hacker" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "hacker");
}

test.describe("Phase 23 Hacker CRT placement", () => {
  let proc: CliServer | undefined;
  let longProc: CliServer | undefined;
  let url = "";
  let longUrl = "";

  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    proc = await startCli([PHASE23_FIXTURE]);
    url = proc.url;
    longProc = await startCli([PHASE23_LONG_FIXTURE]);
    longUrl = longProc.url;
  });

  test.afterAll(async () => {
    await stopCli(proc, longProc);
  });

  test("CRT smoke keeps Hacker surface scoped and drawer geometry usable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();

    await switchToHacker(page);

    const crtSurface = page.getByTestId("crt-display-surface");
    const hackerFilter = await crtSurface.evaluate((surface) => getComputedStyle(surface).filter);
    expect(hackerFilter).not.toContain("ahp-crt-warp");
    expect(hackerFilter).toContain("saturate");
    await expect(page.locator(".crt-curvature-canvas")).toBeVisible();
    const appShell = page.getByTestId("app-shell");
    const textGlow = await appShell.evaluate((shell) => getComputedStyle(shell).textShadow);
    expect(textGlow).not.toBe("none");
    const foregroundSweep = await appShell.evaluate(
      (shell) => getComputedStyle(shell, "::after").animationName,
    );
    expect(foregroundSweep).toContain("ahp-crt-foreground-sweep");

    await page.getByTestId("row-0").click();
    await page.keyboard.press("/");
    await page.getByPlaceholder(/all JSON payloads/).fill("session");

    await page.getByRole("button", { name: "Switch log" }).click();
    await expect(page.getByRole("dialog", { name: "Switch log" })).toBeVisible();
    await page
      .getByRole("dialog", { name: "Switch log" })
      .getByRole("button", { name: "Close" })
      .click();

    await page.setViewportSize({ width: 1366, height: 768 });
    const drawerBackdrop = page.getByTestId("detail-drawer-backdrop");
    await expect(drawerBackdrop).toBeVisible();
    const drawerBox = await drawerBackdrop.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox?.x).toBeLessThanOrEqual(1);
    expect(drawerBox?.y).toBeLessThanOrEqual(1);
    expect(drawerBox?.width).toBeGreaterThanOrEqual(1365);
    expect(drawerBox?.height).toBeGreaterThanOrEqual(767);
    await page.getByRole("button", { name: "Close details" }).click();

    await page.getByRole("button", { name: /Theme picker/ }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect
      .poll(() => crtSurface.evaluate((surface) => getComputedStyle(surface).filter))
      .toBe("none");
    await expect(page.locator(".crt-curvature-canvas")).toBeHidden();
  });

  test("captures fixture-only CRT screenshots and reduced-motion evidence", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();
    await switchToHacker(page);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "01-hacker-desktop-crt.png"),
      fullPage: true,
    });

    await page.getByTestId("row-0").click();
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(page.getByTestId("detail-drawer-backdrop")).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "02-hacker-drawer-crt.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Close details" }).click();
    await page.setViewportSize({ width: 768, height: 900 });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "03-hacker-narrow-edge-crt.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "04-hacker-ultrawide-crt.png"),
      fullPage: true,
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "hacker");
    const reducedMotionAnimation = await page
      .getByTestId("crt-display-surface")
      .evaluate((surface) => getComputedStyle(surface).animationName);
    expect(reducedMotionAnimation).toBe("none");
    const reducedMotionForegroundAnimation = await page
      .getByTestId("app-shell")
      .evaluate((shell) => getComputedStyle(shell, "::after").animationName);
    expect(reducedMotionForegroundAnimation).toBe("none");
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "05-hacker-reduced-motion-static.png"),
      fullPage: true,
    });
    await assertNoPathLeak(page);
  });

  test("long-realistic fixture keeps rows, detail, and status visible without page errors", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(longUrl);
    const visibleRow = page.locator('[data-testid^="row-"]').first();
    await expect(visibleRow).toBeVisible({ timeout: 15_000 });
    await visibleRow.click();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    await expect(page.getByTestId("status-bar")).toBeVisible();
    await assertNoPathLeak(page);
    expect(pageErrors).toEqual([]);
  });
});
