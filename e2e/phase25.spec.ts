import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { PHASE5_BASE_JSONL } from "../packages/ui/src/test-fixtures/phase5-log";
import { type CliServer, startCli, stopCli } from "./helpers/cli";

const SCREENSHOT_DIR = resolve("screenshots/phase25");
const SYNTHETIC_PING =
  '{"jsonrpc":"2.0","id":null,"method":"ping","params":{"source":"phase25-fixture"}}';

async function assertNoPathLeak(page: Page): Promise<void> {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\/Users\//);
  expect(body).not.toMatch(/\/home\//);
  expect(body).not.toMatch(/[A-Za-z]:\\/);
}

test.describe("Phase 25 row filtering and visibility menus", () => {
  let dir = "";
  let file = "";
  let proc: CliServer | undefined;
  let url = "";

  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    dir = await mkdtemp(join(tmpdir(), "ahp-phase25-e2e-"));
    file = join(dir, "phase25-browser-safe.jsonl");
    await writeFile(file, `${PHASE5_BASE_JSONL}${SYNTHETIC_PING}\n`);
    proc = await startCli([file]);
    url = proc.url;
  });

  test.afterAll(async () => {
    await stopCli(proc);
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("keeps Search independent while row filtering and checked-visible menus reduce the timeline", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();

    // SearchTrigger opens popover; search input is now inside the popover
    const searchTrigger = page.getByRole("button", { name: "Open search" });
    await searchTrigger.click();
    const search = page.getByLabel("Search all events");
    const filterRows = page.getByLabel("Filter rows");
    await search.fill("retrowave");
    await expect(search).toHaveValue("retrowave");
    await expect(page.getByTestId("row-0")).toBeVisible();
    await expect(page.getByTestId("row-4")).toBeVisible();
    await expect(page.getByTestId("row-0")).not.toHaveAttribute("data-search-match", "true");
    await expect(page.getByTestId("row-4")).toHaveAttribute("data-search-match", "true");

    // Take screenshot with SearchPopover open and SearchTrigger active
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "01-search-popover-open.png"),
      fullPage: true,
    });

    await filterRows.fill("workspace");
    await expect(page.getByText("Rows contain: workspace")).toBeVisible();
    await expect(page.getByTestId("row-0")).toBeHidden();
    await expect(page.getByTestId("row-4")).toBeVisible();
    await expect(page.getByText("1/9 events")).toBeVisible();

    await page.getByRole("button", { name: /^Method/ }).click();
    const ping = page.getByRole("checkbox", { name: /ping/i });
    await expect(page.getByRole("checkbox", { name: /workspace\/executeCommand/i })).toBeChecked();
    await expect(ping).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Select all" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Uncheck all" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close" })).toHaveCount(0);
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "02-row-filter-and-facets-with-popover.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Select all" }).click();
    await expect(ping).toBeChecked();
    await expect(page.getByTestId("row-4")).toBeVisible();
    await expect(page.getByRole("button", { name: "Uncheck all" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Select all" })).toHaveCount(0);
    await page.getByRole("button", { name: "Uncheck all" }).click();
    await expect(ping).not.toBeChecked();
    await expect(page.getByTestId("row-4")).toBeHidden();
    await expect(page.getByRole("button", { name: "Select all" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Uncheck all" })).toHaveCount(0);
    await page.getByRole("button", { name: "Select all" }).click();
    await expect(ping).toBeChecked();
    await expect(page.getByTestId("row-4")).toBeVisible();

    await searchTrigger.click();
    await expect(page.getByTestId("search-popover")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear all filters" }).click();
    await expect(filterRows).toHaveValue("");
    await searchTrigger.click();
    await expect(search).toHaveValue("retrowave");

    // Verify SearchTrigger shows active state when query is present
    expect(
      await searchTrigger.evaluate((el) => (el as HTMLButtonElement).style.background),
    ).toContain("var(--color-chip-bg-active)");

    await assertNoPathLeak(page);
  });

  test("keeps row filtering and facet commands readable at narrow width", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();

    const filterRows = page.getByLabel("Filter rows");
    const searchTrigger = page.getByRole("button", { name: "Open search" });

    // Verify RowFilterInput and SearchTrigger are both visible
    await expect(filterRows).toBeVisible();
    await expect(searchTrigger).toBeVisible();

    const filterBox = await filterRows.boundingBox();
    const triggerBox = await searchTrigger.boundingBox();
    expect(filterBox).not.toBeNull();
    expect(triggerBox).not.toBeNull();

    // Filter input should be primary and take up flex space
    // SearchTrigger should be compact 28px button to the right
    if (filterBox && triggerBox) {
      expect(filterBox.width).toBeGreaterThan(triggerBox.width);
    }

    await filterRows.fill("workspace");

    // Open SearchPopover — popover is visible and responds to input
    await searchTrigger.click();
    const popover = page.getByTestId("search-popover");
    await expect(popover).toBeVisible();
    // Popover should be responsive and constrained at narrow widths
    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();
    if (popoverBox) {
      // Popover should be at least 280px wide (min design width)
      expect(popoverBox.width).toBeGreaterThanOrEqual(280);
      // Popover should not exceed available space
      expect(popoverBox.width).toBeLessThanOrEqual(360);
    }

    await page.getByRole("button", { name: /^Method/ }).click();
    await expect(page.getByRole("button", { name: "Select all" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Uncheck all" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close" })).toHaveCount(0);
    const menuBox = await page.getByRole("listbox").boundingBox();
    expect(menuBox).not.toBeNull();
    if (menuBox) {
      expect(menuBox.x).toBeGreaterThanOrEqual(0);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(600);
    }
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "03-narrow-viewport-600px.png"),
      fullPage: true,
    });
    await assertNoPathLeak(page);
  });
});
