import * as path from "node:path";
import { expect, test } from "@playwright/test";
import { type CliServer, startCli, stopCli } from "./helpers/cli";

// Verifies the drag-and-drop open flow against test/fixtures/tiny.jsonl.
// Playwright cannot supply a real
// file:// URI through dragAndDrop(), so the test synthesizes DragEvents on
// window with a text/uri-list payload — the same shape parseDroppedUri reads.
test.describe("phase17 drag-and-drop open", () => {
  let server: CliServer | undefined;
  let url = "";

  test.beforeAll(async () => {
    server = await startCli();
    url = server.url;
  });

  test.afterAll(async () => {
    await stopCli(server);
  });

  test("drop with a file:// URI opens the dropped log", async ({ page }) => {
    await page.goto(url);
    await expect(page.getByTestId("app-shell")).toBeVisible({ timeout: 10_000 });

    const fixturePath = path.resolve(process.cwd(), "test", "fixtures", "tiny.jsonl");
    const uri = `file://${fixturePath}`;

    await page.evaluate((u) => {
      const dt = new DataTransfer();
      dt.setData("text/uri-list", u);
      const enter = new DragEvent("dragenter", {
        bubbles: true,
        dataTransfer: dt,
      });
      window.dispatchEvent(enter);
    }, uri);

    // Note: synthesized DataTransfer cannot include the "Files" type, so the armed
    // overlay does not appear in this synthetic scenario. Drop handler does not gate
    // on "Files", so the actual open path is exercised end-to-end below.

    await page.evaluate((u) => {
      const dt = new DataTransfer();
      dt.setData("text/uri-list", u);
      const drop = new DragEvent("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(drop, "dataTransfer", {
        value: dt,
        configurable: true,
      });
      window.dispatchEvent(drop);
    }, uri);

    await expect(page.getByText(/tiny\.jsonl/)).toBeVisible({ timeout: 10_000 });
  });
});
