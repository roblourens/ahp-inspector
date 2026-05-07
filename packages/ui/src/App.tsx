import type { JSX } from "react";
import { AppShell } from "./components/shell/AppShell.js";
import { ServerNotRunningState } from "./components/states/ServerNotRunningState.js";
import { useAppStore } from "./state/store.js";

export function App(): JSX.Element {
  const connection = useAppStore((s) => s.connection);
  if (connection === "no-server") return <ServerNotRunningState />;
  return <AppShell />;
}
