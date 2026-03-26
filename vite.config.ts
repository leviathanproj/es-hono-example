import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: `http://localhost:3001`,
          changeOrigin: true,
          headers: {
            'x-forwarded-proto': 'https',
          },
        },
      },
    },
  };
});
