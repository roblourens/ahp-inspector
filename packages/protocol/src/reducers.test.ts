import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  AnnotationsAction,
  AutomationAction,
  AutomationRunAction,
  ChangesetAction,
  ChatAction,
  ResourceWatchAction,
  RootAction,
  SessionAction,
  TerminalAction,
} from "./action-origin.generated.js";
import {
  annotationsReducer,
  automationReducer,
  automationRunReducer,
  changesetReducer,
  chatReducer,
  resourceWatchReducer,
  rootReducer,
  sessionReducer,
  terminalReducer,
} from "./reducers.js";
import type {
  AnnotationsState,
  AutomationCatalogState,
  AutomationRunState,
  ChangesetState,
  ChatState,
  ResourceWatchState,
  RootState,
  SessionState,
  TerminalState,
} from "./state.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const fixtureDir = resolve(root, "../test-cases/reducers");
const MOCK_NOW = 9999;

interface Fixture {
  description: string;
  reducer:
    | "annotations"
    | "automation"
    | "automationRun"
    | "changeset"
    | "chat"
    | "resourceWatch"
    | "root"
    | "session"
    | "terminal";
  initial:
    | AnnotationsState
    | AutomationCatalogState
    | AutomationRunState
    | ChangesetState
    | ChatState
    | ResourceWatchState
    | RootState
    | SessionState
    | TerminalState;
  actions: unknown[];
  expected: Fixture["initial"];
}

function nullToUndefined(value: unknown): unknown {
  if (value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(nullToUndefined);
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = nullToUndefined(item);
    }
    return result;
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

  it("loads non-empty channel fixture coverage", () => {
    expect(fixtures.length).toBeGreaterThan(0);
    expect(fixtures.some((fixture) => fixture.reducer === "changeset")).toBe(true);
    expect(fixtures.some((fixture) => fixture.reducer === "chat")).toBe(true);
    expect(fixtures.some((fixture) => fixture.reducer === "annotations")).toBe(true);
    expect(fixtures.some((fixture) => fixture.reducer === "resourceWatch")).toBe(true);
    expect(fixtures.some((fixture) => fixture.reducer === "automation")).toBe(true);
    expect(fixtures.some((fixture) => fixture.reducer === "automationRun")).toBe(true);
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
        } else if (fixture.reducer === "chat") {
          state = chatReducer(state as ChatState, action as ChatAction);
        } else if (fixture.reducer === "terminal") {
          state = terminalReducer(state as TerminalState, action as TerminalAction);
        } else if (fixture.reducer === "changeset") {
          state = changesetReducer(state as ChangesetState, action as ChangesetAction);
        } else if (fixture.reducer === "annotations") {
          state = annotationsReducer(state as AnnotationsState, action as AnnotationsAction);
        } else if (fixture.reducer === "resourceWatch") {
          state = resourceWatchReducer(state as ResourceWatchState, action as ResourceWatchAction);
        } else if (fixture.reducer === "automation") {
          state = automationReducer(state as AutomationCatalogState, action as AutomationAction);
        } else if (fixture.reducer === "automationRun") {
          state = automationRunReducer(state as AutomationRunState, action as AutomationRunAction);
        } else {
          state = sessionReducer(state as SessionState, action as SessionAction);
        }
      }
      expect(state).toEqual(fixture.expected);
    });
  }
});
