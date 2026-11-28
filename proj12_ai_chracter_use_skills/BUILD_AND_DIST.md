# Hướng Dẫn Build File `.exe` & Phân Phối Cho Các Máy Windows Khác

Tài liệu này hướng dẫn cách build ứng dụng **Duck ai Manager** (`ai-desktop-mate`) thành bộ cài đặt `.exe` (NSIS) hoặc bản chạy trực tiếp (Portable) để cài đặt và sử dụng trên các máy Windows 10/11 khác.

---

## 1. Kiến Trúc Đóng Gói Hiện Tại

- **Toàn bộ Agent Runtime chạy bằng Rust thuần** bên trong file thực thi (`src-tauri/src/backend/`): 9Router LLM + DPAPI Vault, BM25 Skill Router, Cognitive Memory, và SkillEvolver Native — **không còn phụ thuộc thư mục `agent_runtime/`**.
- **Kho Skills (`skills/`):** được đóng gói kèm qua `bundle.resources` trong `ai-desktop-mate/src-tauri/tauri.conf.json` (gồm `code_skills`, `automationPc_skills`, `automationWeb_skills`, `automationLinux_skills`, `search_skills`, `new_skills`, `auto_skills`).
  - Khi chạy `npm run tauri dev` (debug): app ưu tiên đọc/ghi trực tiếp tại thư mục gốc `skills/`.
  - Khi chạy bản release `.exe` trên máy khác: app tự động ưu tiên tìm thư mục `skills/` nằm cùng cấp file `.exe`.
- **Kho Skill Cộng Đồng trên MongoDB (`cloud-hub-backend`):** hỗ trợ tìm kiếm và tải công khai các Python Pack Skills về lưu thẳng vào `skills/<pack>/` để chạy local mượt (0ms độ trễ mạng).

---

## 2. Yêu Cầu Môi Trường Để Build (Máy Dev)

1. **Node.js** `>= 20` (kèm `npm`)
2. **Rust & Cargo** (`rustup` + MSVC Build Tools / MSYS2 GNU toolchain trên Windows)
3. **Python** `>= 3.10` (dùng để thực thi các file `.py` trong `skills/`)

Kiểm tra nhanh trong PowerShell:

```powershell
node -v
npm -v
cargo --version
rustc --version
python --version
```

---

## 3. Các Bước Build File `.exe`

Mở PowerShell tại thư mục `ai-desktop-mate` (đóng `tauri dev` nếu đang chạy để tránh khóa file):

```powershell
cd ai-desktop-mate
npm install
npm run build
npm run tauri build -- --bundles nsis
```

Sau khi chạy xong, các file xuất ra nằm tại:

1. **Bộ cài đặt `.exe` (NSIS - khuyên dùng để gửi sang các máy khác):**
   `ai-desktop-mate/src-tauri/target/release/bundle/nsis/Duck ai Manager_1.0.0_x64-setup.exe`
2. **File thực thi trực tiếp (Portable):**
   `ai-desktop-mate/src-tauri/target/release/ai-desktop-mate.exe`
   *(Nếu copy bản portable sang máy khác, copy kèm thư mục `skills/` đặt cùng cấp với file `.exe`.)*

---

## 4. Đồng Bộ Toàn Bộ Skills Lên MongoDB (Tùy Chọn)

Để mọi máy khác có thể tải skill trực tiếp từ Cloud Hub MongoDB:

```powershell
cd cloud-hub-backend
npm install
npm run build
node scripts/seed_skills_to_mongo.mjs
```

---

## 5. Yêu Cầu Khi Chạy Trên Máy Người Dùng Khác

1. **Hệ điều hành:** Windows 10 (1803+) hoặc Windows 11 (64-bit).
2. **Microsoft Edge WebView2 Runtime:** Windows 11 có sẵn; trên Windows 10 trình cài đặt NSIS sẽ tự kiểm tra/cài đặt.
3. **Python 3.10+ (để chạy các Python Skills trong `skills/`):**
   - Cài Python 3.10+ trên máy đích và tick chọn **"Add Python to PATH"**, hoặc đặt `.venv\Scripts\python.exe` cùng cấp thư mục cài đặt.
   - Cài các gói Python cần thiết một lần trên máy đích:
     ```powershell
     pip install -r requirements.txt
     pip install pytest
     ```
4. **API Key (Gemini / Groq / Cloudflare):**
   - Mở **Studio 3D & Cấu Hình** trong app để nhập API Key (được mã hóa lưu an toàn qua Windows DPAPI Vault trên từng máy), không cần copy file `.env` cá nhân.

---

## 6. Khắc Phục Nhanh Nếu Build Lỗi

- **Lỗi `os error 32` (file đang bị chiếm dụng):** đóng cửa sổ `Duck ai Manager` hoặc dừng `npm run tauri dev` trước khi build.
- **Lỗi thiếu `link.exe` / MSVC:** cài **Visual Studio Build Tools** với workload *Desktop development with C++*.
- **Lỗi cache frontend cũ:** xóa `ai-desktop-mate/dist` rồi chạy lại `npm run build` và `npm run tauri build -- --bundles nsis`.
