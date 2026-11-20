use serde::Serialize;
use std::sync::atomic::{AtomicIsize, Ordering};

static LAST_ACTIVE_HWND: AtomicIsize = AtomicIsize::new(0);

#[derive(Serialize, Clone, Debug)]
pub struct WinRect {
    pub hwnd: isize,
    pub title: String,
    pub process_name: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub is_maximized: bool,
}

#[cfg(windows)]
pub unsafe fn get_process_name_by_hwnd(hwnd: windows::Win32::Foundation::HWND) -> String {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

    let mut pid: u32 = 0;
    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return String::new();
        }
        if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
            let mut buf = [0u16; 260];
            let mut size = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                windows::core::PWSTR(buf.as_mut_ptr()),
                &mut size,
            )
            .is_ok();
            let _ = CloseHandle(handle);
            if ok && size > 0 {
                let full = String::from_utf16_lossy(&buf[..size as usize]);
                return std::path::Path::new(&full)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
            }
        }
    }
    String::new()
}

fn is_ignored_title(title: &str) -> bool {
    title.is_empty()
        || title == "AI Desktop Mate"
        || title == "Duck ai Manager"
        || title.starts_with("Duck Mini Screen")
        || title == "Program Manager"
        || title == "Settings"
        || title == "Windows Input Experience"
        || title == "MSCTFIME UI"
        || title == "Default IME"
}

pub fn get_active_external_hwnd() -> isize {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetAncestor, GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, IsWindow,
            IsWindowVisible, GA_ROOT,
        };

        let mut fg = GetForegroundWindow();
        if !fg.0.is_null() {
            let root = GetAncestor(fg, GA_ROOT);
            if !root.0.is_null() {
                fg = root;
            }
        }

        if !fg.0.is_null() && IsWindow(fg).as_bool() && IsWindowVisible(fg).as_bool() {
            let len = GetWindowTextLengthW(fg);
            if len > 0 {
                let mut buf = vec![0u16; (len + 1) as usize];
                GetWindowTextW(fg, &mut buf);
                let title = String::from_utf16_lossy(&buf[..len as usize]);
                if !is_ignored_title(&title) {
                    let val = fg.0 as isize;
                    LAST_ACTIVE_HWND.store(val, Ordering::Relaxed);
                    return val;
                }
            }
        }
    }
    LAST_ACTIVE_HWND.load(Ordering::Relaxed)
}

pub fn scan_open_windows() -> Vec<WinRect> {
    let mut list: Vec<WinRect> = Vec::new();

    #[cfg(windows)]
    unsafe {
        use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
        use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetWindowRect, GetWindowTextLengthW, GetWindowTextW, IsIconic,
            IsWindowVisible, IsZoomed,
        };

        unsafe extern "system" fn enum_window_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            unsafe {
                let results = &mut *(lparam.0 as *mut Vec<WinRect>);

                if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() {
                    return BOOL(1);
                }

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

                if is_ignored_title(&title) {
                    return BOOL(1);
                }

                let mut rect = RECT::default();
                if GetWindowRect(hwnd, &mut rect).is_ok() {
                    let w = rect.right - rect.left;
                    let h = rect.bottom - rect.top;
                    // Chấp nhận cả cửa sổ phóng to (maximized có top = -8) hoặc sát mép trên (top = 0)
                    if w > 200 && h > 100 && rect.top >= -24 && rect.bottom > 40 {
                        let process_name = get_process_name_by_hwnd(hwnd);
                        let is_maximized = IsZoomed(hwnd).as_bool();
                        results.push(WinRect {
                            hwnd: hwnd.0 as isize,
                            title,
                            process_name,
                            x: rect.left.max(0),
                            y: rect.top.max(0),
                            width: w,
                            height: h,
                            is_maximized,
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

#[derive(Serialize, Clone, Debug)]
pub struct FrameZone {
    pub label: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub ledge_offset_y: i32,
}

pub fn get_window_frames(hwnd_val: isize) -> Vec<FrameZone> {
    let mut zones: Vec<FrameZone> = Vec::new();

    #[cfg(windows)]
    unsafe {
        use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumChildWindows, GetWindowRect, IsWindow, IsWindowVisible,
        };

        let target = HWND(hwnd_val as *mut _);
        if target.0.is_null() || !IsWindow(target).as_bool() {
            return zones;
        }

        let mut rect = RECT::default();
        if GetWindowRect(target, &mut rect).is_err() {
            return zones;
        }

        let wx = rect.left.max(0);
        let wy = rect.top.max(0);
        let w = (rect.right - rect.left).max(240);
        let h = (rect.bottom - rect.top).max(160);

        // Quét các control con thực tế (nếu app hỗ trợ Win32 child HWND như File Explorer)
        let mut child_boxes: Vec<(i32, i32, i32, i32)> = Vec::new();
        unsafe extern "system" fn enum_child_proc(child: HWND, lparam: LPARAM) -> BOOL {
            unsafe {
                let acc = &mut *(lparam.0 as *mut Vec<(i32, i32, i32, i32)>);
                if acc.len() >= 12 || !IsWindowVisible(child).as_bool() {
                    return BOOL(1);
                }
                let mut cr = RECT::default();
                if GetWindowRect(child, &mut cr).is_ok() {
                    let cw = cr.right - cr.left;
                    let ch = cr.bottom - cr.top;
                    if cw >= 120 && ch >= 36 {
                        acc.push((cr.left, cr.top, cw, ch));
                    }
                }
                BOOL(1)
            }
        }
        let _ = EnumChildWindows(target, Some(enum_child_proc), LPARAM(&mut child_boxes as *mut _ as isize));

        // 4 vùng ngữ nghĩa trực quan trong Chrome / VS Code / File Explorer
        zones.push(FrameZone {
            label: "Thanh Tab & Tiêu đề".to_string(),
            x: wx + 12,
            y: wy + 6,
            width: (w - 24).max(140),
            height: 42,
            ledge_offset_y: 42,
        });

        zones.push(FrameZone {
            label: "Khung Địa chỉ / Toolbar".to_string(),
            x: wx + 16,
            y: wy + 46,
            width: (w - 32).max(140),
            height: 46,
            ledge_offset_y: 88,
        });

        let sidebar_w = (w / 4).clamp(140, 280);
        zones.push(FrameZone {
            label: "Khung Sidebar / Cây thư mục".to_string(),
            x: wx + 12,
            y: wy + 94,
            width: sidebar_w,
            height: (h / 2).max(100),
            ledge_offset_y: ((h as f32 * 0.55) as i32).max(120),
        });

        let content_x = child_boxes
            .iter()
            .find(|c| c.2 > w / 2 && c.3 > h / 3)
            .map(|c| c.0.max(wx + 24))
            .unwrap_or(wx + 24);

        zones.push(FrameZone {
            label: "Sàn Nội dung Trong Cửa sổ".to_string(),
            x: content_x,
            y: wy + 96,
            width: (w - 48).max(160),
            height: (h - 100).max(80),
            ledge_offset_y: (h - 28).max(60),
        });
    }

    zones
}
