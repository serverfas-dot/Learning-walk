import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages: base path is the repo name (set by CI via env var).
  // Locally it defaults to '/'.
  base: process.env.VITE_BASE_PATH || '/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
