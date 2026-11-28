import { defineConfig } from "vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri` and `data`
      ignored: ["**/src-tauri/**", "**/data/**"],
    },
  },
  build: {
    chunkSizeWarningLimit: 750,
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              name: "vendor-vrm",
              test: /node_modules[\\/]@pixiv[\\/]three-vrm/,
              priority: 40,
            },
            {
              name: "vendor-three-addons",
              test: /node_modules[\\/]three[\\/]examples[\\/]/,
              priority: 35,
            },
            {
              name: "vendor-three",
              test: /node_modules[\\/]three[\\/]/,
              priority: 30,
            },
            {
              name: "vendor-tauri",
              test: /node_modules[\\/]@tauri-apps[\\/]/,
              priority: 25,
            },
            {
              name: "duck-3d-fx",
              test: /src[\\/](characters[\\/](microduck|animeIdol|rigState\.ts|accessories3d\.ts)|core[\\/](particles\.ts|soundFx\.ts))/,
              priority: 20,
            },
            {
              name: "ui-html",
              test: /src[\\/]frontend[\\/]components[\\/](?!(mountUi|animationManagerModal|dataChartEngine)\.ts$)/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
}));
