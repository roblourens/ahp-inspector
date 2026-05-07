import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  shims: true,
  platform: "node",
  target: "es2022",
  noExternal: [/^@ahp-viewer\//],
});
