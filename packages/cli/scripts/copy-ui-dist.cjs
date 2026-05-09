// Copy `packages/ui/dist` into `packages/cli/ui-dist` so the published
// tarball is self-contained. The CLI's locateUiDist() finds this folder at
// runtime via `cliPackageDir/ui-dist/index.html`.
//
// Unlike the extension's copy-ui-dist.cjs we do NOT rename the hashed
// `index-*.{js,css}` files — the CLI serves the static UI via Express and
// the UI's HTML references its own hashed asset names directly.
const fs = require("node:fs");
const path = require("node:path");

const srcDir = path.resolve(__dirname, "..", "..", "ui", "dist");
const dstDir = path.resolve(__dirname, "..", "ui-dist");

if (!fs.existsSync(srcDir)) {
  console.error(
    `[cli] packages/ui/dist not found — run \`pnpm -F @ahp-inspector/ui build\` first.`,
  );
  process.exit(1);
}

fs.rmSync(dstDir, { recursive: true, force: true });
fs.cpSync(srcDir, dstDir, { recursive: true, force: true });
console.log(`Copied UI dist → ${dstDir}`);
