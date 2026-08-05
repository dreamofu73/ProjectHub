import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

const cleanStarterAssetsPlugin = () => ({
  name: 'clean-starter-assets',
  buildStart() {
    ['hero.png', 'react.svg', 'vite.svg'].forEach(file => {
      const p = path.resolve(__dirname, 'src/assets', file);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cleanStarterAssetsPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: false,
        ws: true,
      }
    }
  }
})
