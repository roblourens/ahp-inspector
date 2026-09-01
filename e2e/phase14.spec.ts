import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PHASE10_STATE_JSONL } from "../packages/ui/src/test-fixtures/phase10-state-log";
import { type CliServer, startCli, stopCli } from "./helpers/cli";

test.describe("phase14 detail panel scroll", () => {
  let dir = "";
  let server: CliServer | undefined;
  let url = "";

  test.beforeAll(async () => {
    await mkdir("screenshots/phase14", { recursive: true });
    dir = await mkdtemp(join(tmpdir(), "ahp-phase14-e2e-"));
    const file = join(dir, "phase14-browser-safe.jsonl");
    await writeFile(file, PHASE10_STATE_JSONL);
    server = await startCli([file]);
    url = server.url;
  });

  test.afterAll(async () => {
    await stopCli(server);
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("response JSON remains reachable by scrolling when state inspector is open", async ({
    page,
  }) => {
    await page.goto(url);
    await expect(page.getByTestId("filter-bar")).toBeVisible({ timeout: 10_000 });

    // Find a response row: kind cell text "RES".
    const responseRow = page.locator("[data-testid^='row-']").filter({ hasText: "RES" }).first();
    await responseRow.scrollIntoViewIfNeeded();
    await responseRow.click();

    await expect(page.getByTestId("detail-panel")).toBeVisible();

    // Open state inspector.
    const stateBtn = page.getByRole("button", { name: "State at this point" });
    await stateBtn.click();
    await expect(page.getByTestId("state-inspector-metadata")).toBeVisible({
      timeout: 10_000,
    });

    // Pick first available resource so the diagnostics panel renders.
    const firstResource = page.getByRole("button", { name: /^(session|root|terminal) /i }).first();
    if ((await firstResource.count()) > 0) {
      await firstResource.click();
    }

    // The new scroll region around StateInspector + tabs + JSON.
    const scrollRegion = page.getByTestId("detail-scroll-region");
    await expect(scrollRegion).toBeVisible();

    // Initial: JSON tabpanel may be off-screen due to large state inspector.
    // Scroll the region all the way down.
    await scrollRegion.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // After scrolling, the tab panel content (Pretty JSON) must be reachable.
    const tabpanel = page.getByTestId("detail-panel").getByRole("tabpanel").last();
    await expect(tabpanel).toBeVisible();
    const tabBox = await tabpanel.boundingBox();
    const regionBox = await scrollRegion.boundingBox();
    expect(tabBox).not.toBeNull();
    expect(regionBox).not.toBeNull();
    if (tabBox && regionBox) {
      // tab panel intersects the visible region after scrolling
      const visible =
        tabBox.y < regionBox.y + regionBox.height && tabBox.y + tabBox.height > regionBox.y;
      expect(visible).toBe(true);
    }

    await page.screenshot({
      path: "screenshots/phase14/detail-scroll-after-state.png",
      fullPage: false,
    });
  });
});
