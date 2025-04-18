import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: "/DShyam3.github.io",
  server: {
    port: 8080,
    open: true
  }
});

