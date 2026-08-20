import { defineConfig } from 'vitest/config';

// Config separee de vite.config.ts : le plugin PWA n'a rien a faire dans les
// tests, et ca evite toute interference entre precache/service worker et
// l'environnement de test.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
