// Dependency allow-list: enforces the local-only privacy posture and prevents
// silent introduction of telemetry/CDN/analytics deps. Mitigates T-01-02.
//
// Phase 1 allow-list. Plan 03 will extend this list with `hono` for the local
// HTTP server. Any other addition requires its own plan to extend ALLOW.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ALLOW = new Set<string>([
  // Tooling
  "typescript",
  "@biomejs/biome",
  "vitest",
  "tsup",
  "tsx",
  "@types/node",
  // Runtime deps
  "commander",
  "chokidar",
  "hono",
  "@hono/node-server",
  "agent-host-protocol",
  // Workspace packages
  "@ahp-viewer/shared",
  "@ahp-viewer/parser",
  "@ahp-viewer/core",
  "@ahp-viewer/host-node",
  "@ahp-viewer/server",
  "@ahp-viewer/cli",
]);

interface PkgJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPkg(path: string): PkgJson {
  return JSON.parse(readFileSync(path, "utf8")) as PkgJson;
}

function listPackageJsons(): string[] {
  const out = [resolve("package.json")];
  const pkgsDir = resolve("packages");
  if (!statSync(pkgsDir).isDirectory()) return out;
  for (const entry of readdirSync(pkgsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = `${pkgsDir}/${entry.name}/package.json`;
    try {
      if (statSync(candidate).isFile()) out.push(candidate);
    } catch {
      // skip
    }
  }
  return out;
}

describe("dependency allow-list", () => {
  const pkgs = listPackageJsons();

  it("finds at least the root + 6 workspace package manifests", () => {
    expect(pkgs.length).toBeGreaterThanOrEqual(7);
  });

  for (const path of pkgs) {
    it(`${path.replace(`${process.cwd()}/`, "")} only declares allow-listed deps`, () => {
      const pkg = readPkg(path);
      const all = new Set<string>([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ]);
      const offenders: string[] = [];
      for (const name of all) if (!ALLOW.has(name)) offenders.push(name);
      expect(offenders, `${path}: unexpected deps: ${offenders.join(", ")}`).toEqual([]);
    });
  }
});
