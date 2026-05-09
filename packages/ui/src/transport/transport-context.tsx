import { createContext, type JSX, type ReactNode, useContext } from "react";
import type { AhpViewerClient } from "./client.js";

const Ctx = createContext<AhpViewerClient | null>(null);

export interface AhpViewerClientProviderProps {
  readonly client: AhpViewerClient;
  readonly children: ReactNode;
}

export function AhpViewerClientProvider(props: AhpViewerClientProviderProps): JSX.Element {
  return <Ctx.Provider value={props.client}>{props.children}</Ctx.Provider>;
}

export function useAhpViewerClient(): AhpViewerClient {
  const value = useContext(Ctx);
  if (value === null) {
    throw new Error(
      "useAhpViewerClient must be used inside <AhpViewerClientProvider>; " +
        "wrap the app in main.tsx or pass a fake client in tests.",
    );
  }
  return value;
}
