import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: "https://theaiwrapped.com",
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes("/report"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    worker: {
      rollupOptions: {
        output: {
          // Match Astro's client asset naming so assets shared between the
          // worker and client bundles (sql.js wasm) dedupe to one file.
          assetFileNames: "_astro/[name].[hash][extname]",
        },
      },
    },
  },
  output: "static",
});
