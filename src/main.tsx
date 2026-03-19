import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { OfflineProvider } from "./hooks/useOffline";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <OfflineProvider>
      <App />
    </OfflineProvider>
  </ThemeProvider>
);
