import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@fontsource-variable/space-grotesk/index.css";
import "flag-icons/css/flag-icons.min.css";
import "./index.css";
import App from "./App.tsx";
import { SolanaProviders } from "./solana/WalletContext.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <SolanaProviders>
          <App />
        </SolanaProviders>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>
);
