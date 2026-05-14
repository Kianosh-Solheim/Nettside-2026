import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
  const baseUrl = isGithubActions ? '/Nettside-2026/' : '/';
  
  return {
    base: baseUrl,
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
      sourcemap: true,
      minify: 'esbuild',
    },
  };
});
