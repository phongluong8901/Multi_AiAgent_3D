# Duck ai Manager - Cloud Hub Backend (TypeScript + Online Sync + MongoDB)

Service backend TypeScript tách rời khỏi app desktop [ai-desktop-mate](../ai-desktop-mate) để xử lý:
- Xác thực token Google OAuth 2.0 (`id_token` / `access_token`) phía server.
- Lưu trữ và đồng bộ Skill cộng đồng trên **MongoDB** (không lộ `MONGODB_URI` trong file `.exe` desktop).

## Chế độ hoạt động
- **Offline / Không cần đăng nhập**: `ai-desktop-mate` chạy độc lập 100% không cần bật server này.
- **Online Sync**: Chạy `cloud-hub-backend` (local hoặc deploy lên VPS/Render/Railway) và trỏ `CLOUD_HUB_API_URL` trong app desktop để đăng nhập Google và kéo/đẩy Skill với MongoDB.

## Cài đặt & Khởi chạy
```bash
cd cloud-hub-backend
cp .env.example .env
# Điền MONGODB_URI và GOOGLE_CLIENT_ID vào .env
npm install
npm run dev    # hoặc npm run build && npm start
```

## Kiểm thử
```bash
npm test
```
