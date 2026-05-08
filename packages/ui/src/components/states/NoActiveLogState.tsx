import { type JSX, useEffect, useRef } from "react";
import type { SafeCandidate } from "../../types/safe-candidate.js";
import { CandidateList } from "../picker/CandidateList.js";
import { ManualOpenInput } from "../picker/ManualOpenInput.js";

export function NoActiveLogState({
  candidates,
  isLoading,
  onSelect,
  onOpenPath,
  onRefresh,
}: {
  candidates: readonly SafeCandidate[];
  isLoading: boolean;
  onSelect(id: string): void;
  onOpenPath(path: string): Promise<void>;
  onRefresh(): void;
}): JSX.Element {
  const focusTargetRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // On mount: focus first candidate row's button if any, else the manual-open input.
    const first = document.querySelector<HTMLElement>('ul[aria-label="Discovered logs"] button');
    if (first) {
      first.focus();
      return;
    }
    const input = document.querySelector<HTMLInputElement>(
      'form[aria-label="Open log by path"] input',
    );
    input?.focus();
  }, []);

  const heading = "No log open";
  const body =
    candidates.length === 0 && !isLoading
      ? "No VS Code logs found automatically. Enter a file path below to open a log."
      : "Select a discovered log below or open a file by path.";

  return (
    <main
      ref={(el) => {
        focusTargetRef.current = el;
      }}
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 640,
          padding: "var(--space-6) var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <header>
          <h1
            style={{
              fontSize: "var(--text-heading-size)",
              fontWeight: 600,
              color: "var(--color-text)",
              margin: 0,
            }}
          >
            {heading}
          </h1>
          <p
            style={{
              color: "var(--color-text-muted)",
              margin: "var(--space-2) 0 0",
              fontSize: "var(--text-body-size)",
            }}
          >
            {body}
          </p>
        </header>

        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "var(--space-3)",
            }}
          >
            <h2
              style={{
                fontSize: "var(--text-heading-size)",
                fontWeight: 600,
                color: "var(--color-text)",
                margin: 0,
              }}
            >
              Discovered logs
            </h2>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              aria-label="Refresh List"
              style={{
                height: 28,
                padding: "0 var(--space-3)",
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: 4,
                color: "var(--color-text)",
                cursor: "pointer",
                fontSize: "var(--text-ui-muted-size)",
              }}
            >
              {isLoading ? "Refreshing…" : "Refresh List"}
            </button>
          </div>
          <CandidateList candidates={candidates} onSelect={onSelect} />
        </section>

        <div
          aria-hidden="true"
          style={{
            borderTop: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
            fontSize: "var(--text-ui-muted-size)",
            paddingTop: "var(--space-3)",
            textAlign: "center",
          }}
        >
          or open manually
        </div>

        <ManualOpenInput onOpen={onOpenPath} />
      </section>
    </main>
  );
}
