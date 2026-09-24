import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_URL ?? '/',
  resolve: {
    // The linked UI package must use this app's React instance.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Keep linked shared UI changes live during local development.
    exclude: ['@coverland-engineering/ui/user-picker'],
  },
  build: {
    chunkSizeWarningLimit: 3000,
  },
  server: {
    // The backend (`pnpm --filter backend dev`) listens on 3100 by default.
    proxy: {
      '/api': 'http://127.0.0.1:3100',
    },
  },
});
