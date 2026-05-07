// Boundary test: portable packages (shared, parser, core) MUST NOT import
// Node, DOM, host-only, or UI runtime modules. Authoritative guard for T-01-03.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PORTABLE_ROOTS = [
  "packages/shared/src",
  "packages/parser/src",
  "packages/core/src",
  // Future-proof: if packages/ui/** ever appears it must not import Node/host either.
  "packages/ui/src",
];

const FORBIDDEN_PATTERNS: RegExp[] = [
  /^node:/,
  /^fs$/,
  /^fs\//,
  /^path$/,
  /^chokidar$/,
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^vite$/,
  /^hono($|\/)/,
  /^@ahp-viewer\/host-node($|\/)/,
];

// Capture the import specifier in either `import ... from "x"` or bare `from "x"`.
const IMPORT_RE = /(?:^|\b)(?:import\s[^"';]*?from\s*|export\s[^"';]*?from\s*)["']([^"']+)["']/g;

function walk(dir: string): string[] {
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(dir);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function isForbidden(spec: string): RegExp | null {
  for (const re of FORBIDDEN_PATTERNS) if (re.test(spec)) return re;
  return null;
}

describe("import boundary (portable packages)", () => {
  for (const root of PORTABLE_ROOTS) {
    const absRoot = resolve(root);
    const files = walk(absRoot);
    if (files.length === 0) {
      it(`${root}: no files yet (vacuously safe)`, () => {
        expect(true).toBe(true);
      });
      continue;
    }
    for (const file of files) {
      it(`${file.replace(`${process.cwd()}/`, "")} has no forbidden imports`, () => {
        const body = readFileSync(file, "utf8");
        const offenders: string[] = [];
        // biome-ignore lint/suspicious/noAssignInExpressions: regex iteration
        for (let m: RegExpExecArray | null; (m = IMPORT_RE.exec(body)); ) {
          const spec = m[1]!;
          const hit = isForbidden(spec);
          if (hit) offenders.push(`"${spec}" (matched ${hit})`);
        }
        // Reset state on the shared regex.
        IMPORT_RE.lastIndex = 0;
        expect(offenders, `${file}: forbidden imports: ${offenders.join(", ")}`).toEqual([]);
      });
    }
  }
});
