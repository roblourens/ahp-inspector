// CLI error-path integration tests (Plan 02-05 Task 2).
// Verifies file-missing, file-not-found, invalid-port, and (optionally)
// port-in-use exit codes + stderr copy match UI-SPEC §10 verbatim.

import { describe, expect, it } from "vitest";
import { CLI_MINI, spawnCli, spawnCliRaw, waitForExit, waitForLine } from "./cli-test-helpers.js";

describe("ahp-viewer CLI errors (Plan 02-05)", () => {
  it("Case A: no file → log file not found + Usage, exit 1", async () => {
    const { code, stderr } = await spawnCli([]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/Error: log file not found:/);
    expect(stderr).toMatch(/Usage: ahp-viewer <path-to-log\.jsonl>/);
  }, 10_000);

  it("Case B: non-existent file → log file not found {abs path}, exit 1", async () => {
    const path = `/tmp/does-not-exist-${process.pid}-${Date.now()}.jsonl`;
    const { code, stderr } = await spawnCli([path]);
    expect(code).toBe(1);
    expect(stderr).toMatch(new RegExp(`Error: log file not found: ${path.replace(/\./g, "\\.")}`));
    expect(stderr).toMatch(/Usage: ahp-viewer <path-to-log\.jsonl>/);
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
          /AHP Log Viewer running at http:\/\/127\.0\.0\.1:(\d+)/,
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
            `Error: port ${port} is in use\\. Try: ahp-viewer --port ${Number(port) + 1} `,
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
