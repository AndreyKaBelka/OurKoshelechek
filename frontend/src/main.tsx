import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider as UrqlProvider } from "urql";
import "./styles/global.css";
import "./styles/ui.css";
import { urqlClient } from "./graphql/client";
import { AppStoreProvider } from "./store/store";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UrqlProvider value={urqlClient}>
      <AppStoreProvider>
        <App />
      </AppStoreProvider>
    </UrqlProvider>
  </StrictMode>,
);
