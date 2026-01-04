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
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MB limit
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\.(js|css)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'static-assets-v4',
              networkTimeoutSeconds: 1,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 }
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|ico|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-assets-v3',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /supabase\.co/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache-v3',
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
