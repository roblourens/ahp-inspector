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
  "@playwright/test",
  // Runtime deps
  "commander",
  "chokidar",
  "hono",
  "@hono/node-server",
  "@ahp-inspector/protocol",
  // Workspace packages
  "@ahp-inspector/shared",
  "@ahp-inspector/parser",
  "@ahp-inspector/core",
  "@ahp-inspector/host-node",
  "@ahp-inspector/server",
  "ahp-inspector",
  "@ahp-inspector/ui",
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
  // Phase-11 VS Code extension (plan 11-01)
  "@types/vscode",
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
// Loopback URLs (localhost / 127.0.0.1 / ::1) are allowed everywhere — they
// are the Phase-15 server-in-extension transport, not external CDNs.
const LOOPBACK_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/;
const SVG_SCHEMA_RE = /^http:\/\/www\.w3\.org\/2000\/svg$/;

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
      const matches = (stripped.match(URL_RE) ?? []).filter(
        (u) => !LOOPBACK_RE.test(u) && !SVG_SCHEMA_RE.test(u),
      );
      expect(matches, `${file}: external URL(s) found: ${matches.join(", ")}`).toEqual([]);
    });
  }
});

// VS Code extension local-only guards (Phase 15 server-in-extension).
//
// 1. Extension runtime must not call the `open` package (browser-launching)
//    — the loopback server is reached via WebviewOptions.portMapping, not
//    via an external browser. (Phase 11's prohibition on `startLogServer`
//    was explicitly REVERSED in Phase 15: the extension now hosts the
//    same Hono server the standalone CLI uses.)
// 2. The webview HTML produced by `renderWebviewHtml` must contain a strict
//    CSP and no non-loopback CDN URLs.
describe("vs code extension local-only guards", () => {
  const extRoot = resolve("packages/extension/src");
  let extStat: ReturnType<typeof statSync> | null = null;
  try {
    extStat = statSync(extRoot);
  } catch {
    extStat = null;
  }
  if (!extStat?.isDirectory()) {
    it("extension package not present yet (vacuously safe)", () => {
      expect(true).toBe(true);
    });
    return;
  }
  const allFiles = walkUi(extRoot);
  const runtimeFiles = allFiles.filter((f) => {
    const n = f.split("/").pop() ?? "";
    if (n.endsWith(".test.ts") || n.endsWith(".test.tsx")) return false;
    if (f.includes("/__test__/")) return false;
    return n.endsWith(".ts") || n.endsWith(".tsx");
  });

  it("extension runtime does not import the open package (browser launcher)", () => {
    const offenders: string[] = [];
    for (const file of runtimeFiles) {
      const body = readFileSync(file, "utf8");
      const stripped = stripComments(body, file);
      if (/from\s+["']open["']/.test(stripped)) offenders.push(`${file}: open package`);
    }
    expect(offenders, `local-only violations: ${offenders.join(", ")}`).toEqual([]);
  });

  it("renderWebviewHtml output has restrictive CSP and no CDN URLs", async () => {
    const mod = (await import(
      "../packages/extension/src/webviewHtml.ts"
    )) as typeof import("../packages/extension/src/webviewHtml.js");
    const html = mod.renderWebviewHtml({
      scriptUri: "webview-uri:/main.js",
      stylesheetUri: "webview-uri:/main.css",
      nonce: "test-nonce",
      cspSource: "vscode-webview://test",
    });
    expect(html).toMatch(/Content-Security-Policy/);
    expect(html).toMatch(/default-src\s+'none'/);
    expect(html).toMatch(/script-src\s+'nonce-test-nonce'/);
    const stripped = stripComments(html, "webview.html");
    const urls = (stripped.match(URL_RE) ?? []).filter(
      (u) => !/^https?:\/\/(?:localhost|127\.0\.0\.1)/.test(u),
    );
    expect(urls, `external URLs in webview HTML: ${urls.join(", ")}`).toEqual([]);
  });
});
