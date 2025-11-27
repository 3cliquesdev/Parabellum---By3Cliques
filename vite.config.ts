import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'pwa-icon.svg'],
      manifest: {
        name: 'Suporte - Atendimento ao Cliente',
        short_name: 'Suporte',
        description: 'Chat de suporte e atendimento ao cliente',
        theme_color: '#2563EB',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/public-chat',
        scope: '/',
        icons: [
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ],
        shortcuts: [
          {
            name: 'Novo Ticket',
            short_name: 'Ticket',
            url: '/open-ticket',
            icons: [{ src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml' }]
          },
          {
            name: 'Chat de Suporte',
            short_name: 'Chat',
            url: '/public-chat',
            icons: [{ src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml' }]
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MB limit
        runtimeCaching: [
          {
            urlPattern: /\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: /supabase\.co/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
