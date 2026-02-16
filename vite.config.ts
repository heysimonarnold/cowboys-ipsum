import { defineConfig } from "vite";

export default defineConfig({
  base: "/cowboys-ipsum/",
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
