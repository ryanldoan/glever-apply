import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

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
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "Glever.png", dest: "." },
        { src: "LeverIcon.png", dest: "." },
        { src: "GreenhouseIcon.png", dest: "." },
      ],
    }),
  ],
});
