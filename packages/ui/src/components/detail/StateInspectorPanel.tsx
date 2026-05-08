import { Loader2 } from "lucide-react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { fetchStateAt, type StateAtSuccessResponse } from "../../transport/state-client.js";
import { CopyToast } from "./CopyToast.js";
import { PrettyJsonView } from "./PrettyJsonView.js";
import { RawJsonView } from "./RawJsonView.js";
import { StateConfidenceBadge } from "./StateConfidenceBadge.js";
import { StateCopyMenu } from "./StateCopyMenu.js";
import { StateDiagnosticsPanel } from "./StateDiagnosticsPanel.js";
import {
  chooseDefaultResource,
  type SelectableStateResource,
  StateResourceSelector,
  stateResourceKey,
} from "./StateResourceSelector.js";
import { StateSummaryView } from "./StateSummaryView.js";

interface StateInspectorPanelProps {
  readonly idx: number;
  readonly logKey: string | null;
}

type LoadState =
  | { readonly status: "idle"; readonly data: null; readonly error: null }
  | { readonly status: "loading"; readonly data: null; readonly error: null }
  | { readonly status: "error"; readonly data: null; readonly error: string }
  | { readonly status: "ok"; readonly data: StateAtSuccessResponse; readonly error: null };

type StateTab = "summary" | "pretty" | "raw";

type SelectedLoadState =
  | { readonly status: "idle"; readonly data: null; readonly error: null }
  | { readonly status: "loading"; readonly data: null; readonly error: null }
  | { readonly status: "error"; readonly data: null; readonly error: string }
  | {
      readonly status: "ok";
      readonly data: NonNullable<StateAtSuccessResponse["selectedResource"]>;
      readonly error: null;
    };

const IDLE_STATE: LoadState = { status: "idle", data: null, error: null };
const IDLE_SELECTED_STATE: SelectedLoadState = { status: "idle", data: null, error: null };

export function StateInspectorPanel({ idx, logKey }: StateInspectorPanelProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>(IDLE_STATE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedLoadState, setSelectedLoadState] =
    useState<SelectedLoadState>(IDLE_SELECTED_STATE);
  const [stateTab, setStateTab] = useState<StateTab>("summary");
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectedAbortRef = useRef<AbortController | null>(null);
  const requestKey = `${idx}\u0000${logKey ?? ""}`;
  const lastRequestKeyRef = useRef(requestKey);

  const loadSelectedResource = useCallback(
    async (resource: SelectableStateResource) => {
      if (selectedAbortRef.current) selectedAbortRef.current.abort();
      const controller = new AbortController();
      selectedAbortRef.current = controller;
      setSelectedLoadState({ status: "loading", data: null, error: null });

      try {
        const data = await fetchStateAt(idx, {
          logKey,
          resourceKind: resource.kind,
          resourceUri: resource.uri,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (data?.selectedResource) {
          setLoadState((current) =>
            current.status === "ok"
              ? { status: "ok", data: { ...data, resources: current.data.resources }, error: null }
              : { status: "ok", data, error: null },
          );
          setSelectedLoadState({ status: "ok", data: data.selectedResource, error: null });
        } else {
          setSelectedLoadState({
            status: "error",
            data: null,
            error: `No reconstructed ${resource.kind} state was returned for ${resource.uri}.`,
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setSelectedLoadState({ status: "error", data: null, error: message });
      }
    },
    [idx, logKey],
  );

  const loadMetadata = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    if (selectedAbortRef.current) selectedAbortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState({ status: "loading", data: null, error: null });
    setSelectedKey(null);
    setSelectedLoadState(IDLE_SELECTED_STATE);

    try {
      const data = await fetchStateAt(idx, { logKey, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (data === null) {
        setLoadState({
          status: "error",
          data: null,
          error: `Event #${idx} not found while loading reconstructed state.`,
        });
      } else {
        setLoadState({ status: "ok", data, error: null });
        const defaultResource = chooseDefaultResource(data.resources);
        setSelectedKey(defaultResource ? stateResourceKey(defaultResource) : null);
        setStateTab("summary");
        if (defaultResource) {
          void loadSelectedResource(defaultResource);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      setLoadState({ status: "error", data: null, error: message });
    }
  }, [idx, logKey, loadSelectedResource]);

  useEffect(() => {
    if (lastRequestKeyRef.current === requestKey) return;
    lastRequestKeyRef.current = requestKey;
    setOpen(false);
    setLoadState(IDLE_STATE);
    setSelectedKey(null);
    setSelectedLoadState(IDLE_SELECTED_STATE);
    setStateTab("summary");
    if (abortRef.current) abortRef.current.abort();
    if (selectedAbortRef.current) selectedAbortRef.current.abort();
  }, [requestKey]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (selectedAbortRef.current) selectedAbortRef.current.abort();
    };
  }, []);

  function handleOpen(): void {
    setOpen((current) => {
      if (!current) void loadMetadata();
      return !current;
    });
  }

  function handleRetry(): void {
    void loadMetadata();
  }

  function handleSelectResource(resource: SelectableStateResource): void {
    setSelectedKey(stateResourceKey(resource));
    setStateTab("summary");
    void loadSelectedResource(resource);
  }

  return (
    <section
      data-testid="state-inspector-panel"
      aria-label="Reconstructed state inspector"
      className="state-inspector"
    >
      <div className="state-inspector-header">
        <div>
          <h3>Reconstructed state</h3>
          <p>Replay reducer state at event #{idx}.</p>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          aria-expanded={open}
          className="state-action-button"
        >
          State at this point
        </button>
      </div>

      {open && (
        <div className="state-inspector-body">
          {loadState.status === "loading" && (
            <div data-testid="state-inspector-loading" className="state-inline-status">
              <Loader2 size={14} className="spin" />
              Loading reconstructed state metadata…
            </div>
          )}

          {loadState.status === "error" && (
            <div data-testid="state-inspector-error" className="state-error">
              <p>{loadState.error}</p>
              <button type="button" onClick={handleRetry} className="state-secondary-button">
                Retry state lookup
              </button>
            </div>
          )}

          {loadState.status === "ok" && (
            <>
              <StateMetadataSummary data={loadState.data} />
              {loadState.data.resources.length === 0 ? (
                <div className="state-empty" data-testid="state-inspector-empty">
                  No reconstructed resources at this point.
                </div>
              ) : (
                <StateResourceSelector
                  resources={loadState.data.resources}
                  selectedKey={selectedKey}
                  onSelect={handleSelectResource}
                />
              )}
              <SelectedStateViews
                targetIndex={loadState.data.targetIndex}
                loadState={selectedLoadState}
                activeTab={stateTab}
                onTabChange={setStateTab}
                onCopy={(message, ok) => setToast({ message, kind: ok ? "success" : "error" })}
              />
              <StateDiagnosticsPanel
                aggregateDiagnostics={loadState.data.diagnostics}
                selectedDiagnostics={
                  selectedLoadState.status === "ok" ? selectedLoadState.data.diagnostics : []
                }
                intents={loadState.data.intents}
                cache={loadState.data.cache}
              />
            </>
          )}
        </div>
      )}
      {toast && (
        <CopyToast key={toast.message + Date.now()} message={toast.message} kind={toast.kind} />
      )}
    </section>
  );
}

function StateMetadataSummary({ data }: { readonly data: StateAtSuccessResponse }): JSX.Element {
  return (
    <div data-testid="state-inspector-metadata" className="state-metadata-summary">
      <StateConfidenceBadge confidence={data.confidence} label="Aggregate confidence" />
      <dl>
        <dt>Target</dt>
        <dd>#{data.targetIndex}</dd>
        <dt>Confidence</dt>
        <dd data-confidence={data.confidence}>{data.confidence}</dd>
        <dt>Resources</dt>
        <dd>{data.resources.length}</dd>
      </dl>
    </div>
  );
}

function SelectedStateViews({
  targetIndex,
  loadState,
  activeTab,
  onTabChange,
  onCopy,
}: {
  readonly targetIndex: number;
  readonly loadState: SelectedLoadState;
  readonly activeTab: StateTab;
  readonly onTabChange: (tab: StateTab) => void;
  readonly onCopy: (message: string, ok: boolean) => void;
}): JSX.Element | null {
  if (loadState.status === "idle") return null;
  if (loadState.status === "loading") {
    return (
      <div data-testid="state-resource-loading" className="state-inline-status">
        <Loader2 size={14} className="spin" />
        Loading selected resource state…
      </div>
    );
  }
  if (loadState.status === "error") {
    return (
      <div data-testid="state-resource-error" className="state-error">
        <p>{loadState.error}</p>
      </div>
    );
  }

  const resource = loadState.data;
  return (
    <div className="state-view-shell" data-testid="state-view-shell">
      <div className="state-view-header">
        <StateConfidenceBadge confidence={resource.confidence} label="Selected resource" />
        <StateCopyMenu targetIndex={targetIndex} resource={resource} onCopy={onCopy} />
      </div>
      <div className="state-tabs" role="tablist" aria-label="Reconstructed state views">
        {(["summary", "pretty", "raw"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className="state-tab"
            onClick={() => onTabChange(tab)}
          >
            {tab === "summary" ? "Summary" : tab === "pretty" ? "Pretty JSON" : "Raw JSON"}
          </button>
        ))}
      </div>
      <div className="state-tabpanel" role="tabpanel">
        {activeTab === "summary" && <StateSummaryView resource={resource} />}
        {activeTab === "pretty" && (
          <PrettyJsonView data={resource.state} onOpenRaw={() => onTabChange("raw")} />
        )}
        {activeTab === "raw" && <RawJsonView data={resource.state} />}
      </div>
    </div>
  );
}
