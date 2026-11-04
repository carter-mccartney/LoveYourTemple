import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative, so the same build works on
// GitHub Pages (https://<user>.github.io/<repo>/), Vercel, Netlify, or locally.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
