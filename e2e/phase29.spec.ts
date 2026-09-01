import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { PHASE5_BASE_JSONL } from "../packages/ui/src/test-fixtures/phase5-log";
import { type CliServer, startCli, stopCli } from "./helpers/cli";

const SCREENSHOT_DIR = resolve("screenshots/phase29");
const SYNTHETIC_PING =
  '{"jsonrpc":"2.0","id":null,"method":"ping","params":{"source":"phase29-fixture"}}';

async function assertNoPathLeak(page: Page): Promise<void> {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\/Users\//);
  expect(body).not.toMatch(/\/home\//);
  expect(body).not.toMatch(/[A-Za-z]:\\/);
}

test.describe("Phase 29 Escape closes find widget without clearing the filter box", () => {
  let dir = "";
  let file = "";
  let proc: CliServer | undefined;
  let url = "";

  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    dir = await mkdtemp(join(tmpdir(), "ahp-phase29-e2e-"));
    file = join(dir, "phase29-browser-safe.jsonl");
    await writeFile(file, `${PHASE5_BASE_JSONL}${SYNTHETIC_PING}\n`);
    proc = await startCli([file]);
    url = proc.url;
  });

  test.afterAll(async () => {
    await stopCli(proc);
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("Cmd+F → Escape closes the find widget but keeps the filter text", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();

    const filterRows = page.getByLabel("Filter rows");

    // 1. Type text into the row filter box.
    await filterRows.fill("workspace");
    await expect(filterRows).toHaveValue("workspace");

    // 2. Open the find widget with Cmd+F / Ctrl+F.
    await page.keyboard.press("ControlOrMeta+f");
    await expect(page.getByTestId("search-popover")).toBeVisible();

    // 3. Escape dismisses the find widget AND preserves the filter text.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-popover")).toBeHidden();
    await expect(filterRows).toHaveValue("workspace");

    await page.screenshot({
      path: join(SCREENSHOT_DIR, "01-filter-survives-escape.png"),
      fullPage: true,
    });

    // 4. Escape while focus is OUTSIDE the filter box never clears it.
    //    (After the popover closes, focus is on the page body, not the box.)
    await page.keyboard.press("Escape");
    await expect(filterRows).toHaveValue("workspace");

    await assertNoPathLeak(page);
  });

  test("Escape clears the filter box only while focus is inside it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();

    const filterRows = page.getByLabel("Filter rows");
    await filterRows.fill("workspace");
    await expect(filterRows).toHaveValue("workspace");

    // Focus is in the filter box → Escape clears it.
    await filterRows.focus();
    await page.keyboard.press("Escape");
    await expect(filterRows).toHaveValue("");

    await assertNoPathLeak(page);
  });

  test("Escape never clears an active facet filter", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();

    // Hide the ping method via the Method facet so a facet filter is active.
    const methodButton = page.getByRole("button", { name: /^Method/ });
    await methodButton.click();
    const ping = page.getByRole("checkbox", { name: /ping/i });
    if (await ping.isChecked()) {
      await ping.click();
    }
    await expect(ping).not.toBeChecked();
    // Close the facet popover by toggling the Method button.
    await methodButton.click();
    await expect(page.getByRole("listbox")).toBeHidden();

    // Escape with focus on the page body must NOT clear the facet filter.
    await page.locator("body").click();
    await page.keyboard.press("Escape");
    await methodButton.click();
    await expect(page.getByRole("checkbox", { name: /ping/i })).not.toBeChecked();

    await assertNoPathLeak(page);
  });
});
