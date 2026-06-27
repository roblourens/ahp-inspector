import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

// Phase 34 — "rethink search result navigation & focus behavior" end-to-end.
//
// Self-spawn CLI pattern (see e2e/phase29.spec.ts), but spawned on the COMMITTED
// synthetic fixture `test/fixtures/phase34-find-nav.jsonl` — never the shared
// base log and never a temp directory. Per copilot-instructions, every committed
// screenshot
// here derives from that fixture only, so no real path/secret can ever land in
// version history. `assertNoPathLeak` guards the rendered UI before each capture.
//
// The fixture holds 5 events sharing the literal token "telemetry":
//   result 1: initialize           (telemetry in capabilities payload)
//   result 2: action               (actionType telemetry.flush)
//   result 3: workspace/executeCommand — telemetry ONLY in the nested
//             params.config.options.flags.telemetryMode branch (D-09 reveal)
//   result 4: notification         (type telemetry.report)
//   result 5: telemetry/report     (method NAME contains telemetry → row <mark>)

const CLI_ENTRY = resolve("packages/cli/src/index.ts");
const TSX_BIN = resolve("node_modules/.bin/tsx");
const FIXTURE = resolve("test/fixtures/phase34-find-nav.jsonl");
const SCREENSHOT_DIR = resolve("screenshots/phase34");
const QUERY = "telemetry";

// The workspace/executeCommand event whose only telemetry match is nested.
const RESULT_EXECUTE_COMMAND = 3;
// The telemetry/report request whose method name itself contains the token.
const RESULT_METHOD_NAMED = 5;

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

const DESKTOP = { width: 1440, height: 900 } as const;
const NARROW = { width: 1366, height: 900 } as const;

let proc: CliProc;
let url = "";

async function gotoDesktop(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(url);
  await expect(page.getByTestId("row-0")).toBeVisible();
}

async function gotoNarrow(page: Page): Promise<void> {
  await page.setViewportSize(NARROW);
  await page.goto(url);
  await expect(page.getByTestId("row-0")).toBeVisible();
}

/** Open find via the keyboard, type the shared query, wait for a live count. */
async function openFindAndQuery(page: Page): Promise<void> {
  await page.keyboard.press("ControlOrMeta+f");
  await expect(page.getByTestId("search-popover")).toBeVisible();
  const input = page.getByLabel("Search all events");
  await expect(input).toBeFocused();
  await input.fill(QUERY);
  // The event-oriented counter appears once the search resolves.
  await expect(page.getByTestId("search-status")).toContainText(/\bresults?\b/);
}

/** Press Enter `n` times from a fresh search; lands on "{n} of {m} results". */
async function navigateToResult(page: Page, n: number): Promise<void> {
  for (let i = 1; i <= n; i++) {
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("search-status")).toContainText(`${i} of `);
  }
}

/** data-testid of the currently selected (focusable) timeline row, or null. */
function selectedRowTestId(page: Page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid^="row-"]')] as HTMLElement[];
    const sel = rows.find((r) => r.tabIndex === 0);
    return sel?.getAttribute("data-testid") ?? null;
  });
}

test.describe("phase34 find navigation", () => {
  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    proc = spawnCli([FIXTURE, "--port", "0", "--no-open"]);
    const port = await waitForPort(proc);
    url = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await killCli(proc);
  });

  test("navigation: desktop Enter/Shift+Enter advances results, syncs rail, keeps input focus", async ({
    page,
  }) => {
    await gotoDesktop(page);
    await openFindAndQuery(page);

    const status = page.getByTestId("search-status");
    const input = page.getByLabel("Search all events");

    // Before navigating, the counter is event-oriented (D-07): "{m} results".
    await expect(status).toHaveText(/^\d+ results?\+?$/);

    // First Enter selects result 1; the desktop rail reflects it (D-01) and
    // focus never leaves the find input (D-05/D-11).
    await page.keyboard.press("Enter");
    await expect(status).toContainText("1 of ");
    await expect(page.getByTestId("detail-panel-wrapper")).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe(
      "Search all events",
    );

    // Enter again advances 1 → 2 (D-06: one advance per event), focus retained.
    await page.keyboard.press("Enter");
    await expect(status).toContainText("2 of ");
    await expect(input).toBeFocused();

    await page.screenshot({ path: join(SCREENSHOT_DIR, "01-desktop-nav.png"), fullPage: true });

    // Shift+Enter walks back 2 → 1, still without stealing focus (D-11).
    await page.keyboard.press("Shift+Enter");
    await expect(status).toContainText("1 of ");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe(
      "Search all events",
    );

    // The pinned find widget sits above the non-modal desktop rail (D-10).
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "04-find-widget-pinned.png"),
      fullPage: true,
    });
    await assertNoPathLeak(page);
  });

  test("navigation: narrow search nav suppresses drawer; explicit row click opens it", async ({
    page,
  }) => {
    await gotoNarrow(page);
    await openFindAndQuery(page);

    // Search-driven navigation selects rows but must NOT open the drawer (D-02).
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("search-status")).toContainText("2 of ");
    await expect(page.getByTestId("detail-drawer")).toBeHidden();
    expect(await selectedRowTestId(page)).toMatch(/^row-/);

    await page.screenshot({
      path: join(SCREENSHOT_DIR, "02-narrow-no-drawer.png"),
      fullPage: true,
    });

    // An explicit timeline-row click IS different — it opens the drawer (D-04).
    await page.getByTestId("row-0").click();
    await expect(page.getByTestId("detail-drawer")).toBeVisible();

    await assertNoPathLeak(page);
  });

  test("navigation: Escape closes find, preserves results, focuses the current row", async ({
    page,
  }) => {
    await gotoDesktop(page);
    await openFindAndQuery(page);

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("search-status")).toContainText("1 of ");

    // Escape closes find (D-13) and lands focus on the matching row, not the
    // toolbar trigger; results/query are preserved (D-03).
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-popover")).toBeHidden();
    // Row focus lands via requestAnimationFrame, so poll until activeElement
    // settles on the matching row rather than reading it synchronously.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-testid")))
      .toMatch(/^row-/);

    // Reopening find shows the preserved query (results were not cleared).
    await page.keyboard.press("ControlOrMeta+f");
    await expect(page.getByLabel("Search all events")).toHaveValue(QUERY);

    await assertNoPathLeak(page);
  });

  test("repeated Cmd+F refocuses the find input and selects the query (D-12)", async ({ page }) => {
    await gotoDesktop(page);
    await openFindAndQuery(page);

    // A second Cmd/Ctrl+F while find is already open refocuses and selects the
    // entire current query for replace-typing — the popover stays open.
    await page.keyboard.press("ControlOrMeta+f");
    await expect(page.getByTestId("search-popover")).toBeVisible();
    const selected = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | null;
      if (!el) return false;
      return el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0;
    });
    expect(selected).toBe(true);
  });

  test("counter wording is event-oriented results, never 'match' (D-07)", async ({ page }) => {
    await gotoDesktop(page);
    await openFindAndQuery(page);

    const status = page.getByTestId("search-status");

    // Before navigating: "{m} results".
    await expect(status).toHaveText(/^\d+ results?\+?$/);
    expect(await status.innerText()).not.toContain("match");

    // After navigating: "{n} of {m} results".
    await page.keyboard.press("Enter");
    await expect(status).toHaveText(/^\d+ of \d+ results?\+?$/);
    expect(await status.innerText()).not.toContain("match");
  });

  test("query highlighted in the matching row and Raw detail content (D-08)", async ({ page }) => {
    await gotoDesktop(page);
    await openFindAndQuery(page);

    // Select the telemetry/report event whose method NAME contains the query,
    // so the timeline row itself carries a <mark> highlight.
    await navigateToResult(page, RESULT_METHOD_NAMED);

    const selectedTestId = await selectedRowTestId(page);
    expect(selectedTestId).toMatch(/^row-/);
    await expect(page.getByTestId(selectedTestId as string).locator("mark")).not.toHaveCount(0);

    // The detail content highlights the literal query via <mark> in the Raw view.
    await page.getByRole("tab", { name: "Raw" }).click();
    await expect(page.getByTestId("raw-json-view")).toBeVisible();
    await expect(page.getByTestId("detail-panel").locator("mark")).not.toHaveCount(0);

    await page.screenshot({
      path: join(SCREENSHOT_DIR, "03-highlight-detail.png"),
      fullPage: true,
    });
    await assertNoPathLeak(page);
  });

  test("Pretty tab CSS Custom Highlight + nested-branch reveal (D-08, D-09)", async ({ page }) => {
    await gotoDesktop(page);
    await openFindAndQuery(page);

    // Select the workspace/executeCommand event whose only telemetry occurrence
    // lives in the collapsed nested branch params.config.options.flags.telemetryMode.
    await navigateToResult(page, RESULT_EXECUTE_COMMAND);

    await page.getByRole("tab", { name: "Pretty" }).click();
    await expect(page.getByTestId("pretty-json-view")).toBeVisible();

    // The real Chromium runtime registers the named highlight (no markup
    // injection) — proving D-08 highlighting reaches the Pretty tree.
    expect(await page.evaluate(() => CSS.highlights?.has("ahp-search-match"))).toBe(true);

    // The collapsed branch is auto-revealed so the matched key is visible (D-09).
    await expect(page.getByTestId("pretty-json-view").getByText("telemetryMode")).toBeVisible();

    await page.screenshot({
      path: join(SCREENSHOT_DIR, "05-pretty-highlight-reveal.png"),
      fullPage: true,
    });
    await assertNoPathLeak(page);
  });
});
