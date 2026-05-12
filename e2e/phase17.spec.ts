import * as path from "node:path";
import { expect, test } from "@playwright/test";

// Connects to the already-running CLI on 5173 and verifies the drag-and-drop
// open flow against test/fixtures/tiny.jsonl. Playwright cannot supply a real
// file:// URI through dragAndDrop(), so the test synthesizes DragEvents on
// window with a text/uri-list payload — the same shape parseDroppedUri reads.
test.describe("phase17 drag-and-drop open", () => {
  test.use({ baseURL: "http://127.0.0.1:5173" });

  test("drop with a file:// URI opens the dropped log", async ({ page }) => {
    await page.goto("/");
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
