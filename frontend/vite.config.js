import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const { VITE_API_BASE_URL: fileApiBaseUrl } = loadEnv(mode, process.cwd(), 'VITE_');
  // Vercel injects project variables into the build process. Reading both
  // sources supports Vercel settings and local .env.production development.
  const apiBaseUrl = process.env.VITE_API_BASE_URL || fileApiBaseUrl || '';

  if (command === 'build' && mode === 'production') {
    if (!apiBaseUrl) {
      throw new Error('Set VITE_API_BASE_URL in the frontend project environment or frontend/.env.production.');
    }
    try {
      const parsed = new URL(apiBaseUrl);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
        throw new Error('The API URL must use HTTPS and must not include credentials, a query, or a fragment.');
      }
    } catch (error) {
      throw new Error(`Invalid VITE_API_BASE_URL: ${error.message}`);
    }
  }

  return {
    plugins: [react()],
    // Vite embeds this public API origin in the browser bundle. The matching
    // Vercel deployment URL keeps preview deployments isolated from production.
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    server: { port: 5173, strictPort: true },
  };
});
