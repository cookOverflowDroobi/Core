/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const django = "http://127.0.0.1:8000";

export default defineConfig(({ command }) => ({
  // Django serves the production build from /static/ (see core.views.spa).
  base: command === "build" ? "/static/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Keep the browser's Host header so Django's CSRF check and emailed links use :5173.
    proxy: {
      "/api": { target: django, changeOrigin: false },
      "/media": { target: django, changeOrigin: false },
      "/static/images": { target: django, changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: false,
  },
}));
