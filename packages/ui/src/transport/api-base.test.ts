import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiUrl } from "./api-base.js";

describe("apiUrl", () => {
  beforeEach(() => {
    delete (window as Window & { __AHP_API_BASE__?: string }).__AHP_API_BASE__;
    delete (window as Window & { __AHP_API_TOKEN__?: string }).__AHP_API_TOKEN__;
    document.querySelector('meta[name="ahp-api-token"]')?.remove();
  });
  afterEach(() => {
    delete (window as Window & { __AHP_API_BASE__?: string }).__AHP_API_BASE__;
    delete (window as Window & { __AHP_API_TOKEN__?: string }).__AHP_API_TOKEN__;
    document.querySelector('meta[name="ahp-api-token"]')?.remove();
  });

  it("returns path unchanged when window.__AHP_API_BASE__ is unset", () => {
    expect(apiUrl("/api/x")).toBe("/api/x");
  });

  it("prefixes path when window.__AHP_API_BASE__ is set", () => {
    (window as Window).__AHP_API_BASE__ = "http://localhost:51234";
    expect(apiUrl("/api/x")).toBe("http://localhost:51234/api/x");
  });

  it("strips a trailing slash on the base so paths are not double-slashed", () => {
    (window as Window).__AHP_API_BASE__ = "http://localhost:51234/";
    expect(apiUrl("/api/x")).toBe("http://localhost:51234/api/x");
  });

  it("prefixes the SSE stream path correctly", () => {
    (window as Window).__AHP_API_BASE__ = "http://localhost:51234";
    expect(apiUrl("/api/log/stream")).toBe("http://localhost:51234/api/log/stream");
  });

  it("adds the injected webview capability to API and SSE URLs", () => {
    (window as Window).__AHP_API_BASE__ = "http://localhost:51234";
    (window as Window).__AHP_API_TOKEN__ = "webview capability";
    expect(apiUrl("/api/x")).toBe("http://localhost:51234/api/x?_ahpToken=webview%20capability");
    expect(apiUrl("/api/log/stream")).toBe(
      "http://localhost:51234/api/log/stream?_ahpToken=webview%20capability",
    );
  });

  it("reads the standalone capability from server-injected metadata", () => {
    const meta = document.createElement("meta");
    meta.name = "ahp-api-token";
    meta.content = "standalone-capability";
    document.head.append(meta);
    expect(apiUrl("/api/log/search?q=test")).toBe(
      "/api/log/search?q=test&_ahpToken=standalone-capability",
    );
  });
});
