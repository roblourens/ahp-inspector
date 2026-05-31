import type { JSX, RefObject } from "react";
import { SearchInputCore } from "./SearchInputCore.js";

interface SearchInputProps {
  value: string;
  onChange(q: string): void;
  onClear(): void;
  ref?: RefObject<HTMLInputElement | null>;
}

/**
 * SearchInput — wraps SearchInputCore with flex wrapper and "/" shortcut hint.
 * Maintained for backward compatibility; SearchInputCore is the reusable core.
 */
export function SearchInput({ value, onChange, onClear, ref }: SearchInputProps): JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        flex: "1 1 520px",
        minWidth: 360,
        maxWidth: 720,
      }}
    >
      <SearchInputCore value={value} onChange={onChange} onClear={onClear} ref={ref} />
      {value.length === 0 && (
        <span
          aria-hidden="true"
          title="Press / to focus search"
          style={{
            position: "absolute",
            right: "var(--space-2)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            padding: "0 var(--space-1)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-ui-muted-size)",
            lineHeight: "16px",
            pointerEvents: "none",
          }}
        >
          /
        </span>
      )}
    </div>
  );
}
