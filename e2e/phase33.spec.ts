import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { PHASE5_BASE_JSONL } from "../packages/ui/src/test-fixtures/phase5-log";

const CLI_ENTRY = resolve("packages/cli/src/index.ts");
const TSX_BIN = resolve("node_modules/.bin/tsx");
const SCREENSHOT_DIR = resolve("screenshots/phase33");
const PHASE33_ROWS = [
  '{"jsonrpc":"2.0","method":"action","params":{"sessionId":"phase33-session","turnId":"phase33-turn","action":{"type":"foo/bar","summary":"phase33 foo bar synthetic row"}}}',
  '{"jsonrpc":"2.0","method":"action","params":{"sessionId":"phase33-session","turnId":"phase33-turn","action":{"type":"foo/bar/baz","summary":"phase33 foo bar baz synthetic row"}}}',
  '{"jsonrpc":"2.0","id":"phase33-initialize","method":"initialize","params":{"sessionId":"phase33-session","clientInfo":{"name":"phase33-safe-fixture"}}}',
  '{"jsonrpc":"2.0","method":"action","params":{"sessionId":"phase33-session","turnId":"phase33-turn","action":{"type":"/leading","summary":"phase33 leading slash synthetic row"}}}',
  '{"jsonrpc":"2.0","method":"action","params":{"sessionId":"phase33-session","turnId":"phase33-turn","action":{"type":"trailing/","summary":"phase33 trailing slash synthetic row"}}}',
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
  const exited = await Promise.race([
    proc.exited.then(() => true),
    new Promise<boolean>((resolveExit) => setTimeout(() => resolveExit(false), 3000)),
  ]);
  if (!exited && proc.child.exitCode === null) {
    proc.child.kill("SIGKILL");
    await proc.exited;
  }
}

async function assertNoPathLeak(page: Page): Promise<void> {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\/Users\//);
  expect(body).not.toMatch(/\/home\//);
  expect(body).not.toMatch(/[A-Za-z]:\\/);
}

async function switchTheme(page: Page, label: ThemeLabel, value: ThemeValue): Promise<void> {
  await page.getByRole("button", { name: /Theme picker/ }).click();
  await page.getByRole("menuitemradio", { name: label }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", value);
}

async function capture(page: Page, filename: string): Promise<void> {
  await assertNoPathLeak(page);
  await page.screenshot({ path: join(SCREENSHOT_DIR, filename), fullPage: true });
}

async function assertCompactRows(page: Page): Promise<void> {
  const firstEventRow = page.locator('[role="row"][data-testid^="row-"]').first();
  await expect(firstEventRow).toBeVisible();
  await expect(firstEventRow).toHaveCSS("height", "21px");
  const box = await firstEventRow.boundingBox();
  expect(box).not.toBeNull();
  if (box) expect(Math.round(box.height)).toBe(21);
}

async function expectVisibleLabel(locator: Locator, text: string): Promise<void> {
  await expect(locator.filter({ hasText: text }).first()).toBeVisible();
}

test.describe("Phase 33 timeline density and event-name hierarchy", () => {
  let dir = "";
  let file = "";
  let proc: CliProc;
  let url = "";

  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    dir = await mkdtemp(join(tmpdir(), "ahp-phase33-e2e-"));
    file = join(dir, "phase33-browser-safe.jsonl");
    await writeFile(file, `${PHASE5_BASE_JSONL}${PHASE33_ROWS}\n`);
    proc = spawnCli([file, "--port", "0", "--no-open"]);
    const port = await waitForPort(proc);
    url = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await killCli(proc);
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("captures all-theme fixture-only evidence for compact hierarchy styling", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();
    await switchTheme(page, "Dark", "dark");

    const labels = page.getByTestId("event-name-label");
    await expectVisibleLabel(labels, "foo/bar");
    await expectVisibleLabel(labels, "foo/bar/baz");
    await expectVisibleLabel(labels, "initialize");
    await expectVisibleLabel(labels, "/leading");
    await expectVisibleLabel(labels, "trailing/");
    await expectVisibleLabel(page.getByTestId("event-name-prefix"), "foo/");
    await expectVisibleLabel(page.getByTestId("event-name-leaf"), "bar");
    await expectVisibleLabel(page.getByTestId("event-name-prefix"), "foo/bar/");
    await expectVisibleLabel(page.getByTestId("event-name-leaf"), "baz");
    await assertCompactRows(page);
    await capture(page, "01-dark-density-desktop.png");

    await switchTheme(page, "Light", "light");
    await assertCompactRows(page);
    await capture(page, "02-light-density-desktop.png");

    await switchTheme(page, "Hacker", "hacker");
    await assertCompactRows(page);
    await capture(page, "03-hacker-density-desktop.png");
  });
});
