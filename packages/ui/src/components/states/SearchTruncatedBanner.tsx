import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

interface SearchTruncatedBannerProps {
  shown: number;
  total: number;
}

export function SearchTruncatedBanner({ shown, total }: SearchTruncatedBannerProps): JSX.Element {
  return (
    <div
      data-testid="search-truncated-banner"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-1) var(--space-3)",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        color: "var(--color-warning)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-ui-muted-size)",
      }}
    >
      <AlertTriangle size={14} />
      {`Showing first ${shown.toLocaleString()} of ${total.toLocaleString()}+ matches. Refine your query for fewer results.`}
    </div>
  );
}
