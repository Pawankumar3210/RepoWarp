import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import "./styles/index.css";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";

const container = document.getElementById("root");
if (!container) throw new Error("RepoWarp root element is missing.");

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
