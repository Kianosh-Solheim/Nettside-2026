import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isGithub = !!(process.env.GITHUB_ACTIONS || process.env.GITHUB_WORKFLOW);
  const baseUrl = isGithub ? (env.VITE_BASE_URL || '/Nettside-2026/') : '/';
  
  return {
    base: baseUrl,
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
    },
  };
});
