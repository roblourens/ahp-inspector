import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateNonce, renderWebviewHtml } from "../webviewHtml.js";

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

  it("keeps the bowing CRT surface wired into the extension webview build", async () => {
    const [css, appShell, curvatureCanvas, filterDefs, copyScript] = await Promise.all([
      readFile(resolve("packages/ui/src/styles/global.css"), "utf8"),
      readFile(resolve("packages/ui/src/components/shell/AppShell.tsx"), "utf8"),
      readFile(resolve("packages/ui/src/components/shell/CrtCurvatureCanvas.tsx"), "utf8"),
      readFile(resolve("packages/ui/src/components/shell/CrtFilterDefs.tsx"), "utf8"),
      readFile(resolve("packages/extension/scripts/copy-ui-dist.cjs"), "utf8"),
    ]);

    expect(css).toContain(".crt-display-surface");
    expect(css).toContain("border-radius: 36px");
    expect(css).toContain("ellipse at 50% -16%");
    expect(css).toContain("ahp-crt-phosphor-shift");
    expect(css).toContain("ahp-crt-foreground-sweep");
    expect(css).toContain(".crt-curvature-canvas");
    expect(css).not.toContain('url("#ahp-crt-warp")');
    expect(appShell).toContain('className="crt-display-surface"');
    expect(appShell).toContain("<CrtFilterDefs />");
    expect(appShell).toContain("<CrtCurvatureCanvas />");
    expect(curvatureCanvas).toContain('getContext("webgl"');
    expect(curvatureCanvas).toContain('className="crt-curvature-canvas"');
    expect(filterDefs).toContain('className="crt-filter-defs"');
    expect(filterDefs).toContain("feDisplacementMap");
    expect(filterDefs).toContain("feBlend");
    expect(filterDefs).toContain('scale="0"');
    expect(filterDefs).toContain("data:image/svg+xml");
    expect(filterDefs).not.toContain("feTurbulence");
    expect(copyScript).toContain('"../../ui/dist"');
    expect(copyScript).toContain('"../ui-dist"');
    expect(copyScript).toContain("fs.cpSync(srcDir, dstDir, { recursive: true })");
  });

  it("loopbackOrigin widens connect-src CSP", () => {
    const html = renderWebviewHtml({ ...baseOpts, loopbackOrigin: "http://localhost:51234" });
    expect(html).toContain("connect-src vscode-webview://abc http://localhost:51234");
  });

  it("apiBaseUrl injects window.__AHP_API_BASE__ inline script with nonce, before bundle", () => {
    const html = renderWebviewHtml({
      ...baseOpts,
      apiBaseUrl: "http://localhost:51234",
      apiToken: "test-capability",
    });
    expect(html).toContain(
      `<script nonce="deadbeefcafef00d">window.__AHP_API_BASE__ = "http://localhost:51234"; window.__AHP_API_TOKEN__ = "test-capability";</script>`,
    );
    const inlineIdx = html.indexOf("__AHP_API_BASE__");
    const bundleIdx = html.indexOf(baseOpts.scriptUri);
    expect(inlineIdx).toBeGreaterThan(-1);
    expect(bundleIdx).toBeGreaterThan(-1);
    expect(inlineIdx).toBeLessThan(bundleIdx);
  });

  it("apiBaseUrl XSS payload is escaped: no </script> breakout", () => {
    const payload = "http://localhost:51234</script><script>alert(1)//";
    const html = renderWebviewHtml({
      ...baseOpts,
      apiBaseUrl: payload,
      apiToken: "test-capability",
    });
    // The escaped form must appear, raw </script> from attacker payload must NOT.
    expect(html).toContain("\\u003c/script>");
    // Two real closing tags in the document: inline apiBase script + bundle script.
    // Attacker's payload is escaped to \u003c/script> so it does NOT add a third.
    expect(html.match(/<\/script>/g)?.length).toBe(2);
  });

  it("generates a cryptographically-sized base64url nonce", () => {
    const first = generateNonce();
    const second = generateNonce();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("rejects incomplete API capability configuration", () => {
    expect(() => renderWebviewHtml({ ...baseOpts, apiBaseUrl: "http://localhost:51234" })).toThrow(
      "apiBaseUrl and apiToken must be provided together",
    );
    expect(() => renderWebviewHtml({ ...baseOpts, apiToken: "orphaned" })).toThrow(
      "apiBaseUrl and apiToken must be provided together",
    );
  });
});
