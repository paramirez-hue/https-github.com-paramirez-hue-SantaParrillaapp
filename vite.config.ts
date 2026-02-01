
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Definimos específicamente la API_KEY para evitar serializar todo el objeto process.env
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
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
