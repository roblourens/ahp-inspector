import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { PHASE5_BASE_JSONL } from "../packages/ui/src/test-fixtures/phase5-log";
import { type CliServer, startCli, stopCli } from "./helpers/cli";

const SCREENSHOT_DIR = resolve("screenshots/phase12");

test.describe("Phase 12 search rather than filter", () => {
  let dir = "";
  let proc: CliServer | undefined;
  let url = "";

  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    dir = await mkdtemp(join(tmpdir(), "ahp-phase12-e2e-"));
    const file = join(dir, "phase12-browser-safe.jsonl");
    await writeFile(file, PHASE5_BASE_JSONL);
    proc = await startCli([file]);
    url = proc.url;
  });

  test.afterAll(async () => {
    await stopCli(proc);
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("search marks and navigates matches while filters still narrow rows", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();

    await page.keyboard.press("ControlOrMeta+f");
    await page.getByPlaceholder(/all JSON payloads/).fill("retrowave");
    await expect(page.getByTestId("search-status")).toContainText(/1 result/);
    await expect(page.getByTestId("row-0")).toBeVisible();
    await expect(page.getByTestId("row-4")).toHaveAttribute("data-search-match", "true");

    await page.getByRole("button", { name: "Next result" }).click();
    await expect(page.getByTestId("row-4")).toHaveAttribute("data-selected", "true");
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "01-search-keeps-context.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: /Dir/i }).click();
    await page.getByText("c2s", { exact: true }).click();
    await expect(page.getByTestId("active-filter-chips")).toBeVisible();
    await expect(page.getByText("Dir: c2s")).toBeVisible();
    await expect(page.getByTestId("row-0")).toHaveCount(0);
  });
});
