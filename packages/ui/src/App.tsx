import { type JSX, useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/shell/AppShell.js";
import { NoActiveLogState } from "./components/states/NoActiveLogState.js";
import { ServerNotRunningState } from "./components/states/ServerNotRunningState.js";
import { useAppStore } from "./state/store.js";
import type { LogStreamHandle } from "./transport/client.js";
import { useAhpViewerClient } from "./transport/transport-context.js";
import type { SafeCandidate } from "./types/safe-candidate.js";

declare global {
  interface Window {
    __ahpStream?: LogStreamHandle;
  }
}

export function App(): JSX.Element {
  const client = useAhpViewerClient();
  const connection = useAppStore((s) => s.connection);
  const [candidates, setCandidates] = useState<readonly SafeCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const refreshCandidates = useCallback(async (): Promise<void> => {
    setLoadingCandidates(true);
    try {
      const list = await client.fetchCandidates();
      setCandidates(list);
    } catch {
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, [client]);

  const replaceLogStream = useCallback((): LogStreamHandle => {
    const previous = typeof window !== "undefined" ? window.__ahpStream : undefined;
    previous?.close();
    const handle = client.connectLogStream();
    if (typeof window !== "undefined") window.__ahpStream = handle;
    return handle;
  }, [client]);

  // Probe transport first; map result to store connection state and (when
  // ready) open the live stream. Browser transport probes /api/log/meta;
  // Plan 11-03 webview transport probes via postMessage.
  useEffect(() => {
    let cancelled = false;
    let handle: LogStreamHandle | null = null;
    const run = async (): Promise<void> => {
      try {
        const result = await client.probeLogMeta();
        if (cancelled) return;
        if (result === "no-log") {
          useAppStore.getState().setConnection("no-log");
          await refreshCandidates();
          return;
        }
        if (result === "no-server") {
          useAppStore.getState().setConnection("no-server");
          return;
        }
        handle = client.connectLogStream();
        if (typeof window !== "undefined") window.__ahpStream = handle;
      } catch {
        if (!cancelled) useAppStore.getState().setConnection("no-server");
      }
    };
    void run();
    return () => {
      cancelled = true;
      handle?.close();
      if (typeof window !== "undefined") delete window.__ahpStream;
    };
  }, [client, refreshCandidates]);

  const onSelect = useCallback(
    async (id: string): Promise<void> => {
      const result = await client.openSessionByCandidate(id);
      useAppStore.getState().switchToLog(result.active.logKey, { kind: "candidate", id });
      replaceLogStream();
    },
    [client, replaceLogStream],
  );

  const onOpenPath = useCallback(
    async (path: string): Promise<void> => {
      const result = await client.openSessionByPath(path);
      useAppStore.getState().switchToLog(result.active.logKey, { kind: "path", path });
      replaceLogStream();
    },
    [client, replaceLogStream],
  );

  if (connection === "no-server") return <ServerNotRunningState />;
  if (connection === "no-log") {
    return (
      <NoActiveLogState
        candidates={candidates}
        isLoading={loadingCandidates}
        onSelect={onSelect}
        onOpenPath={onOpenPath}
        onRefresh={() => void refreshCandidates()}
      />
    );
  }
  return <AppShell />;
}
