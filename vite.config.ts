import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Gera BUILD_ID único por build (timestamp ISO)
const BUILD_ID = new Date().toISOString();

// Plugin para injetar BUILD_ID no HTML durante o build
function htmlBuildIdPlugin(): Plugin {
  return {
    name: 'html-build-id',
    transformIndexHtml(html) {
      return html.replace('__BUILD_PLACEHOLDER__', BUILD_ID);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Code splitting agressivo para chunks menores
        manualChunks: {
          // Vendor: React core (usado em todas as páginas)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // Vendor: Supabase (backend)
          'vendor-supabase': ['@supabase/supabase-js'],
          
          // Vendor: TanStack Query (state management)
          'vendor-query': ['@tanstack/react-query'],
          
          // Vendor: Framer Motion (animações)
          'vendor-motion': ['framer-motion'],
          
          // Vendor: Recharts (gráficos - usado só em analytics)
          'vendor-charts': ['recharts'],
          
          // Vendor: Date-fns (utilitários de data)
          'vendor-dates': ['date-fns'],
        },
      },
    },
  },
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_MODE__: JSON.stringify(mode),
  },
  plugins: [
    react(),
    htmlBuildIdPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
