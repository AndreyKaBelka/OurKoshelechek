import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Provider as UrqlProvider } from "urql";
import "./styles/global.css";
import "./styles/ui.css";
import { createUrqlClient } from "./graphql/client";
import { AppStoreProvider } from "./store/store";
import { App } from "./App";

function Root() {
  const [client, setClient] = useState(createUrqlClient);
  return (
    <UrqlProvider value={client}>
      <AppStoreProvider onLogout={() => setClient(createUrqlClient())}>
        <App />
      </AppStoreProvider>
    </UrqlProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
