import { defineConfig } from 'vite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig(({ command }) => ({
  // Sub-ruta para GitHub Pages: debe coincidir con el nombre del repo
  // (carloscus/g360-stock-reporter-lit → /g360-stock-reporter-lit/)
  base: command === 'serve' ? '/' : '/g360-stock-reporter-lit/',
  server: {
    port: 3000,
    historyApiFallback: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Copiar archivos estáticos que no son assets al directorio raíz del build
    rollupOptions: {
      output: {
        // Asegurar que archivos .js estáticos en public/ se copien directamente
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  cacheDir: join(tmpdir(), 'g360-vite-cache'),
  // Excluir archivos del build para que se copien como estáticos
  publicDir: 'public',
}));
