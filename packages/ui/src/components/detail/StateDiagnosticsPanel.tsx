import type { JSX } from "react";
import type {
  ReplayClientIntent,
  ReplayDiagnostic,
  StateReplayCacheInfo,
} from "../../transport/state-client.js";

interface StateDiagnosticsPanelProps {
  readonly aggregateDiagnostics: readonly ReplayDiagnostic[];
  readonly selectedDiagnostics: readonly ReplayDiagnostic[];
  readonly intents: readonly ReplayClientIntent[];
  readonly cache: StateReplayCacheInfo;
}

export function StateDiagnosticsPanel({
  aggregateDiagnostics,
  selectedDiagnostics,
  intents,
  cache,
}: StateDiagnosticsPanelProps): JSX.Element {
  const hasDiagnostics = aggregateDiagnostics.length > 0 || selectedDiagnostics.length > 0;

  return (
    <section className="state-diagnostics" aria-label="Replay diagnostics">
      <div className="state-diagnostics-header">
        <h4>Replay diagnostics</h4>
        <span>
          cache {cache.hit ? "hit" : "miss"} · {cache.size}/{cache.maxEntries}
        </span>
        <span>{intents.length} client intents</span>
      </div>
      {!hasDiagnostics ? (
        <p className="state-diagnostics-empty">No replay diagnostics for this state point.</p>
      ) : (
        <div className="state-diagnostics-groups">
          <DiagnosticGroup title="Aggregate" diagnostics={aggregateDiagnostics} />
          <DiagnosticGroup title="Selected resource" diagnostics={selectedDiagnostics} />
        </div>
      )}
    </section>
  );
}

function DiagnosticGroup({
  title,
  diagnostics,
}: {
  readonly title: string;
  readonly diagnostics: readonly ReplayDiagnostic[];
}): JSX.Element {
  if (diagnostics.length === 0) {
    return (
      <div className="state-diagnostic-group">
        <h5>{title}</h5>
        <p className="state-diagnostics-empty">No diagnostics.</p>
      </div>
    );
  }

  return (
    <div className="state-diagnostic-group">
      <h5>{title}</h5>
      <ul>
        {diagnostics.map((diagnostic) => (
          <li
            key={`${title}-${diagnostic.code}-${diagnostic.eventIdx ?? "none"}-${diagnostic.message}`}
          >
            <span className="state-diagnostic-meta">
              <span data-severity={diagnostic.severity}>{diagnostic.severity}</span>
              <span>{diagnostic.code}</span>
              {diagnostic.eventIdx !== null && <span>event #{diagnostic.eventIdx}</span>}
            </span>
            <span className="state-diagnostic-message">{diagnostic.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
