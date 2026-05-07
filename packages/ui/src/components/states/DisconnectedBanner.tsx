import { WifiOff } from "lucide-react";
import type { JSX } from "react";

export function DisconnectedBanner({ onReconnect }: { onReconnect: () => void }): JSX.Element {
  return (
    <div
      data-testid="banner-disconnected"
      style={{
        height: 40,
        padding: "0 var(--space-3)",
        background: "var(--color-surface)",
        borderLeft: "2px solid var(--color-destructive)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <WifiOff size={16} color="var(--color-destructive)" />
      <span style={{ flex: 1 }}>Disconnected from log stream. Showing last received events.</span>
      <button
        type="button"
        onClick={onReconnect}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-accent)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        Retry connection
      </button>
    </div>
  );
}
