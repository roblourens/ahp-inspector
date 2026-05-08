import type { JSX } from "react";
import { StateConfidenceBadge } from "./StateConfidenceBadge.js";
import { comparePinnedStatePoints } from "./state-compare.js";
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
  const comparison = getComparison(points);

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
      {comparison && (
        <section className="state-comparison" aria-label="Pinned comparison">
          <div className="state-comparison-header">
            <h4>Pinned comparison</h4>
            <StateConfidenceBadge
              confidence={comparison.confidence}
              label="Comparison confidence"
            />
          </div>
          <div className="state-comparison-points">
            <ComparisonPoint label="From" point={comparison.from} />
            <ComparisonPoint label="To" point={comparison.to} />
          </div>
          {comparison.confidence !== "complete" && (
            <p className="state-comparison-warning">
              Comparison may be incomplete because at least one pinned state is not complete.
            </p>
          )}
          {comparison.same ? (
            <p className="state-comparison-empty">No top-level changes detected.</p>
          ) : (
            <div className="state-comparison-paths">
              <span className="state-section-label">Changed top-level paths</span>
              <ul>
                {comparison.changedPaths.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
              {comparison.overflowCount > 0 && <p>{`and ${comparison.overflowCount} more`}</p>}
            </div>
          )}
        </section>
      )}
    </section>
  );
}

function getComparison(points: readonly PinnedStatePoint[]) {
  if (points.length !== MAX_PINNED_STATE_POINTS) {
    return null;
  }

  const [from, to] = points;
  if (!from || !to) {
    return null;
  }

  return comparePinnedStatePoints(from, to);
}

function ComparisonPoint({
  label,
  point,
}: {
  readonly label: "From" | "To";
  readonly point: PinnedStatePoint;
}): JSX.Element {
  return (
    <div>
      <span className="state-section-label">{`${label} #${point.targetIndex}`}</span>
      <span>{point.eventLabel}</span>
      <span>
        {point.resourceKind} <span className="state-resource-uri">{point.resourceUri}</span>
      </span>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  if (!Number.isFinite(ts)) return "unknown time";
  return new Date(ts).toLocaleString();
}
