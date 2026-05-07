/**
 * AuthFailureBanner — alert banner shown when an event has isAuthFailure=true.
 *
 * No raw #hex literals; uses --color-auth-fail-banner-bg token.
 */

import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";

interface AuthFailureBannerProps {
  code?: number;
  notificationType?: string;
}

export function AuthFailureBanner({ code, notificationType }: AuthFailureBannerProps): JSX.Element {
  const heading = `Authentication failure (${code ?? notificationType ?? "unknown"})`;

  const body =
    code === -32007
      ? "Subsequent requests in this session may fail until re-auth."
      : notificationType === "authRequired"
        ? "Server is requesting authentication."
        : "Authentication failure detected.";

  return (
    <div
      data-testid="auth-failure-banner"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-3)",
        background: "var(--color-auth-fail-banner-bg)",
        color: "var(--color-destructive)",
        fontSize: "var(--text-ui-muted-size)",
        fontFamily: "var(--font-sans)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
      <div>
        <div style={{ fontWeight: "var(--weight-semibold)" }}>{heading}</div>
        <div style={{ color: "var(--color-text-muted)", marginTop: "2px" }}>{body}</div>
      </div>
    </div>
  );
}
