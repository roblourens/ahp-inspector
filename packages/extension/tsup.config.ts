import { defineConfig } from "tsup";

// VS Code extensions are loaded with require(); emit CommonJS as `extension.cjs`
// so the manifest's `main` resolves cleanly without depending on type=module
// resolution inside the extension host.
export default defineConfig({
  entry: { extension: "src/extension.ts" },
  format: ["cjs"],
  outExtension: () => ({ js: ".cjs" }),
  dts: false,
  shims: false,
  platform: "node",
  target: "es2022",
  external: ["vscode"],
  noExternal: [/^@ahp-inspector\//],
});
