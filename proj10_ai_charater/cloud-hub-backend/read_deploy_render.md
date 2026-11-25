Bước 1: Copy file CI/CD & Blueprint lên thư mục gốc Git repo rồi push

Mở PowerShell tại D:\A_Self_Proj\learn_mlflow và chạy:

powershell
Copy-Item "proj10_ai_charater\cloud-hub-backend\render.yaml" "render.yaml" -Force
New-Item -ItemType Directory -Path ".github\workflows" -Force | Out-Null; Copy-Item "proj10_ai_charater\cloud-hub-backend\.github\workflows\cloud-hub-backend-cicd.yml" ".github\workflows\cloud-hub-backend-cicd.yml" -Force

Sau đó commit & push lên nhánh p11_advanced_proj (nhờ giữ nguyên .env trong .gitignore, tuyệt đối không push .env):

powershell
git add render.yaml .github/workflows/cloud-hub-backend-cicd.yml proj10_ai_charater/cloud-hub-backend
git commit -m "feat(cloud-hub): add Render Blueprint and GitHub Actions CI/CD"
git push origin p11_advanced_proj
Bước 2: Deploy trên Render
Vào Render -> New + -> Blueprint (chọn repo phongluong8901/Multi_AiAgent_3D, nhánh p11_advanced_proj) để tự đọc render.yaml, hoặc tạo Web Service thủ công với Root Directory = proj10_ai_charater/cloud-hub-backend, Build Command = npm ci --include=dev && npm run build, Start Command = npm start, Health Check Path = /api/health.
Vào mục Environment của service trên Render điền:
NODE_VERSION = 22
NODE_ENV = production
MONGODB_URI = chuỗi mongodb+srv://... của MongoDB Atlas
MONGODB_DB = duck_ai_manager
MONGODB_COLLECTION = community_skills
GOOGLE_CLIENT_ID = <your_client_id>.apps.googleusercontent.com
Trên MongoDB Atlas -> Security -> Network Access, thêm 0.0.0.0/0 (Allow Access from Anywhere) để Render (IP động) kết nối được MongoDB.
Truy cập https://<ten-service-render>.onrender.com/api/health kiểm tra thấy "ok":true,"mongo_connected":true,"google_client_configured":true.
Bước 3: Nối Deploy Hook cho GitHub Actions & trỏ .exe sang Render
Trong Render -> Settings, copy Deploy Hook URL -> vào GitHub Repo -> Settings -> Secrets and variables -> Actions tạo secret RENDER_DEPLOY_HOOK_URL (có thể thêm RENDER_SERVICE_URL là link https://...onrender.com để workflow tự kiểm tra health sau khi deploy).
Trong file .env đặt cạnh Duck ai Manager.exe (hoặc mục cấu hình Cloud Hub trong app), đổi CLOUD_HUB_API_URL=http://127.0.0.1:8787 thành CLOUD_HUB_API_URL=https://<ten-service-render>.onrender.com để mang .exe về bất kỳ máy nào cũng GET/POST tool trực tiếp lên MongoDB Atlas