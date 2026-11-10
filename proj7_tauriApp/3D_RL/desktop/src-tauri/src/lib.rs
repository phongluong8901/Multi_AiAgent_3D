// ==============================================================================
// TAURI DESKTOP APPLICATION CORE LIBRARY
// ==============================================================================
// Quản lý cấu hình vòng đời của ứng dụng Desktop Tauri:
// - Khởi tạo Tauri Builder và các plugin hệ thống (Log Plugin, Window Management).
// - Kết nối IPC (Inter-Process Communication) giữa native Rust và WebView UI.
// - Thiết lập chế độ ghi log kỹ thuật và bắt các sự kiện vòng đời cửa sổ.
//
// Hướng dẫn nâng cấp trong tương lai:
// 1. Thêm Tauri Commands (fn có macro #[tauri::command]):
//    - Ví dụ: Tự động khởi chạy Backend Python main.py như một child process
//      khi ứng dụng Desktop mở, và tự động tắt process khi đóng ứng dụng.
// 2. Thêm tính năng Native File Dialog (chọn thư mục lưu checkpoint models, xuất logs).
// 3. Tùy biến thanh tiêu đề Custom Window Titlebar hoặc System Tray icon.
// ==============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Khi ở chế độ debug, tích hợp plugin ghi log kỹ thuật vào terminal stdout
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
