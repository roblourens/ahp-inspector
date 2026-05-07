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
  "@ahp-viewer/ui",
  // Phase-2 UI runtime + dev deps (allow-listed at plan 02-00)
  "react",
  "react-dom",
  "@vitejs/plugin-react",
  "vite",
  "@tanstack/react-virtual",
  "zustand",
  "lucide-react",
  "tailwindcss",
  "@tailwindcss/vite",
  "open",
  "jsdom",
  "@testing-library/react",
  "@testing-library/user-event",
  "@testing-library/jest-dom",
  "@types/react",
  "@types/react-dom",
  // Phase-3 UI runtime dep (plan 03-00)
  "react-json-view-lite",
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

// CDN URL guard (T-02-00-03) — UI source must not reference external URLs.
// Local fonts/assets only; URLs in line comments are allowed (e.g. attribution).
function walkUi(dir: string): string[] {
  const out: string[] = [];
  let s: ReturnType<typeof statSync>;
  try {
    s = statSync(dir);
  } catch {
    return out;
  }
  if (!s.isDirectory()) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walkUi(full));
    else if (entry.isFile()) {
      const n = entry.name;
      if (
        n.endsWith(".ts") ||
        n.endsWith(".tsx") ||
        n.endsWith(".js") ||
        n.endsWith(".jsx") ||
        n.endsWith(".css") ||
        n.endsWith(".html")
      )
        out.push(full);
    }
  }
  return out;
}

const URL_RE = /https?:\/\/[^\s"'<>`)]+/g;

function stripComments(source: string, file: string): string {
  // Strip line comments (// ...) and block comments (/* ... */).
  let s = source;
  // HTML / CSS use <!-- --> and /* */ only — keep block stripping universal.
  if (file.endsWith(".html")) {
    s = s.replace(/<!--[\s\S]*?-->/g, "");
  }
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  // Line comments — TS/JS/CSS-line (CSS does not use //, harmless).
  s = s.replace(/(^|[^:"'\\])\/\/[^\n]*/g, (_m, p1: string) => p1);
  return s;
}

describe("no CDN URLs in UI source", () => {
  const roots = ["packages/ui/src", "packages/ui/index.html"];
  const files: string[] = [];
  for (const r of roots) {
    const abs = resolve(r);
    let st: ReturnType<typeof statSync> | null = null;
    try {
      st = statSync(abs);
    } catch {
      st = null;
    }
    if (!st) continue;
    if (st.isDirectory()) files.push(...walkUi(abs));
    else if (st.isFile()) files.push(abs);
  }

  if (files.length === 0) {
    it("ui source not present yet (vacuously safe)", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const file of files) {
    it(`${file.replace(`${process.cwd()}/`, "")} contains no CDN URLs`, () => {
      const body = readFileSync(file, "utf8");
      const stripped = stripComments(body, file);
      const matches = stripped.match(URL_RE) ?? [];
      // Allow well-known schemas in source (e.g. xmlns) — none expected, but
      // narrow the match to http(s) URLs only.
      expect(matches, `${file}: external URL(s) found: ${matches.join(", ")}`).toEqual([]);
    });
  }
});
