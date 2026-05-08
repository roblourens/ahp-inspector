import type { JSX } from "react";
import type { StateAtSelectedResource } from "../../transport/state-client.js";

interface StateSummaryViewProps {
  readonly resource: StateAtSelectedResource;
}

export function StateSummaryView({ resource }: StateSummaryViewProps): JSX.Element {
  const shape = describeStateShape(resource.state);

  return (
    <div className="state-summary-view" data-testid="state-summary-view">
      <p className="state-summary-warning">
        Reconstructed state is replay-derived. Confidence and diagnostics describe how complete this
        point-in-time view is.
      </p>
      <dl className="state-summary-grid">
        <dt>Resource</dt>
        <dd>
          {resource.kind} <span className="state-resource-uri">{resource.uri}</span>
        </dd>
        <dt>Confidence</dt>
        <dd data-confidence={resource.confidence}>{resource.confidence}</dd>
        <dt>Baseline event</dt>
        <dd>#{resource.baselineEventIdx}</dd>
        <dt>Last applied event</dt>
        <dd>#{resource.lastAppliedEventIdx}</dd>
        <dt>Baseline sequence</dt>
        <dd>{resource.baselineFromSeq ?? "—"}</dd>
        <dt>Last server sequence</dt>
        <dd>{resource.lastServerSeq ?? "—"}</dd>
        <dt>Diagnostics</dt>
        <dd>{resource.diagnostics.length}</dd>
        <dt>Top-level shape</dt>
        <dd>{shape.summary}</dd>
      </dl>
      {shape.details.length > 0 && (
        <ul className="state-shape-details" aria-label="Top-level state keys">
          {shape.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describeStateShape(state: unknown): { summary: string; details: string[] } {
  if (Array.isArray(state)) {
    return { summary: `array with ${state.length} items`, details: [] };
  }
  if (state && typeof state === "object") {
    const keys = Object.keys(state as Record<string, unknown>);
    return {
      summary: `object with ${keys.length} top-level keys`,
      details: keys.slice(0, 12),
    };
  }
  if (state === null) {
    return { summary: "null", details: [] };
  }
  const type = typeof state;
  return { summary: `${type}: ${previewValue(state)}`, details: [] };
}

function previewValue(value: unknown): string {
  const text = (() => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  })();
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
