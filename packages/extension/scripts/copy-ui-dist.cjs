// Copy `packages/ui/dist` into `packages/extension/ui-dist` and normalize the
// JS/CSS asset filenames to `assets/main.js` / `assets/main.css`. The Vite
// build emits hashed names like `index-<hash>.js`, but the webview HTML in
// `extension.ts` loads stable paths so cache busting isn't needed inside a
// webview process.
const fs = require("node:fs");
const path = require("node:path");

const srcDir = path.resolve(__dirname, "../../ui/dist");
const dstDir = path.resolve(__dirname, "../ui-dist");

if (!fs.existsSync(srcDir)) {
  console.error(`[extension] missing UI build at ${srcDir}; run 'pnpm -F @ahp-viewer/ui build' first.`);
  process.exit(1);
}

fs.rmSync(dstDir, { recursive: true, force: true });
fs.cpSync(srcDir, dstDir, { recursive: true });

const assetsDir = path.join(dstDir, "assets");
if (!fs.existsSync(assetsDir)) {
  console.error(`[extension] no assets/ directory in copied UI build`);
  process.exit(1);
}

let jsName = null;
let cssName = null;
for (const name of fs.readdirSync(assetsDir)) {
  if (!jsName && /^index-.*\.js$/.test(name)) jsName = name;
  else if (!cssName && /^index-.*\.css$/.test(name)) cssName = name;
}
if (!jsName || !cssName) {
  console.error(`[extension] could not find index-*.{js,css} in ${assetsDir}`);
  process.exit(1);
}

fs.renameSync(path.join(assetsDir, jsName), path.join(assetsDir, "main.js"));
fs.renameSync(path.join(assetsDir, cssName), path.join(assetsDir, "main.css"));

const sourceMap = `${jsName}.map`;
const sourceMapPath = path.join(assetsDir, sourceMap);
if (fs.existsSync(sourceMapPath)) {
  fs.renameSync(sourceMapPath, path.join(assetsDir, "main.js.map"));
}
