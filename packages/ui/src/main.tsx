import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/global.css";

const THEMES = new Set(["dark", "light", "hacker"]);

function initialTheme(): string {
  try {
    const stored = localStorage.getItem("ahp-theme");
    return stored && THEMES.has(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
}

document.documentElement.setAttribute("data-theme", initialTheme());

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
