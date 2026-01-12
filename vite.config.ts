import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Plugin para gerar version.json automaticamente a cada build
function versionPlugin(): Plugin {
  return {
    name: 'version-generator',
    buildStart() {
      const versionInfo = {
        version: `1.0.${Date.now()}`,
        buildTime: new Date().toISOString()
      };
      
      fs.writeFileSync(
        path.resolve(__dirname, 'public/version.json'),
        JSON.stringify(versionInfo, null, 2)
      );
      
      console.log('[VersionPlugin] Generated version:', versionInfo.version);
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    versionPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
