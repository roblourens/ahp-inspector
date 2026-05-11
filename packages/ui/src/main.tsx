import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/global.css";
import { applyTheme, readStoredTheme } from "./theme/theme.js";
import { createBrowserAhpViewerClient } from "./transport/browser-client.js";
import { AhpViewerClientProvider } from "./transport/transport-context.js";

applyTheme(readStoredTheme());

const el = document.getElementById("root");
if (el) {
  const client = createBrowserAhpViewerClient();
  createRoot(el).render(
    <StrictMode>
      <AhpViewerClientProvider client={client}>
        <App />
      </AhpViewerClientProvider>
    </StrictMode>,
  );
}
