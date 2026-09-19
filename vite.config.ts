import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const SERVER_PORT = process.env.PORT ?? "8787"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@shared": path.resolve(import.meta.dirname, "./shared"),
    },
  },
  server: {
    // Not Vite's 5173 default: this machine already runs another app there.
    port: 5180,
    strictPort: true,
    proxy: {
      // The key lives only in the Hono sidecar; the browser never sees it.
      "/api": {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: true,
      },
    },
  },
})
