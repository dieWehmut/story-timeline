import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react'],
        },
      },
    },
  },
  preview: {
    headers: {
      // index.html must always revalidate
      'Cache-Control': 'no-cache',
    },
  },
});
