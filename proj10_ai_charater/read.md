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
cd ai-desktop-mate
npm run tauri dev


# --- build app (target - release ai-desktop-mate.exe)
npx tauri build --no-bundle -- --offline

# --- build zip (dispackage)
# Bước 1: Di chuyển vào thư mục dự án và build bundle frontend
cd d:\A_Self_Proj\learn_mlflow\proj10_ai_charater\ai-desktop-mate
npm run build

# Bước 2: Build file thực thi Release của Rust (Offline)
cd src-tauri
cargo build --release --offline
cd ..

# Bước 3: Copy file .exe sang thư mục phân phối
Copy-Item "src-tauri\target\release\ai-desktop-mate.exe" "dist-package\Duck_ai_Manager_v1.0.0\Duck ai Manager.exe" -Force

# Bước 4: Nén thư mục thành file .zip để gửi cho máy khác
Compress-Archive -Path "dist-package\Duck_ai_Manager_v1.0.0\*" -DestinationPath "dist-package\Duck_ai_Manager_v1.0.0.zip" -Force

# --- cloud back end da deploy len render
da cicd de deploy khi push p11_ad...