# Duck ai Manager - Cloud Hub Backend (TypeScript + Online Sync + MongoDB)

Service backend TypeScript tách rời khỏi app desktop [ai-desktop-mate](../ai-desktop-mate) để xử lý:
- Xác thực token Google OAuth 2.0 (`id_token` / `access_token`) phía server.
- Lưu trữ, tìm kiếm, đồng bộ Skill cộng đồng và Chat Companion trên **MongoDB Atlas** (không lộ `MONGODB_URI` trong file `.exe` desktop).

## 1. Chế độ hoạt động
- **Offline / Không cần đăng nhập**: `ai-desktop-mate` chạy độc lập 100% không cần bật server này.
- **Online Sync**: Chạy local hoặc deploy `cloud-hub-backend` lên **Render** rồi trỏ `CLOUD_HUB_API_URL` sang URL HTTPS vừa deploy.

## 2. Chạy & Test Local
```powershell
cd cloud-hub-backend
copy .env.example .env
# Điền MONGODB_URI và GOOGLE_CLIENT_ID vào .env
npm install
npm test
npm run dev
```

Kiểm tra nhanh tại `http://127.0.0.1:8787/api/health`.

## 3. Deploy lên Render & Bật GitHub Actions CI/CD

Do Git root của repo `Multi_AiAgent_3D` nằm tại `D:\A_Self_Proj\learn_mlflow`, còn service nằm ở `proj10_ai_charater/cloud-hub-backend`, GitHub Actions và Render Blueprint chỉ tự đọc config tại thư mục gốc Git repo.

### Bước 1: Copy file CI/CD & Render Blueprint ra thư mục gốc Git repo
Chạy 2 lệnh PowerShell sau tại `D:\A_Self_Proj\learn_mlflow`:

```powershell
Copy-Item "proj10_ai_charater\cloud-hub-backend\render.yaml" "render.yaml" -Force
New-Item -ItemType Directory -Path ".github\workflows" -Force | Out-Null; Copy-Item "proj10_ai_charater\cloud-hub-backend\.github\workflows\cloud-hub-backend-cicd.yml" ".github\workflows\cloud-hub-backend-cicd.yml" -Force
```

Sau đó commit & push lên nhánh `p11_advanced_proj` (đảm bảo KHÔNG commit `.env`):

```powershell
git add render.yaml .github/workflows/cloud-hub-backend-cicd.yml proj10_ai_charater/cloud-hub-backend
git commit -m "feat(cloud-hub): add Render Blueprint and GitHub Actions CI/CD"
git push origin p11_advanced_proj
```

### Bước 2: Tạo Web Service trên Render
Bạn có 2 cách (khuyên dùng Blueprint):
- **Cách A (Blueprint - tự động nhận `render.yaml`)**:
  1. Vào Render Dashboard -> **New +** -> **Blueprint**.
  2. Chọn repo `phongluong8901/Multi_AiAgent_3D`, branch `p11_advanced_proj`.
  3. Render tự đọc `render.yaml` (`rootDir: proj10_ai_charater/cloud-hub-backend`, `buildCommand: npm ci --include=dev && npm run build`, `startCommand: npm start`, `healthCheckPath: /api/health`).
- **Cách B (Manual Web Service)**:
  1. **New +** -> **Web Service** -> chọn repo `phongluong8901/Multi_AiAgent_3D`, branch `p11_advanced_proj`.
  2. **Root Directory**: `proj10_ai_charater/cloud-hub-backend`
  3. **Build Command**: `npm ci --include=dev && npm run build`
  4. **Start Command**: `npm start`
  5. **Health Check Path**: `/api/health`

### Bước 3: Điền Environment Variables trên Render & Network Access trên MongoDB Atlas
Trên Render -> Service -> **Environment**:
- `NODE_VERSION` = `22`
- `NODE_ENV` = `production`
- `MONGODB_URI` = chuỗi `mongodb+srv://...` từ MongoDB Atlas
- `MONGODB_DB` = `duck_ai_manager`
- `MONGODB_COLLECTION` = `community_skills`
- `GOOGLE_CLIENT_ID` = `<your_client_id>.apps.googleusercontent.com`

Trên MongoDB Atlas -> **Security -> Network Access**:
- Thêm `0.0.0.0/0` (Allow Access from Anywhere) để server Render (IP động) kết nối được tới MongoDB Atlas.

Kiểm tra sau khi deploy bằng cách mở:
`https://<ten-service-render>.onrender.com/api/health`
-> Phải thấy `"ok":true,"mongo_connected":true,"google_client_configured":true`.

### Bước 4: Nối GitHub Actions CD với Render Deploy Hook
1. Vào Render -> Service -> **Settings** -> copy **Deploy Hook** URL.
2. Vào GitHub Repo -> **Settings -> Secrets and variables -> Actions** -> **New repository secret**:
   - `RENDER_DEPLOY_HOOK_URL` = Deploy Hook URL vừa copy từ Render.
   - `RENDER_SERVICE_URL` (tùy chọn) = `https://<ten-service-render>.onrender.com` (để CI/CD tự chờ kiểm tra `/api/health` sau khi deploy).
3. Từ giờ mỗi khi push code mới vào `proj10_ai_charater/cloud-hub-backend/`, GitHub Actions sẽ chạy `npm ci --include=dev`, `npm test`, `npm run build`, smoke-test `/api/health` rồi mới kích hoạt Render deploy.

### Bước 5: Trỏ `Duck ai Manager.exe` sang server Render
Trong file `.env` đặt cạnh `Duck ai Manager.exe` (hoặc cấu hình trong mục Cloud Hub của app), cập nhật:
```env
CLOUD_HUB_API_URL=https://<ten-service-render>.onrender.com
```
Từ lúc này bạn mang file `.exe` về nhà hay bất kỳ máy Windows nào chỉ cần mở app lên, đăng nhập Google 1 lần là GET/POST Skill với MongoDB Atlas trực tiếp mà không cần chạy terminal local.
