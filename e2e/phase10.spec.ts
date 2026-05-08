import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { PHASE10_STATE_JSONL } from "../packages/ui/src/test-fixtures/phase10-state-log";

const CLI_ENTRY = resolve("packages/cli/src/index.ts");
const TSX_BIN = resolve("node_modules/.bin/tsx");
const SCREENSHOT_DIR = resolve("screenshots/phase10");

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
    exited: new Promise((res) => child.once("exit", (code) => res(code))),
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
      const match = proc.stdout.match(/AHP Log Viewer running at http:\/\/127\.0\.0\.1:(\d+)/);
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
  await Promise.race([proc.exited, new Promise((res) => setTimeout(res, 3000))]);
}

async function assertNoPathLeak(page: Page): Promise<void> {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\/Users\//);
  expect(body).not.toMatch(/\/home\//);
  expect(body).not.toMatch(/[A-Za-z]:\\/);
}

async function openSessionState(page: Page, rowIdx: number): Promise<void> {
  await page.getByTestId(`row-${rowIdx}`).click();
  await expect(page.getByTestId("detail-panel")).toBeVisible();
  await page.getByRole("button", { name: "State at this point" }).click();
  await expect(page.getByTestId("state-inspector-metadata")).toBeVisible();
  await page.getByRole("button", { name: /session copilot:\/session\/1/i }).click();
  await expect(page.getByTestId("state-view-shell")).toBeVisible();
}

test.describe("Phase 10 pinned state comparison verification", () => {
  let dir = "";
  let file = "";
  let proc: CliProc;
  let url = "";

  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    dir = await mkdtemp(join(tmpdir(), "ahp-phase10-e2e-"));
    file = join(dir, "phase10-browser-safe.jsonl");
    await writeFile(file, PHASE10_STATE_JSONL);
    proc = spawnCli([file, "--port", "0", "--no-open"]);
    const port = await waitForPort(proc);
    url = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await killCli(proc);
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("opens synthetic log, pins two state points, compares diagnostics, captures theme screenshots, and leaks no paths", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url);
    await expect(page.getByTestId("row-1")).toBeVisible();

    await openSessionState(page, 1);
    await page.getByRole("button", { name: "Pin state point" }).click();
    await expect(page.getByText("Pinned 1/2")).toBeVisible();
    await assertNoPathLeak(page);

    await openSessionState(page, 3);
    await page.getByRole("button", { name: "Pin state point" }).click();
    await expect(page.getByText("Pinned comparison")).toBeVisible();
    await expect(page.getByText("Changed top-level paths")).toBeVisible();
    await expect(page.getByLabel("Pinned comparison").getByText("summary")).toBeVisible();
    await expect(page.getByText("Comparison confidence")).toBeVisible();
    await expect(page.getByText("Replay diagnostics")).toBeVisible();
    await expect(page.getByText("unknown-action").first()).toBeVisible();
    await assertNoPathLeak(page);

    await page.screenshot({
      path: join(SCREENSHOT_DIR, "01-dark-state-comparison.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: /Theme picker/ }).click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "02-light-state-comparison.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: /Theme picker/ }).click();
    await page.getByRole("menuitemradio", { name: "Hacker" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "hacker");
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "03-hacker-state-comparison.png"),
      fullPage: true,
    });
    await assertNoPathLeak(page);
  });
});
