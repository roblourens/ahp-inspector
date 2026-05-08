import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  PHASE5_APPENDED_EVENT,
  PHASE5_BASE_JSONL,
} from "../packages/ui/src/test-fixtures/phase5-log";

const CLI_ENTRY = resolve("packages/cli/src/index.ts");
const TSX_BIN = resolve("node_modules/.bin/tsx");
const SCREENSHOT_DIR = resolve("screenshots/phase5");

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

test.describe("Phase 5 browser polish", () => {
  let dir = "";
  let file = "";
  let proc: CliProc;
  let url = "";

  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    dir = await mkdtemp(join(tmpdir(), "ahp-phase5-e2e-"));
    file = join(dir, "phase5-browser-safe.jsonl");
    await writeFile(file, PHASE5_BASE_JSONL);
    proc = spawnCli([file, "--port", "0", "--no-open"]);
    const port = await waitForPort(proc);
    url = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await killCli(proc);
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("opens fixture, filters/searches, expands detail, switches themes, captures UAT screenshots, and follows appended events", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();
    await page.getByTestId("row-0").click();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Pretty/i })).toBeVisible();
    await page.screenshot({ path: join(SCREENSHOT_DIR, "01-dark-desktop.png"), fullPage: true });

    await page.getByRole("button", { name: /Theme picker/ }).click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.screenshot({ path: join(SCREENSHOT_DIR, "02-light-desktop.png"), fullPage: true });

    await page.getByRole("button", { name: /Theme picker/ }).click();
    await page.getByRole("menuitemradio", { name: "Hacker" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "hacker");
    await page.screenshot({ path: join(SCREENSHOT_DIR, "03-hacker-desktop.png"), fullPage: true });

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "hacker");

    await page.keyboard.press("/");
    await page.getByPlaceholder(/all JSON payloads/).fill("retrowave");
    await expect(page.getByTestId("row-4")).toBeVisible();
    await assertNoPathLeak(page);

    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(page.getByRole("button", { name: "Close details" })).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("ahp-theme", "dark");
    });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "04-laptop-drawer-dark.png"),
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "hacker");
      localStorage.setItem("ahp-theme", "hacker");
    });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "05-laptop-drawer-hacker.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Close details" }).click();

    await page.setViewportSize({ width: 768, height: 900 });
    await page.getByRole("button", { name: /Theme picker/ }).click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await page.screenshot({ path: join(SCREENSHOT_DIR, "06-narrow-light.png"), fullPage: true });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole("button", { name: /Theme picker/ }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await page.screenshot({ path: join(SCREENSHOT_DIR, "07-wide-dark.png"), fullPage: true });

    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.getByRole("button", { name: /Theme picker/ }).click();
    await page.getByRole("menuitemradio", { name: "Hacker" }).click();
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "08-ultrawide-hacker.png"),
      fullPage: true,
    });

    await page.getByPlaceholder(/all JSON payloads/).fill("no-results-phase-five");
    await page.getByRole("button", { name: /Theme picker/ }).click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await page.screenshot({ path: join(SCREENSHOT_DIR, "09-empty-light.png"), fullPage: true });

    await page.getByPlaceholder(/all JSON payloads/).fill("malformed");
    await page.getByRole("button", { name: /Theme picker/ }).click();
    await page.getByRole("menuitemradio", { name: "Hacker" }).click();
    await page.screenshot({ path: join(SCREENSHOT_DIR, "10-errors-hacker.png"), fullPage: true });

    await page.getByPlaceholder(/all JSON payloads/).fill("");
    await appendFile(file, `${PHASE5_APPENDED_EVENT}\n`);
    await expect(page.getByText(/append sentinel/)).toBeVisible({ timeout: 5000 });
    await assertNoPathLeak(page);
  });
});
