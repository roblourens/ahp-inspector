import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { PHASE5_BASE_JSONL } from "../packages/ui/src/test-fixtures/phase5-log";

const CLI_ENTRY = resolve("packages/cli/src/index.ts");
const TSX_BIN = resolve("node_modules/.bin/tsx");
const SCREENSHOT_DIR = resolve("screenshots/phase31");
const SYNTHETIC_METHOD_ROWS = [
  '{"jsonrpc":"2.0","id":"phase31-zeta","method":"ZetaMethod","params":{"sessionId":"session-zeta","source":"phase31-fixture"}}',
  '{"jsonrpc":"2.0","id":"phase31-alpha-1","method":"alphaMethod","params":{"sessionId":"session-alpha","source":"phase31-fixture"}}',
  '{"jsonrpc":"2.0","id":"phase31-alpha-2","method":"alphaMethod","params":{"sessionId":"session-alpha","source":"phase31-fixture-count"}}',
  '{"jsonrpc":"2.0","id":null,"method":"ping","params":{"source":"phase31-fixture"}}',
].join("\n");

type ThemeLabel = "Dark" | "Light" | "Hacker";
type ThemeValue = "dark" | "light" | "hacker";

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

async function expectContained(child: Locator, container: Locator): Promise<void> {
  const childBox = await child.boundingBox();
  const containerBox = await container.boundingBox();
  expect(childBox).not.toBeNull();
  expect(containerBox).not.toBeNull();
  if (!childBox || !containerBox) return;
  expect(childBox.x).toBeGreaterThanOrEqual(containerBox.x);
  expect(childBox.y).toBeGreaterThanOrEqual(containerBox.y);
  expect(childBox.x + childBox.width).toBeLessThanOrEqual(containerBox.x + containerBox.width);
  expect(childBox.y + childBox.height).toBeLessThanOrEqual(containerBox.y + containerBox.height);
}

async function openMethod(page: Page): Promise<Locator> {
  const menu = page.getByRole("listbox");
  if (!(await menu.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /^Method/ }).click();
  }
  await expect(menu).toBeVisible();
  return menu;
}

async function switchTheme(page: Page, label: ThemeLabel, value: ThemeValue): Promise<void> {
  await page.getByRole("button", { name: /Theme picker/ }).click();
  await page.getByRole("menuitemradio", { name: label }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", value);
}

async function assertMethodSurface(page: Page): Promise<void> {
  const menu = await openMethod(page);
  const filterInput = page.getByPlaceholder("Filter…");
  const footerCommand = menu.getByRole("button", { name: /^(Select|Uncheck) all$/ });
  await expect(menu).toBeInViewport();
  await expectContained(filterInput, menu);
  await expectContained(footerCommand, menu);
  await expect(page.getByRole("button", { name: "Close" })).toHaveCount(0);
}

async function capture(page: Page, filename: string): Promise<void> {
  await assertNoPathLeak(page);
  await page.screenshot({ path: join(SCREENSHOT_DIR, filename), fullPage: true });
}

test.describe("Phase 31 filter picker polish", () => {
  let dir = "";
  let file = "";
  let proc: CliProc;
  let url = "";

  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    dir = await mkdtemp(join(tmpdir(), "ahp-phase31-e2e-"));
    file = join(dir, "phase31-browser-safe.jsonl");
    await writeFile(file, `${PHASE5_BASE_JSONL}${SYNTHETIC_METHOD_ROWS}\n`);
    proc = spawnCli([file, "--port", "0", "--no-open"]);
    const port = await waitForPort(proc);
    url = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await killCli(proc);
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("proves contextual behavior, containment, themes, and fixture privacy", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();
    await switchTheme(page, "Dark", "dark");

    const menu = await openMethod(page);
    const ping = page.getByRole("checkbox", { name: /ping/i });
    await expect(ping).not.toBeChecked();
    await expect(menu.getByRole("button", { name: "Select all" })).toHaveCount(1);
    await expect(menu.getByRole("button", { name: "Uncheck all" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close" })).toHaveCount(0);

    const labels = await menu.locator("label[title] > span:first-of-type").allTextContents();
    expect(labels).toEqual(
      [...labels].sort((a, b) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase())),
    );
    const counts = await menu.locator("label[title] > span:last-of-type").allTextContents();
    expect(counts.length).toBeGreaterThan(2);
    expect(counts.every((count) => /^\d+$/.test(count.trim()))).toBe(true);
    await assertMethodSurface(page);
    await capture(page, "01-dark-method-desktop.png");

    const filterInput = page.getByPlaceholder("Filter…");
    await filterInput.fill("alphaMethod");
    await expect(page.getByRole("checkbox", { name: /ZetaMethod/i })).toHaveCount(0);
    await menu.getByRole("button", { name: "Select all" }).click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("button", { name: "Uncheck all" })).toHaveCount(1);
    await filterInput.fill("");
    await expect(ping).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /ZetaMethod/i })).toBeChecked();
    await assertMethodSurface(page);

    await switchTheme(page, "Light", "light");
    await assertMethodSurface(page);
    await capture(page, "02-light-method-desktop.png");

    await switchTheme(page, "Hacker", "hacker");
    await assertMethodSurface(page);
    await capture(page, "03-hacker-method-desktop.png");

    await switchTheme(page, "Dark", "dark");
    await page.setViewportSize({ width: 600, height: 900 });
    const narrowMenu = await openMethod(page);
    const narrowMenuBox = await narrowMenu.boundingBox();
    expect(narrowMenuBox).not.toBeNull();
    if (narrowMenuBox) {
      expect(narrowMenuBox.x).toBeGreaterThanOrEqual(0);
      expect(narrowMenuBox.x + narrowMenuBox.width).toBeLessThanOrEqual(600);
    }
    await assertMethodSurface(page);
    await capture(page, "04-dark-method-narrow.png");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: /Group:/i }).click();
    await page.getByRole("radio", { name: "Session", exact: true }).click();
    await page.getByRole("button", { name: /Group: Session/i }).click();
    const sessionRadio = page.getByRole("radio", { name: "Session", exact: true });
    await expect(sessionRadio).toBeChecked();
    const sessionRow = sessionRadio.locator("xpath=..");
    const groupSurface = sessionRow.locator("xpath=..");
    await expect(groupSurface).toBeInViewport();
    await expectContained(sessionRow, groupSurface);
    await capture(page, "05-dark-group-session.png");
  });
});
