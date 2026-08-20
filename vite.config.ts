import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Les deux reseaux pesent ensemble une quinzaine de megaoctets. Le seuil par
// defaut de Workbox (2 Mo) les exclurait du precache : on le releve, sans quoi
// le mode hors ligne ne fonctionnerait pas.
const LIMITE_PRECACHE = 40 * 1024 * 1024;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'favicon.png'],
      manifest: {
        name: 'AgriCam - diagnostic des cultures maraicheres',
        short_name: 'AgriCam',
        description:
          "Photographiez un fruit, obtenez un diagnostic explique, meme sans reseau.",
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F4EF',
        theme_color: '#0E1A13',
        icons: [
          { src: '/icons/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icone-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icone-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,json,bin,onnx,wasm}'],
        maximumFileSizeToCacheInBytes: LIMITE_PRECACHE,
        // Sans ceci, une navigation hors ligne vers une route interne
        // (/diagnostic, /historique...) ne trouve aucun fichier "diagnostic"
        // sur le disque et le navigateur affiche sa propre page d'erreur
        // "pas de connexion" au lieu de l'application - meme avec le
        // precache en place. /api/* est exclu : ce sont des fonctions
        // serveur, jamais des pages a servir depuis le cache.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Fonds de carte : utiles en ligne, jamais bloquants hors ligne.
            urlPattern: /^https:\/\/.*\.(?:tiles|basemaps)\..*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonds-de-carte',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: {
    host: true,
  },
});
