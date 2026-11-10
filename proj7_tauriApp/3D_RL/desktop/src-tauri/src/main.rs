// ==============================================================================
// TAURI DESKTOP APPLICATION ENTRY POINT
// ==============================================================================
// Ứng dụng Desktop chạy trên nền tảng Tauri v2 (Rust + WebView2 trên Windows):
// - main.rs: Điểm khởi chạy nhị phân (Entrypoint binary).
// - Đóng vai trò là cửa sổ Desktop Native hiệu năng cao, nhẹ và an toàn.
// - Nhúng và render giao diện Frontend React (Vite) từ localhost:5173 hoặc thư mục dist/.
// - Giao tiếp với Backend Python qua WebSocket và REST API HTTP.
// ==============================================================================

// Ngăn chặn cửa sổ terminal console màu đen xuất hiện trên Windows khi ở chế độ Release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Chuyển giao tiến trình khởi tạo và vòng lặp sự kiện cho thư viện app_lib (lib.rs)
    app_lib::run();
}
