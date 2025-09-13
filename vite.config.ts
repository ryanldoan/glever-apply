import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: "src/content.ts",
      },
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `chunks/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash][extname]`,
      },
    },
  },
  plugins: [],
});
