import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Auto-update service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nova versão disponível! Atualizar agora?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App pronto para uso offline!');
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
