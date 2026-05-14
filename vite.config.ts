import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const baseUrl = env.VITE_BASE_URL || process.env.VITE_BASE_URL || '/';
  
  return {
    base: baseUrl,
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
    },
  };
});
