import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { retireRecordPreview } from "./lib/retirePreview";
import { App } from "./App";
import { StoreProvider } from "./lib/store";
import "./styles.css";
import "./designs.css";
import "./sides.css";
retireRecordPreview();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
