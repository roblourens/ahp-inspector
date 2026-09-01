import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AHP_SOURCE_COMMIT as BARREL_SOURCE_COMMIT } from "./index.js";
import {
  AHP_GENERATED_FILES,
  AHP_SOURCE_COMMIT,
  AHP_SOURCE_REPOSITORY,
  AHP_SOURCE_TYPES_PATH,
} from "./source-info.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const versionFile = resolve(root, "../.ahp-version");
const expectedTypesPath = `${"../agent-host-protocol"}/types`;

describe("AHP source diagnostics", () => {
  it("exports the synced source commit from source-info", () => {
    const version = readFileSync(versionFile, "utf8").trim();

    expect(AHP_SOURCE_COMMIT).toBe(version);
    expect(AHP_SOURCE_COMMIT).toMatch(/^[0-9a-f]{7,40}$/);
    expect(AHP_SOURCE_COMMIT).not.toBe("unsynced");
    expect(AHP_SOURCE_REPOSITORY).toBe("agent-host-protocol");
    expect(AHP_SOURCE_TYPES_PATH).toBe(expectedTypesPath);
    expect(AHP_GENERATED_FILES).toContain("reducers.ts");
    expect(AHP_GENERATED_FILES).toContain("channels-chat/reducer.ts");
    expect(AHP_GENERATED_FILES).toContain("channels-annotations/state.ts");
    expect(AHP_GENERATED_FILES).toContain("channels-resource-watch/commands.ts");
    expect(AHP_GENERATED_FILES).toContain("channels-otlp/notifications.ts");
    expect(AHP_GENERATED_FILES).toContain("common/timestamps.ts");
    expect(AHP_GENERATED_FILES).toContain("index.ts");
    expect(AHP_GENERATED_FILES).toContain("version/message-checks.ts");
    expect(AHP_GENERATED_FILES).toContain("version/registry.ts");
  });

  it("exports source metadata through the package barrel", () => {
    expect(BARREL_SOURCE_COMMIT).toBe(AHP_SOURCE_COMMIT);
  });
});
