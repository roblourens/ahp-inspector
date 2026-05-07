import { type JSX, useEffect } from "react";
import { AppShell } from "./components/shell/AppShell.js";
import { ServerNotRunningState } from "./components/states/ServerNotRunningState.js";
import { useAppStore } from "./state/store.js";
import { type ConnectionHandle, connectLogStream } from "./transport/sse-client.js";

declare global {
  interface Window {
    __ahpStream?: ConnectionHandle;
  }
}

export function App(): JSX.Element {
  const connection = useAppStore((s) => s.connection);

  useEffect(() => {
    // Probe meta first; on 503 / network-down, route to the no-server state
    // (Plan 02-04 ServerNotRunningState). On success, open the SSE stream.
    let cancelled = false;
    let handle: ConnectionHandle | null = null;
    fetch("/api/log/meta").then(
      (r) => {
        if (cancelled) return;
        const contentType = r.headers.get("content-type") ?? "";
        if (!r.ok || !contentType.toLowerCase().includes("application/json")) {
          useAppStore.getState().setConnection("no-server");
          return;
        }
        handle = connectLogStream();
        if (typeof window !== "undefined") window.__ahpStream = handle;
      },
      () => {
        if (!cancelled) useAppStore.getState().setConnection("no-server");
      },
    );
    return () => {
      cancelled = true;
      if (handle) handle.close();
      if (typeof window !== "undefined") {
        delete window.__ahpStream;
      }
    };
  }, []);

  if (connection === "no-server") return <ServerNotRunningState />;
  return <AppShell />;
}
