import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { PHASE5_BASE_JSONL } from "../packages/ui/src/test-fixtures/phase5-log";

const CLI_ENTRY = resolve("packages/cli/src/index.ts");
const TSX_BIN = resolve("node_modules/.bin/tsx");
const SCREENSHOT_DIR = resolve("screenshots/phase12");

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
  await Promise.race([proc.exited, new Promise((resolveKill) => setTimeout(resolveKill, 3000))]);
}

test.describe("Phase 12 search rather than filter", () => {
  let dir = "";
  let proc: CliProc;
  let url = "";

  test.beforeAll(async () => {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    dir = await mkdtemp(join(tmpdir(), "ahp-phase12-e2e-"));
    const file = join(dir, "phase12-browser-safe.jsonl");
    await writeFile(file, PHASE5_BASE_JSONL);
    proc = spawnCli([file, "--port", "0", "--no-open"]);
    const port = await waitForPort(proc);
    url = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    await killCli(proc);
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test("search marks and navigates matches while filters still narrow rows", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    await expect(page.getByTestId("row-0")).toBeVisible();

    await page.getByPlaceholder(/all JSON payloads/).fill("retrowave");
    await expect(page.getByTestId("search-status")).toContainText(/1 match/);
    await expect(page.getByTestId("row-0")).toBeVisible();
    await expect(page.getByTestId("row-4")).toHaveAttribute("data-search-match", "true");

    await page.getByRole("button", { name: "Next search match" }).click();
    await expect(page.getByTestId("row-4")).toHaveAttribute("data-selected", "true");
    await page.screenshot({
      path: join(SCREENSHOT_DIR, "01-search-keeps-context.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: /Dir/i }).click();
    await page.getByText("s2c", { exact: true }).click();
    await expect(page.getByTestId("active-filter-chips")).toBeVisible();
    await expect(page.getByText("Dir: s2c")).toBeVisible();
    await expect(page.getByTestId("row-0")).toHaveCount(0);
  });
});
