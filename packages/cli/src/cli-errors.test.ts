// CLI error-path integration tests (Plan 02-05 Task 2).
// Verifies file-missing, file-not-found, invalid-port, and (optionally)
// port-in-use exit codes + stderr copy match UI-SPEC §10 verbatim.

import { describe, expect, it } from "vitest";
import { CLI_MINI, spawnCli, spawnCliRaw, waitForExit, waitForLine } from "./cli-test-helpers.js";

describe("ahp-inspector CLI errors (Plan 02-05)", () => {
  it("Case A: no file → server launches into no-active-log state (Plan 04-03 D-01)", async () => {
    // Phase 04-03 D-01/D-08 changed CLI to allow no-file launch. The CLI now
    // starts the server and prints a "no log file selected" hint instead of
    // failing. We invoke with --no-open and kill it after the banner appears.
    const proc = spawnCliRaw(["--no-open", "--port", "0"]);
    try {
      const banner = await waitForLine(proc, /AHP Inspector running at http:\/\/127\.0\.0\.1:\d+/);
      expect(banner).toMatch(/127\.0\.0\.1/);
    } finally {
      proc.child.kill("SIGTERM");
      await waitForExit(proc.child);
    }
  }, 10_000);

  it("Case B: non-existent file → log file not found {abs path}, exit 1", async () => {
    const path = `/tmp/does-not-exist-${process.pid}-${Date.now()}.jsonl`;
    const { code, stderr } = await spawnCli([path]);
    expect(code).toBe(1);
    expect(stderr).toMatch(new RegExp(`Error: log file not found: ${path.replace(/\./g, "\\.")}`));
    expect(stderr).toMatch(/Usage: ahp-inspector \[path-to-log\.jsonl\]/);
  }, 10_000);

  it("Case C: invalid --port 70000 → invalid --port value copy, exit 1", async () => {
    const { code, stderr } = await spawnCli([CLI_MINI, "--port", "70000"]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/Error: invalid --port value: 70000\. Use 0–65535\./);
  }, 10_000);

  it("Case D: invalid --port -5 → invalid --port value copy, exit 1", async () => {
    const { code, stderr } = await spawnCli([CLI_MINI, "--port", "-5"]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/invalid --port value: -5/);
  }, 10_000);

  const skipPortInUse = process.env.SKIP_PORT_IN_USE_TEST === "1";
  (skipPortInUse ? it.skip : it)(
    "Case E: port already in use → 'is in use' copy, exit 1",
    async () => {
      // 1. Start a first instance on an ephemeral port and capture it.
      const first = spawnCliRaw([CLI_MINI, "--port", "0", "--no-open"]);
      try {
        const line = await waitForLine(
          first,
          /AHP Inspector running at http:\/\/127\.0\.0\.1:(\d+)/,
        );
        const portMatch = line.match(/:(\d+)$/);
        expect(portMatch).not.toBeNull();
        const port = portMatch?.[1] ?? "";
        expect(port).not.toBe("");

        // 2. Spawn a second instance bound to that exact port.
        const { code, stderr } = await spawnCli([CLI_MINI, "--port", port, "--no-open"], 12_000);
        expect(code).toBe(1);
        expect(stderr).toMatch(
          new RegExp(
            `Error: port ${port} is in use\\. Try: ahp-inspector --port ${Number(port) + 1} `,
          ),
        );
      } finally {
        first.child.kill("SIGTERM");
        await waitForExit(first.child);
      }
    },
    20_000,
  );
});
