use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::Manager;

pub struct HitboxState {
    pub char_x: AtomicI32,
    pub char_y: AtomicI32,
    pub radius: AtomicI32,
    pub is_dragging: AtomicBool,
    pub is_ui_open: AtomicBool,
    pub manual_interactive: AtomicBool,
}

#[derive(Serialize, Clone, Debug)]
pub struct WinRect {
    pub hwnd: isize,
    pub title: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

// Cập nhật vị trí và kích thước hitbox của nhân vật từ frontend
#[tauri::command]
fn update_character_hitbox(
    state: tauri::State<'_, Arc<HitboxState>>,
    x: i32,
    y: i32,
    radius: i32,
    is_dragging: bool,
    is_ui_open: bool,
) {
    state.char_x.store(x, Ordering::Relaxed);
    state.char_y.store(y, Ordering::Relaxed);
    state.radius.store(radius, Ordering::Relaxed);
    state.is_dragging.store(is_dragging, Ordering::Relaxed);
    state.is_ui_open.store(is_ui_open, Ordering::Relaxed);
}

// Bật/tắt chế độ click xuyên thủ công nếu người dùng muốn
#[tauri::command]
fn set_manual_interactive(state: tauri::State<'_, Arc<HitboxState>>, interactive: bool) {
    state.manual_interactive.store(interactive, Ordering::Relaxed);
}

// Hàm quét tọa độ các cửa sổ đang mở trên Windows (Folder, Chrome, VS Code...)
#[tauri::command]
fn get_open_windows() -> Vec<WinRect> {
    let mut list: Vec<WinRect> = Vec::new();

    #[cfg(windows)]
    unsafe {
        use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
        use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetWindowRect, GetWindowTextLengthW, GetWindowTextW, IsIconic,
            IsWindowVisible,
        };

        unsafe extern "system" fn enum_window_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            unsafe {
                let results = &mut *(lparam.0 as *mut Vec<WinRect>);

                // Bỏ qua cửa sổ ẩn hoặc đang thu nhỏ (Minimize)
                if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() {
                    return BOOL(1);
                }

                // Bỏ qua các cửa sổ ngầm của Windows 11 (Cloaked UWP apps)
                let mut cloaked: u32 = 0;
                let _ = DwmGetWindowAttribute(
                    hwnd,
                    DWMWA_CLOAKED,
                    &mut cloaked as *mut _ as *mut _,
                    std::mem::size_of::<u32>() as u32,
                );
                if cloaked != 0 {
                    return BOOL(1);
                }

                let len = GetWindowTextLengthW(hwnd);
                if len == 0 {
                    return BOOL(1);
                }

                let mut buf = vec![0u16; (len + 1) as usize];
                GetWindowTextW(hwnd, &mut buf);
                let title = String::from_utf16_lossy(&buf[..len as usize]);

                // Lọc bỏ chính cửa sổ AI Desktop Mate và Program Manager
                if title == "AI Desktop Mate" || title == "Program Manager" || title == "Settings" {
                    return BOOL(1);
                }

                let mut rect = RECT::default();
                if GetWindowRect(hwnd, &mut rect).is_ok() {
                    let w = rect.right - rect.left;
                    let h = rect.bottom - rect.top;
                    // Chỉ lấy các cửa sổ có kích thước hợp lý
                    if w > 200 && h > 100 && rect.top > 0 {
                        results.push(WinRect {
                            hwnd: hwnd.0 as isize,
                            title,
                            x: rect.left,
                            y: rect.top,
                            width: w,
                            height: h,
                        });
                    }
                }
                BOOL(1)
            }
        }

        let _ = EnumWindows(Some(enum_window_proc), LPARAM(&mut list as *mut _ as isize));
    }

    list
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let hitbox = Arc::new(HitboxState {
        char_x: AtomicI32::new(-9999),
        char_y: AtomicI32::new(-9999),
        radius: AtomicI32::new(100),
        is_dragging: AtomicBool::new(false),
        is_ui_open: AtomicBool::new(false),
        manual_interactive: AtomicBool::new(false),
    });
    let hitbox_thread = Arc::clone(&hitbox);

    tauri::Builder::default()
        .manage(hitbox)
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    let mut currently_ignoring = false;
                    loop {
                        std::thread::sleep(Duration::from_millis(16));

                        if hitbox_thread.manual_interactive.load(Ordering::Relaxed) {
                            if currently_ignoring {
                                let _ = window.set_ignore_cursor_events(false);
                                currently_ignoring = false;
                            }
                            continue;
                        }

                        let is_dragging = hitbox_thread.is_dragging.load(Ordering::Relaxed);
                        let is_ui_open = hitbox_thread.is_ui_open.load(Ordering::Relaxed);

                        let mut should_interact = is_dragging || is_ui_open;

                        if !should_interact {
                            #[cfg(windows)]
                            {
                                use windows::Win32::Foundation::POINT;
                                use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

                                let mut pt = POINT::default();
                                unsafe {
                                    if GetCursorPos(&mut pt).is_ok() {
                                        let cx = hitbox_thread.char_x.load(Ordering::Relaxed);
                                        let cy = hitbox_thread.char_y.load(Ordering::Relaxed);
                                        let rad = hitbox_thread.radius.load(Ordering::Relaxed);

                                        let dx = pt.x - cx;
                                        let dy = pt.y - cy;
                                        if (dx * dx + dy * dy) <= (rad * rad) {
                                            should_interact = true;
                                        }
                                    }
                                }
                            }
                        }

                        if should_interact && currently_ignoring {
                            let _ = window.set_ignore_cursor_events(false);
                            currently_ignoring = false;
                        } else if !should_interact && !currently_ignoring {
                            let _ = window.set_ignore_cursor_events(true);
                            currently_ignoring = true;
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_character_hitbox,
            set_manual_interactive,
            get_open_windows
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
