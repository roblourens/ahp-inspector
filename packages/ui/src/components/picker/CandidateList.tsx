import type { JSX } from "react";
import type { SafeCandidate } from "../../types/safe-candidate.js";
import { CandidateRow } from "./CandidateRow.js";
import { NoCandidatesHint } from "./NoCandidatesHint.js";

export function CandidateList({
  candidates,
  onSelect,
}: {
  candidates: readonly SafeCandidate[];
  onSelect(id: string): void;
}): JSX.Element {
  if (candidates.length === 0) return <NoCandidatesHint />;
  return (
    <ul role="list" aria-label="Discovered logs" style={{ margin: 0, padding: 0 }}>
      {candidates.map((c) => (
        <CandidateRow key={c.id} candidate={c} onSelect={() => onSelect(c.id)} />
      ))}
    </ul>
  );
}
