import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "wouter"],
          ui: [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "lucide-react",
          ],
          charts: ["recharts"],
          admin: ["./src/pages/admin/AdminDashboard.tsx"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: false,
    host: true,
    proxy: {
      "/api": {
        target: process.env.API_URL || "http://localhost:3001",
        changeOrigin: true,
      },
      "/uploads": {
        target: process.env.API_URL || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: true,
  },
});
