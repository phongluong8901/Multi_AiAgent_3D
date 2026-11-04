pnpm create tauri-app@latest

cd UIapp

cd edge-compute-client
pnpm install
pnpm add @tauri-apps/plugin-shell


# --- UIapp
pnpm tauri build