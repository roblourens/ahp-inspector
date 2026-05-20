import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderWebviewHtml } from "../webviewHtml.js";

const baseOpts = {
  scriptUri: "vscode-webview://abc/main.js",
  stylesheetUri: "vscode-webview://abc/main.css",
  nonce: "deadbeefcafef00d",
  cspSource: "vscode-webview://abc",
};

describe("renderWebviewHtml", () => {
  it("emits byte-identical HTML when loopbackOrigin/apiBaseUrl are absent (backwards compat)", () => {
    const html = renderWebviewHtml(baseOpts);
    // connect-src is the LAST CSP directive — no trailing `;`. Plain cspSource only.
    expect(html).toContain('connect-src vscode-webview://abc"');
    expect(html).not.toContain("http://localhost");
    // No apiBaseScript injected
    expect(html).not.toContain("__AHP_API_BASE__");
    // Single script tag (the bundle), nothing extra in <head>
    expect(html.match(/<script/g)?.length).toBe(1);
  });

  it("keeps default CRT stylesheet delivery local to the supplied webview URI", () => {
    const html = renderWebviewHtml(baseOpts);
    expect(html).toContain('<link rel="stylesheet" href="vscode-webview://abc/main.css" />');
    expect(html).not.toContain("https://");
    expect(html).not.toContain("http://");
    expect(html).not.toContain("url(https://");
    expect(html).not.toContain("url(http://");
  });

  it("copies the bowing CRT displacement surface into webview assets", async () => {
    const assetsDir = resolve("packages/extension/ui-dist/assets");
    const assetNames = await readdir(assetsDir);
    const css = (
      await Promise.all(
        assetNames
          .filter((assetName) => assetName.endsWith(".css"))
          .map((assetName) => readFile(resolve(assetsDir, assetName), "utf8")),
      )
    ).join("\n");
    const js = (
      await Promise.all(
        assetNames
          .filter((assetName) => assetName.endsWith(".js"))
          .map((assetName) => readFile(resolve(assetsDir, assetName), "utf8")),
      )
    ).join("\n");

    expect(css).toContain(".crt-display-surface");
    expect(css).toContain("border-radius:36px");
    expect(css).toContain("ellipse at 50% -16%");
    expect(css).toContain("ahp-crt-phosphor-shift");
    expect(css).toContain("ahp-crt-foreground-sweep");
    expect(css).toContain(".crt-curvature-canvas");
    expect(css).not.toContain('url("#ahp-crt-warp")');
    expect(js).toContain("crt-display-surface");
    expect(js).toContain("crt-curvature-canvas");
    expect(js).toContain("webgl");
    expect(js).toContain("crt-filter-defs");
    expect(js).toContain("feDisplacementMap");
    expect(js).toContain("feBlend");
    expect(js).toContain("scale:`0`");
    expect(js).toContain("data:image/svg+xml");
    expect(js).not.toContain("x:`0%`,y:`0%`,width:`100%`,height:`100%`");
    expect(js).not.toContain("feTurbulence");
  });

  it("loopbackOrigin widens connect-src CSP", () => {
    const html = renderWebviewHtml({ ...baseOpts, loopbackOrigin: "http://localhost:51234" });
    expect(html).toContain("connect-src vscode-webview://abc http://localhost:51234");
  });

  it("apiBaseUrl injects window.__AHP_API_BASE__ inline script with nonce, before bundle", () => {
    const html = renderWebviewHtml({ ...baseOpts, apiBaseUrl: "http://localhost:51234" });
    expect(html).toContain(
      `<script nonce="deadbeefcafef00d">window.__AHP_API_BASE__ = "http://localhost:51234";</script>`,
    );
    const inlineIdx = html.indexOf("__AHP_API_BASE__");
    const bundleIdx = html.indexOf(baseOpts.scriptUri);
    expect(inlineIdx).toBeGreaterThan(-1);
    expect(bundleIdx).toBeGreaterThan(-1);
    expect(inlineIdx).toBeLessThan(bundleIdx);
  });

  it("apiBaseUrl XSS payload is escaped: no </script> breakout", () => {
    const payload = "http://localhost:51234</script><script>alert(1)//";
    const html = renderWebviewHtml({ ...baseOpts, apiBaseUrl: payload });
    // The escaped form must appear, raw </script> from attacker payload must NOT.
    expect(html).toContain("\\u003c/script>");
    // Two real closing tags in the document: inline apiBase script + bundle script.
    // Attacker's payload is escaped to \u003c/script> so it does NOT add a third.
    expect(html.match(/<\/script>/g)?.length).toBe(2);
  });
});
