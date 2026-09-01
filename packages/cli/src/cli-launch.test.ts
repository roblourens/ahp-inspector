// CLI launch happy-path integration test (Plan 02-05 Task 2).
// Spawns ahp-inspector via tsx with a mini fixture, asserts UI-SPEC §10 success
// copy and clean SIGTERM shutdown. Verifies loopback-only binding.

import { afterEach, describe, expect, it } from "vitest";
import { CLI_MINI, spawnCliRaw, waitForExit, waitForLine } from "./cli-test-helpers.js";

describe("ahp-inspector CLI launch (Plan 02-05)", () => {
  // biome-ignore lint/suspicious/noExplicitAny: track the latest child for teardown
  let lastChild: any = null;

  afterEach(() => {
    if (lastChild && !lastChild.killed && lastChild.exitCode === null) {
      try {
        lastChild.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
    lastChild = null;
  });

  it("prints §10 success copy and exits cleanly on SIGTERM", async () => {
    const r = spawnCliRaw([CLI_MINI, "--port", "0", "--no-open"]);
    lastChild = r.child;

    const successLine = await waitForLine(r, /AHP Inspector running at http:\/\/127\.0\.0\.1:\d+/);
    expect(successLine).toMatch(/^AHP Inspector running at http:\/\/127\.0\.0\.1:\d+$/);

    // Wait for all three lines.
    await waitForLine(r, /Watching .+cli-mini\.jsonl/);

    // Three §10 lines, in order.
    const lines = r.stdout.split("\n");
    const idxRunning = lines.findIndex((l) => l.startsWith("AHP Inspector running at"));
    const idxOpening = lines.indexOf("Opening browser…");
    const idxWatching = lines.findIndex((l) => l.startsWith("Watching "));
    expect(idxRunning).toBeGreaterThanOrEqual(0);
    expect(idxOpening).toBe(idxRunning + 1);
    expect(idxWatching).toBe(idxRunning + 2);

    // Loopback only.
    expect(r.stdout).not.toMatch(/0\.0\.0\.0/);
    expect(r.stdout).not.toMatch(/localhost/);

    // Watching line ends with the absolute fixture path.
    expect(lines[idxWatching]).toMatch(/^Watching \/.+cli-mini\.jsonl$/);

    r.child.kill("SIGTERM");
    const code = await Promise.race([
      waitForExit(r.child),
      new Promise<number | null>((res) => setTimeout(() => res(-1 as number), 5000)),
    ]);
    // Accept 0 (clean exit) or null (signal-only termination).
    expect(code === 0 || code === null, `exit code ${String(code)}; stderr: ${r.stderr}`).toBe(
      true,
    );
  }, 15_000);

  it("respects --no-open (no browser line beyond the §10 copy)", async () => {
    const r = spawnCliRaw([CLI_MINI, "--port", "0", "--no-open"]);
    lastChild = r.child;
    await waitForLine(r, /AHP Inspector running at http:\/\/127\.0\.0\.1:\d+/);
    await waitForLine(r, /Watching /);
    // Should not have the auto-open fallback line.
    expect(r.stdout).not.toMatch(/could not auto-open/);
    r.child.kill("SIGTERM");
    await waitForExit(r.child);
  }, 10_000);
});
