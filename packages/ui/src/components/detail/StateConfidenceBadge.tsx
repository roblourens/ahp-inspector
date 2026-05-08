import type { JSX } from "react";
import type { ReplayConfidence } from "../../transport/state-client.js";

interface StateConfidenceBadgeProps {
  readonly confidence: ReplayConfidence;
  readonly label: string;
}

const CONFIDENCE_TEXT: Record<ReplayConfidence, string | null> = {
  complete: null,
  partial: "Reconstruction may be incomplete.",
  unknown: "State cannot be treated as authoritative.",
};

export function StateConfidenceBadge({
  confidence,
  label,
}: StateConfidenceBadgeProps): JSX.Element {
  const caution = CONFIDENCE_TEXT[confidence];

  return (
    <div className="state-confidence" data-confidence={confidence}>
      <span className="state-confidence-label">{label}</span>
      <span className="state-confidence-pill">{toTitle(confidence)}</span>
      {caution && <span className="state-confidence-caution">{caution}</span>}
    </div>
  );
}

function toTitle(value: ReplayConfidence): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
