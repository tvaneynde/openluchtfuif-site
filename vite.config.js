import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["favicon.svg"],
    manifest: {
      name: "OLF Scanner",
      short_name: "Scanner",
      description: "Openluchtfuif 2026 — ticket scanner voor vrijwilligers",
      display: "standalone",
      orientation: "portrait",
      background_color: "#1a0820",
      theme_color: "#1a0820",
      start_url: "/#/scanner",
      scope: "/",
      icons: [
        { src: "/scanner-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "/scanner-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    },
    workbox: {
      // Cache the app shell so scanner works offline
      globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/noihnuouftyvsvzybwer\.supabase\.co\//,
          handler: "NetworkFirst",
          options: {
            cacheName: "supabase-cache",
            networkTimeoutSeconds: 5,
            expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
          },
        },
      ],
    },
  }), cloudflare()],
  base: "/",
});