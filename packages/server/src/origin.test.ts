import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./origin.js";

describe("isAllowedOrigin", () => {
  it("allows a missing origin (same-origin / non-browser)", () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin(null)).toBe(true);
  });

  it("rejects empty and opaque null origins", () => {
    expect(isAllowedOrigin("")).toBe(false);
    expect(isAllowedOrigin("null")).toBe(false);
  });

  it("allows vscode-webview origins only after capability authentication", () => {
    expect(isAllowedOrigin("vscode-webview://1a2b3c-guid")).toBe(false);
    expect(isAllowedOrigin("vscode-webview://1a2b3c-guid", true)).toBe(true);
    expect(isAllowedOrigin("vscode-webview://", true)).toBe(false);
    expect(isAllowedOrigin("vscode-webview://trusted/path", true)).toBe(false);
  });

  it("allows loopback http/https on any port", () => {
    expect(isAllowedOrigin("http://127.0.0.1:5199")).toBe(true);
    expect(isAllowedOrigin("http://localhost")).toBe(true);
    expect(isAllowedOrigin("https://localhost:8080")).toBe(true);
    expect(isAllowedOrigin("http://[::1]:5199")).toBe(true);
  });

  it("rejects remote origins", () => {
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin("http://attacker.test:5199")).toBe(false);
    expect(isAllowedOrigin("https://127.0.0.1.evil.example")).toBe(false);
  });

  it("rejects non-http(s) schemes that aren't explicitly allowed", () => {
    expect(isAllowedOrigin("file://")).toBe(false);
    expect(isAllowedOrigin("ftp://127.0.0.1")).toBe(false);
  });

  it("rejects unparseable origins", () => {
    expect(isAllowedOrigin("http://")).toBe(false);
    expect(isAllowedOrigin("not a url")).toBe(false);
  });
});
