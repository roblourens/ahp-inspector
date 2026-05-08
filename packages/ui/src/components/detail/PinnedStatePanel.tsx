import type { JSX } from "react";
import { StateConfidenceBadge } from "./StateConfidenceBadge.js";
import { MAX_PINNED_STATE_POINTS, type PinnedStatePoint } from "./state-pins.js";

interface PinnedStatePanelProps {
  readonly points: readonly PinnedStatePoint[];
  readonly onRemove: (id: string) => void;
  readonly onClear: () => void;
}

export function PinnedStatePanel({
  points,
  onRemove,
  onClear,
}: PinnedStatePanelProps): JSX.Element {
  return (
    <section className="pinned-state-panel" aria-label="Pinned state points">
      <div className="pinned-state-header">
        <div>
          <h4>Pinned state points</h4>
          <p>{`Pinned ${points.length}/${MAX_PINNED_STATE_POINTS}`}</p>
        </div>
        {points.length > 0 && (
          <button type="button" className="state-secondary-button" onClick={onClear}>
            Clear pinned states
          </button>
        )}
      </div>

      {points.length === 0 ? (
        <p className="pinned-state-empty">
          Pin two state points to compare before/after reducer state.
        </p>
      ) : (
        <ul className="pinned-state-list">
          {points.map((point) => (
            <li key={point.id} className="pinned-state-card">
              <div className="pinned-state-meta">
                <span className="mono">#{point.targetIndex}</span>
                <span>{point.eventLabel}</span>
                <span>{formatTimestamp(point.eventTimestamp)}</span>
              </div>
              <div className="state-resource-main">
                <span className="state-resource-kind">{point.resourceKind}</span>
                <span className="state-resource-uri">{point.resourceUri}</span>
              </div>
              <StateConfidenceBadge confidence={point.confidence} label="Confidence" />
              <div className="pinned-state-meta">
                <span>{point.diagnosticCount} diagnostics</span>
                <span>baseline #{point.baselineEventIdx}</span>
                <span>applied #{point.lastAppliedEventIdx}</span>
                <span>baseline seq {point.baselineFromSeq ?? "—"}</span>
                <span>server seq {point.lastServerSeq ?? "—"}</span>
              </div>
              <div className="pinned-state-actions">
                <button
                  type="button"
                  className="state-secondary-button"
                  onClick={() => onRemove(point.id)}
                >
                  Remove pinned state
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatTimestamp(ts: number): string {
  if (!Number.isFinite(ts)) return "unknown time";
  return new Date(ts).toLocaleString();
}
