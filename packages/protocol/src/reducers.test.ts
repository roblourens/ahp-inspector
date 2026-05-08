import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RootAction, SessionAction, TerminalAction } from "./action-origin.generated.js";
import { rootReducer, sessionReducer, terminalReducer } from "./reducers.js";
import type { RootState, SessionState, TerminalState } from "./state.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const fixtureDir = resolve(root, "../test-cases/reducers");
const MOCK_NOW = 9999;

interface Fixture {
  description: string;
  reducer: "root" | "session" | "terminal";
  initial: RootState | SessionState | TerminalState;
  actions: unknown[];
  expected: RootState | SessionState | TerminalState;
}

function nullToUndefined<T>(value: T): T {
  if (value === null) {
    return undefined as T;
  }
  if (Array.isArray(value)) {
    return value.map(nullToUndefined) as T;
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = nullToUndefined(item);
    }
    return result as T;
  }
  return value;
}

function readFixtures(): Fixture[] {
  const fixtureFiles = readdirSync(fixtureDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  return fixtureFiles.map((fileName) => {
    const raw = JSON.parse(readFileSync(resolve(fixtureDir, fileName), "utf8")) as unknown;
    return nullToUndefined(raw) as Fixture;
  });
}

describe("reducer fixtures", () => {
  const fixtures = readFixtures();
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    originalDateNow = Date.now;
    Date.now = () => MOCK_NOW;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  it("loads non-empty root, session, and terminal fixture coverage", () => {
    expect(fixtures.length).toBeGreaterThan(0);
    expect(fixtures.some((fixture) => fixture.reducer === "root")).toBe(true);
    expect(fixtures.some((fixture) => fixture.reducer === "session")).toBe(true);
    expect(fixtures.some((fixture) => fixture.reducer === "terminal")).toBe(true);
  });

  for (const fixture of fixtures) {
    it(fixture.description, () => {
      let state = fixture.initial;
      for (const action of fixture.actions) {
        if (fixture.reducer === "root") {
          state = rootReducer(state as RootState, action as RootAction);
        } else if (fixture.reducer === "terminal") {
          state = terminalReducer(state as TerminalState, action as TerminalAction);
        } else {
          state = sessionReducer(state as SessionState, action as SessionAction);
        }
      }
      expect(state).toEqual(fixture.expected);
    });
  }
});
