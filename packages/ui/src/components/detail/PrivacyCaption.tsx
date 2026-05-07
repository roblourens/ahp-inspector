/**
 * PrivacyCaption — always-rendered footer line in the detail panel.
 *
 * T-03-04-03: Discloses that copy may include raw payload (tokens, prompts, paths).
 *
 * No raw #hex literals.
 */

import { Info } from "lucide-react";
import type { JSX } from "react";

export function PrivacyCaption(): JSX.Element {
  return (
    <div
      data-testid="privacy-caption"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "var(--space-2) var(--space-3)",
        color: "var(--color-text-muted)",
        fontSize: "12px",
        fontFamily: "var(--font-sans)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <Info size={12} style={{ flexShrink: 0 }} />
      <span>Copy includes raw payload — may contain tokens, prompts, or paths.</span>
    </div>
  );
}
