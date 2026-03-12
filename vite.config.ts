import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // ✅ FIX: Load env properly without hardcoded keys in production build
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // ✅ FIX: Removed hardcoded API_KEY define block
      // Environment variables are now loaded at runtime via:
      // - .env file (development)
      // - OCP Secrets (production/OpenShift)
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});