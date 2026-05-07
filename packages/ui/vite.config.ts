import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwind()],
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  build: { outDir: "dist", target: "es2022", sourcemap: true },
});
