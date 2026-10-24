import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend only consumes files inside of its own root:
//  - src/config.json              (written by backend/scripts/deploy.js)
//  - src/contracts/SmartEscrow.json (ABI copied by backend/scripts/deploy.js)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
});

