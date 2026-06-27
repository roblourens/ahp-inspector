/**
 * PrettyJsonView — renders a collapsible JSON tree via react-json-view-lite.
 *
 * T-03-04-02: If JSON.stringify(data).length > 256KB, show TruncationBanner
 * instead of the tree. Raw view is still available.
 *
 * D-08/D-09 (Plan 34-04): when a search `query` is active we (a) auto-expand
 * the path to subtrees that literally contain the query via a match-aware
 * `shouldExpandNode`, and (b) visibly highlight literal occurrences using the
 * CSS Custom Highlight API — Range objects over the already-rendered text
 * nodes plus `::highlight(ahp-search-match)`. This injects NO markup (react-
 * json-view-lite exposes no per-node render hook), honoring "no markup
 * injection" and "literal, non-regex matching" (T-34-01/02). It is
 * feature-detected so it no-ops where unsupported (Firefox <117, Safari
 * <17.2) — auto-expand still works; only the color is skipped.
 *
 * No raw #hex literals — token colors come from CSS variables.
 * react-json-view-lite uses text-only rendering, no eval (verified 03-RESEARCH).
 */
import { type JSX, useEffect, useRef } from "react";
import { defaultStyles, JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { TruncationBanner } from "./TruncationBanner.js";

export const CLIENT_CAP_BYTES = 256 * 1024; // 256KB
const HIGHLIGHT_NAME = "ahp-search-match";

const JSON_STYLES: typeof defaultStyles = {
  ...defaultStyles,
  container: "ahp-json-container",
  basicChildStyle: "ahp-json-child",
  label: "ahp-json-label",
  clickableLabel: "ahp-json-label ahp-json-clickable-label",
  nullValue: "ahp-json-null",
  undefinedValue: "ahp-json-null",
  numberValue: "ahp-json-number",
  stringValue: "ahp-json-string",
  booleanValue: "ahp-json-boolean",
  otherValue: "ahp-json-other",
  punctuation: "ahp-json-punctuation",
  expandIcon: "ahp-json-expander",
  collapseIcon: "ahp-json-expander",
  collapsedContent: "ahp-json-collapsed",
  childFieldsContainer: "ahp-json-children",
};

interface PrettyJsonViewProps {
  data: unknown;
  query?: string;
  capBytes?: number;
  onOpenRaw?(): void;
}

/**
 * Literal, case-insensitive test for whether the serialized `value` subtree
 * contains `q`. Never compiles a regular expression from the (untrusted) query and bounds
 * the scan to avoid pathological stringify (T-34-02).
 */
function subtreeContainsQuery(value: unknown, q: string): boolean {
  if (q.length < 2) return false;
  let s: string;
  try {
    s = JSON.stringify(value);
  } catch {
    return false;
  }
  if (s === undefined) return false;
  if (s.length > 512 * 1024) return false; // bound the scan
  return s.toLowerCase().includes(q.toLowerCase()); // literal substring match, no regular expression
}

export function PrettyJsonView({
  data,
  query = "",
  capBytes = CLIENT_CAP_BYTES,
  onOpenRaw,
}: PrettyJsonViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // Register a CSS Custom Highlight over literal query ranges in the rendered
  // text nodes, feature-detected. Literal substring matching only (no regular
  // expression). The effect re-runs when `data` changes because the tree is
  // re-rendered from it and the ranges must be recomputed over the new DOM.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `data` is an intentional re-highlight trigger (tree re-renders from it).
  useEffect(() => {
    const root = containerRef.current;
    const q = query.trim();
    // biome-ignore lint/suspicious/noExplicitAny: CSS Custom Highlight API is not in lib.dom yet.
    const cssAny = globalThis as any;
    const highlights = cssAny.CSS?.highlights;
    if (!root || q.length < 2) {
      highlights?.delete(HIGHLIGHT_NAME);
      return;
    }
    if (typeof cssAny.Highlight === "undefined" || !highlights) return;

    const ranges: Range[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const lowerQ = q.toLowerCase();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.nodeValue ?? "";
      const lower = text.toLowerCase();
      let i = lower.indexOf(lowerQ);
      while (i !== -1) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + q.length);
        ranges.push(r);
        i = lower.indexOf(lowerQ, i + q.length);
      }
    }
    highlights.set(HIGHLIGHT_NAME, new cssAny.Highlight(...ranges));
    return () => {
      cssAny.CSS?.highlights?.delete(HIGHLIGHT_NAME);
    };
  }, [data, query]);

  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch {
    serialized = "[Circular or non-serializable value]";
  }

  if (serialized.length > capBytes) {
    return (
      <TruncationBanner
        kind="client-cap"
        bytes={serialized.length}
        {...(onOpenRaw !== undefined ? { onOpenRaw } : {})}
      />
    );
  }

  const hasQuery = query.trim().length >= 2;

  return (
    <div
      ref={containerRef}
      data-testid="pretty-json-view"
      className="ahp-json-view"
      style={{
        padding: "var(--space-2) var(--space-3)",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-ui-muted-size)",
        color: "var(--color-text)",
        background: "var(--color-json-bg)",
        flex: 1,
      }}
    >
      <JsonView
        data={data as object}
        shouldExpandNode={(level: number, value: unknown) =>
          hasQuery ? level < 1 || subtreeContainsQuery(value, query) : level < 5
        }
        clickToExpandNode
        style={JSON_STYLES}
      />
    </div>
  );
}
