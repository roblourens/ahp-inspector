import { describe, expect, it } from "vitest";
import { PHASE5_APPENDED_EVENT, phase5FixtureLines } from "./phase5-log.js";

describe("Phase 5 representative fixture", () => {
  it("parses valid lines and includes required UI categories without secrets", () => {
    const lines = phase5FixtureLines();
    const valid: unknown[] = [];
    const invalid: string[] = [];
    for (const line of lines) {
      try {
        valid.push(JSON.parse(line));
      } catch {
        invalid.push(line);
      }
    }
    expect(valid.length).toBeGreaterThanOrEqual(6);
    expect(invalid.length).toBeGreaterThanOrEqual(1);
    const text = JSON.stringify(valid);
    expect(text).toContain("initialize");
    expect(text).toContain("tool_call.started");
    expect(text).toContain("authRequired");
    expect(text).toContain("retrowave search needle");
    expect(text).not.toMatch(/\/Users\//);
    expect(text).not.toMatch(/\/home\//);
    expect(text).not.toMatch(/[A-Za-z]:\\\\/);
    expect(text).not.toContain("token-");
    expect(JSON.parse(PHASE5_APPENDED_EVENT)).toBeTruthy();
  });
});
