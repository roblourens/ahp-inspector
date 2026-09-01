import { type JSX, useId, useState } from "react";
import type { SafeCandidate } from "../../types/safe-candidate.js";
import { CandidateRow } from "./CandidateRow.js";
import { getOpenErrorMessage } from "./error-copy.js";
import { NoCandidatesHint } from "./NoCandidatesHint.js";

export function CandidateList({
  candidates,
  onSelect,
}: {
  candidates: readonly SafeCandidate[];
  onSelect(id: string): Promise<void>;
}): JSX.Element {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  if (candidates.length === 0) return <NoCandidatesHint />;

  async function select(id: string): Promise<void> {
    if (openingId !== null) return;
    setOpeningId(id);
    setError(null);
    try {
      await onSelect(id);
    } catch (openError) {
      setError(getOpenErrorMessage(openError));
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <>
      {error && (
        <div
          id={errorId}
          role="alert"
          style={{
            color: "var(--color-destructive)",
            fontSize: "var(--text-body-size)",
            marginBottom: "var(--space-2)",
          }}
        >
          {error}
        </div>
      )}
      <ul
        aria-label="Discovered logs"
        aria-describedby={error ? errorId : undefined}
        style={{ margin: 0, padding: 0 }}
      >
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            disabled={openingId !== null}
            onSelect={() => void select(candidate.id)}
          />
        ))}
      </ul>
    </>
  );
}
