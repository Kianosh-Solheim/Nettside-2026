import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
  // Use '/' if deploying to a custom domain (solheim.online), 
  // otherwise use the repo name for github.io subfolder.
  const baseUrl = isGithubActions ? '/' : '/';
  
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
