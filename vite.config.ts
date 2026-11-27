import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative, so the same build works on
// GitHub Pages (https://<user>.github.io/<repo>/), Vercel, Netlify, or locally.
export default defineConfig({
  base: "./",
  plugins: [react()],
  // Shown at the bottom of Settings, to tell whether a device has the latest version.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
});
