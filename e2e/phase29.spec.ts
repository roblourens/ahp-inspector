import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { PHASE5_BASE_JSONL } from "../packages/ui/src/test-fixtures/phase5-log";

const CLI_ENTRY = resolve("packages/cli/src/index.ts");
const TSX_BIN = resolve("node_modules/.bin/tsx");
const SCREENSHOT_DIR = resolve("screenshots/phase29");
const SYNTHETIC_PING =
  '{"jsonrpc":"2.0","id":null,"method":"ping","params":{"source":"phase29-fixture"}}';

interface CliProc {
  child: ChildProcessWithoutNullStreams;
  stdout: string;
  stderr: string;
  exited: Promise<number | null>;
}

function spawnCli(args: string[]): CliProc {
  const child = spawn(TSX_BIN, [CLI_ENTRY, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, BROWSER: "none" },
  }) as ChildProcessWithoutNullStreams;
  const proc: CliProc = {
    child,
    stdout: "",
    stderr: "",
    exited: new Promise((resolveExit) => child.once("exit", (code) => resolveExit(code))),
  };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (data: string) => {
    proc.stdout += data;
  });
  child.stderr.on("data", (data: string) => {
    proc.stderr += data;
  });
  return proc;
}

function waitForPort(proc: CliProc, timeoutMs = 15_000): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const start = Date.now();
    const tick = setInterval(() => {
      const match = proc.stdout.match(/AHP Inspector running at http:\/\/127\.0\.0\.1:(\d+)/);
      if (match?.[1]) {
        clearInterval(tick);
        resolvePort(Number(match[1]));
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(tick);
        reject(new Error(`timeout waiting for CLI port\n${proc.stdout}\n${proc.stderr}`));
      }
    }, 25);
  });
}

async function killCli(proc: CliProc | undefined): Promise<void> {
  if (!proc || proc.child.exitCode !== null) return;
  proc.child.kill("SIGTERM");
  await Promise.race([proc.exited, new Promise((resolveExit) => setTimeout(resolveExit, 3000))]);
}

async function assertNoPathLeak(page: Page): Promise<void> {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\/Users\//);
  expect(body).not.toMatch(/\/home\//);
  expect(body).not.toMatch(/[A-Za-z]:\\/);
}

test.describe("Phase 29 Escape closes find widget without clearing the filter box", () => {
  let dir = "";
  let file = "";
  let proc: CliProc;
  let url = "";

  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    dir = await mkdtemp(join(tmpdir(), "ahp-phase29-e2e-"));
    file = join(dir, "phase29-browser-safe.jsonl");
    await writeFile(file, `${PHASE5_BASE_JSONL}${SYNTHETIC_PING}\n`);
    proc = spawnCli([file, "--port", "0", "--no-open"]);
    const port = await waitForPort(proc);
    url = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await killCli(proc);
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

    // 4. Escape again (no find widget open) still never clears the filter box.
    await page.keyboard.press("Escape");
    await expect(filterRows).toHaveValue("workspace");

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
