npm create tauri-app@latest ai-desktop-mate -- --template vanilla-ts
cd ai-desktop-mate
npm install three @pixiv/three-vrm
npm install -D @types/three

# ---

Ok to proceed? (y) y


> npx
> create-tauri-app ai-desktop-mate --template vanilla-ts

✔ Identifier · com.mbw2025.ai-desktop-mate
✔ Choose which language to use for your frontend · TypeScript / JavaScript - (pnpm, yarn, npm, deno, bun)
✔ Choose your package manager · npm

# ---
npm run tauri dev
