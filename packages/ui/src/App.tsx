import { type JSX, useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/shell/AppShell.js";
import { NoActiveLogState } from "./components/states/NoActiveLogState.js";
import { ServerNotRunningState } from "./components/states/ServerNotRunningState.js";
import { useAppStore } from "./state/store.js";
import {
  fetchCandidates,
  openSessionByCandidate,
  openSessionByPath,
} from "./transport/sessions-client.js";
import { type ConnectionHandle, connectLogStream } from "./transport/sse-client.js";
import type { SafeCandidate } from "./types/safe-candidate.js";

declare global {
  interface Window {
    __ahpStream?: ConnectionHandle;
  }
}

export function App(): JSX.Element {
  const connection = useAppStore((s) => s.connection);
  const [candidates, setCandidates] = useState<readonly SafeCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const refreshCandidates = useCallback(async (): Promise<void> => {
    setLoadingCandidates(true);
    try {
      const list = await fetchCandidates();
      setCandidates(list);
    } catch {
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  // Probe meta first; on 503 / network-down → no-server.
  // On 204 → no-log + load discovery candidates.
  // On 200 → open SSE stream.
  useEffect(() => {
    let cancelled = false;
    let handle: ConnectionHandle | null = null;
    const probe = async (): Promise<void> => {
      try {
        const r = await fetch("/api/log/meta");
        if (cancelled) return;
        if (r.status === 204) {
          useAppStore.getState().setConnection("no-log");
          await refreshCandidates();
          return;
        }
        const contentType = r.headers.get("content-type") ?? "";
        if (!r.ok || !contentType.toLowerCase().includes("application/json")) {
          useAppStore.getState().setConnection("no-server");
          return;
        }
        handle = connectLogStream();
        if (typeof window !== "undefined") window.__ahpStream = handle;
      } catch {
        if (!cancelled) useAppStore.getState().setConnection("no-server");
      }
    };
    void probe();
    return () => {
      cancelled = true;
      handle?.close();
      if (typeof window !== "undefined") delete window.__ahpStream;
    };
  }, [refreshCandidates]);

  const onSelect = useCallback(async (id: string): Promise<void> => {
    await openSessionByCandidate(id);
    useAppStore.getState().setLastOpenRef({ kind: "candidate", id });
    const handle = connectLogStream();
    if (typeof window !== "undefined") window.__ahpStream = handle;
  }, []);

  const onOpenPath = useCallback(async (path: string): Promise<void> => {
    await openSessionByPath(path);
    useAppStore.getState().setLastOpenRef({ kind: "path", path });
    const handle = connectLogStream();
    if (typeof window !== "undefined") window.__ahpStream = handle;
  }, []);

  if (connection === "no-server") return <ServerNotRunningState />;
  if (connection === "no-log") {
    return (
      <NoActiveLogState
        candidates={candidates}
        isLoading={loadingCandidates}
        onSelect={(id) => void onSelect(id)}
        onOpenPath={onOpenPath}
        onRefresh={() => void refreshCandidates()}
      />
    );
  }
  return <AppShell />;
}
