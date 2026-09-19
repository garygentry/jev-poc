import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const SERVER_PORT = process.env.PORT ?? "8787"
const CLIENT_PORT = Number(process.env.CLIENT_PORT ?? 5180)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@shared": path.resolve(import.meta.dirname, "./shared"),
    },
  },
  server: {
    // Not Vite's 5173 default, which is commonly already taken. The e2e suite
    // overrides both ports so it can run beside a dev server.
    port: CLIENT_PORT,
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
