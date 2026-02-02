
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Definimos la API_KEY y proveemos un objeto process básico para evitar errores en Vercel
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env': {},
    'global': 'window'
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'lucide-react', '@supabase/supabase-js']
        }
      }
    }
  }
});
