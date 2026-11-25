use serde::Serialize;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::core::hitbox::{HitboxState, UiRect};
use crate::core::windows::{get_active_external_hwnd, scan_open_windows, WinRect};

fn scan_open_windows_cached(max_age: Duration) -> Vec<WinRect> {
    static CACHE: OnceLock<Mutex<(Option<Instant>, Vec<WinRect>)>> = OnceLock::new();
    let mutex = CACHE.get_or_init(|| Mutex::new((None, Vec::new())));
    let mut guard = mutex.lock().unwrap_or_else(|e| e.into_inner());
    let now = Instant::now();
    if let Some(last_at) = guard.0 {
        if now.duration_since(last_at) < max_age {
            return guard.1.clone();
        }
    }
    let fresh = scan_open_windows();
    guard.0 = Some(now);
    guard.1 = fresh.clone();
    fresh
}

#[derive(Serialize, Clone, Debug)]
pub struct DesktopState {
    pub windows: Vec<WinRect>,
    pub active_hwnd: isize,
    pub cursor_x: i32,
    pub cursor_y: i32,
    pub audio_peak: f32,
    pub audio_left: f32,
    pub audio_right: f32,
    pub audio_beat_seq: i32,
    pub audio_bpm: i32,
    pub key_press_total: i32,
    pub cursor_idle_ms: i32,
}

#[tauri::command]
pub fn update_character_hitbox(
    state: tauri::State<'_, Arc<HitboxState>>,
    x: i32,
    y: i32,
    radius: i32,
    ui_rects: Vec<UiRect>,
    is_dragging: bool,
) {
    state.char_x.store(x, Ordering::Relaxed);
    state.char_y.store(y, Ordering::Relaxed);
    state.char_r.store(radius, Ordering::Relaxed);
    if let Ok(mut guard) = state.ui_rects.lock() {
        *guard = ui_rects;
    }
    state.is_dragging.store(is_dragging, Ordering::Relaxed);
}

#[tauri::command]
pub fn set_manual_interactive(state: tauri::State<'_, Arc<HitboxState>>, interactive: bool) {
    state.manual_interactive.store(interactive, Ordering::Relaxed);
}

#[tauri::command]
pub fn get_open_windows() -> Vec<WinRect> {
    scan_open_windows()
}

#[tauri::command]
pub fn scan_window_frames(hwnd: isize) -> Vec<crate::core::windows::FrameZone> {
    crate::core::windows::get_window_frames(hwnd)
}

#[tauri::command]
pub fn get_desktop_state(
    state: tauri::State<'_, Arc<HitboxState>>,
    fast_window_scan: Option<bool>,
) -> DesktopState {
    let ttl = Duration::from_millis(if fast_window_scan.unwrap_or(false) {
        55
    } else {
        200
    });
    DesktopState {
        windows: scan_open_windows_cached(ttl),
        active_hwnd: get_active_external_hwnd(),
        cursor_x: state.cursor_x.load(Ordering::Relaxed),
        cursor_y: state.cursor_y.load(Ordering::Relaxed),
        audio_peak: state.audio_peak_milli.load(Ordering::Relaxed) as f32 / 1000.0,
        audio_left: state.audio_left_milli.load(Ordering::Relaxed) as f32 / 1000.0,
        audio_right: state.audio_right_milli.load(Ordering::Relaxed) as f32 / 1000.0,
        audio_beat_seq: state.audio_beat_seq.load(Ordering::Relaxed),
        audio_bpm: state.audio_bpm.load(Ordering::Relaxed),
        key_press_total: state.key_press_counter.load(Ordering::Relaxed),
        cursor_idle_ms: state.cursor_idle_ms.load(Ordering::Relaxed),
    }
}

#[tauri::command]
pub fn nudge_cursor_pos(
    state: tauri::State<'_, Arc<HitboxState>>,
    dx: i32,
    dy: i32,
) -> Result<(i32, i32), String> {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::WindowsAndMessaging::{GetCursorPos, SetCursorPos};

        state.goose_nudging.store(true, Ordering::Relaxed);
        let mut pt = POINT::default();
        let res = unsafe {
            if GetCursorPos(&mut pt).is_ok() {
                let nx = pt.x + dx;
                let ny = pt.y + dy;
                if SetCursorPos(nx, ny).is_ok() {
                    Ok((nx, ny))
                } else {
                    Err("Không thể dịch chuyển con trỏ chuột.".to_string())
                }
            } else {
                Err("Không đọc được tọa độ con trỏ chuột.".to_string())
            }
        };
        state.cursor_idle_ms.store(0, Ordering::Relaxed);
        state.goose_nudging.store(false, Ordering::Relaxed);
        res
    }
    #[cfg(not(windows))]
    {
        let _ = (state, dx, dy);
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

#[cfg(windows)]
fn map_win32_err(err: windows::core::Error, title: &str) -> String {
    let code = err.code().0 as u32;
    if code == 0x80070005 {
        format!(
            "Cửa sổ \"{}\" đang chạy với quyền Administrator (bảo mật UIPI của Windows). Hãy khởi động AI Desktop Mate bằng 'Run as administrator' để có quyền điều khiển ứng dụng này.",
            title
        )
    } else {
        format!("Lỗi Win32 khi điều khiển cửa sổ \"{}\": {}", title, err)
    }
}

#[cfg(windows)]
unsafe fn ensure_floating_window(
    target: windows::Win32::Foundation::HWND,
    screen_w: i32,
    screen_h: i32,
    title: &str,
) -> Result<windows::Win32::Foundation::RECT, String> {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowRect, IsZoomed, SetWindowPos, ShowWindow, SWP_NOACTIVATE, SWP_NOZORDER, SW_RESTORE,
    };

    let mut was_zoomed = unsafe { IsZoomed(target).as_bool() };
    if was_zoomed {
        unsafe {
            let _ = ShowWindow(target, SW_RESTORE);
        }
    }

    let mut rect = RECT::default();
    if unsafe { GetWindowRect(target, &mut rect) }.is_err() {
        return Err("Không đọc được kích thước cửa sổ".to_string());
    }

    let cur_w = rect.right - rect.left;
    let cur_h = rect.bottom - rect.top;
    if was_zoomed || cur_w >= screen_w - 60 || cur_h >= screen_h - 80 {
        let float_w = ((screen_w * 68) / 100).max(480);
        let work_h = (screen_h - 48).max(400);
        let float_h = ((work_h * 72) / 100).max(360);
        let float_x = ((screen_w - float_w) / 2).max(20);
        let float_y = ((work_h - float_h) / 2).max(20);
        unsafe {
            SetWindowPos(
                target,
                None,
                float_x,
                float_y,
                float_w,
                float_h,
                SWP_NOZORDER | SWP_NOACTIVATE,
            )
            .map_err(|e| map_win32_err(e, title))?;
            let _ = GetWindowRect(target, &mut rect);
        }
        was_zoomed = false;
        let _ = was_zoomed;
    }

    Ok(rect)
}

#[tauri::command]
pub fn interact_window(
    hwnd: isize,
    action: String,
    dx: Option<i32>,
    dy: Option<i32>,
) -> Result<WinRect, String> {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::Foundation::{HWND, RECT};
        use windows::Win32::UI::WindowsAndMessaging::{
            GetSystemMetrics, GetWindowRect, GetWindowTextLengthW, GetWindowTextW, IsWindow,
            IsWindowVisible, IsZoomed, SetWindowPos, ShowWindow, SM_CXSCREEN, SM_CYSCREEN,
            SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SW_MAXIMIZE, SW_MINIMIZE,
            SW_RESTORE,
        };

        let target = HWND(hwnd as *mut core::ffi::c_void);
        if !IsWindow(target).as_bool() || !IsWindowVisible(target).as_bool() {
            return Err("Cửa sổ không còn tồn tại hoặc đã bị ẩn".to_string());
        }

        let len = GetWindowTextLengthW(target);
        let mut buf = vec![0u16; (len + 1) as usize];
        if len > 0 {
            GetWindowTextW(target, &mut buf);
        }
        let title = String::from_utf16_lossy(&buf[..len as usize]);
        if title == "AI Desktop Mate" || title == "Program Manager" {
            return Err("Không thể tương tác với cửa sổ hệ thống này".to_string());
        }

        let screen_w = GetSystemMetrics(SM_CXSCREEN).max(800);
        let screen_h = GetSystemMetrics(SM_CYSCREEN).max(600);

        match action.as_str() {
            "minimize" => {
                let _ = ShowWindow(target, SW_MINIMIZE);
            }
            "maximize" => {
                let _ = ShowWindow(target, SW_MAXIMIZE);
            }
            "restore" => {
                let _ = ShowWindow(target, SW_RESTORE);
            }
            "push" => {
                let rect = ensure_floating_window(target, screen_w, screen_h, &title)?;
                let w = rect.right - rect.left;
                let mut new_x = rect.left + dx.unwrap_or(0);
                let mut new_y = rect.top + dy.unwrap_or(0);
                new_x = new_x.clamp(-w + 120, screen_w - 120);
                new_y = new_y.clamp(0, screen_h - 100);
                SetWindowPos(
                    target,
                    None,
                    new_x,
                    new_y,
                    0,
                    0,
                    SWP_NOZORDER | SWP_NOSIZE | SWP_NOACTIVATE,
                )
                .map_err(|e| map_win32_err(e, &title))?;
            }
            "resize_delta" => {
                let rect = ensure_floating_window(target, screen_w, screen_h, &title)?;
                let cur_w = rect.right - rect.left;
                let cur_h = rect.bottom - rect.top;
                let delta_w = dx.unwrap_or(0);
                let delta_h = dy.unwrap_or(0);
                let clamped_w = (cur_w + delta_w).clamp(320, screen_w - 40);
                let clamped_h = (cur_h + delta_h).clamp(220, screen_h - 60);
                let new_x = rect.left.clamp(0, (screen_w - clamped_w).max(0));
                let new_y = rect.top.clamp(0, (screen_h - clamped_h).max(0));

                SetWindowPos(
                    target,
                    None,
                    new_x,
                    new_y,
                    clamped_w,
                    clamped_h,
                    SWP_NOZORDER | SWP_NOACTIVATE,
                )
                .map_err(|e| map_win32_err(e, &title))?;
            }
            "shrink" | "expand" => {
                let rect = ensure_floating_window(target, screen_w, screen_h, &title)?;
                let cur_w = rect.right - rect.left;
                let cur_h = rect.bottom - rect.top;
                let factor = if action == "shrink" { 0.86 } else { 1.16 };
                let new_w = ((cur_w as f64) * factor).round() as i32;
                let new_h = ((cur_h as f64) * factor).round() as i32;
                let clamped_w = new_w.clamp(340, screen_w - 40);
                let clamped_h = new_h.clamp(240, screen_h - 60);

                let center_x = rect.left + cur_w / 2;
                let new_x = (center_x - clamped_w / 2).clamp(0, (screen_w - clamped_w).max(0));
                let new_y = rect.top.clamp(0, (screen_h - clamped_h).max(0));

                SetWindowPos(
                    target,
                    None,
                    new_x,
                    new_y,
                    clamped_w,
                    clamped_h,
                    SWP_NOZORDER | SWP_NOACTIVATE,
                )
                .map_err(|e| map_win32_err(e, &title))?;
            }
            "focus" => {
                let _ = SetWindowPos(
                    target,
                    None,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                );
            }
            _ => return Err(format!("Hành động không hỗ trợ: {action}")),
        }

        let mut updated = RECT::default();
        let _ = GetWindowRect(target, &mut updated);
        let process_name = crate::core::windows::get_process_name_by_hwnd(target);
        let is_maximized = IsZoomed(target).as_bool();
        Ok(WinRect {
            hwnd,
            title,
            process_name,
            x: updated.left,
            y: updated.top,
            width: updated.right - updated.left,
            height: updated.bottom - updated.top,
            is_maximized,
        })
    }

    #[cfg(not(windows))]
    {
        let _ = (hwnd, action, dx, dy);
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

#[tauri::command]
pub fn arrange_desktop_windows(layout: String) -> Result<Vec<WinRect>, String> {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::Foundation::{HWND, RECT};
        use windows::Win32::UI::WindowsAndMessaging::{
            GetSystemMetrics, GetWindowRect, IsWindow, IsWindowVisible, IsZoomed, SetWindowPos,
            ShowWindow, SM_CXSCREEN, SM_CYSCREEN, SWP_NOACTIVATE, SWP_NOZORDER, SW_RESTORE,
        };

        let windows = scan_open_windows();
        if windows.is_empty() {
            return Err("Không có cửa sổ ứng dụng nào đang mở để sắp xếp".to_string());
        }

        let screen_w = GetSystemMetrics(SM_CXSCREEN).max(800);
        let work_h = (GetSystemMetrics(SM_CYSCREEN) - 48).max(550);

        let mut slots: Vec<(isize, i32, i32, i32, i32)> = Vec::new();
        match layout.as_str() {
            "split_2" => {
                let count = windows.len().min(2);
                if count == 1 {
                    let w = (screen_w * 72) / 100;
                    let h = (work_h * 78) / 100;
                    slots.push((windows[0].hwnd, (screen_w - w) / 2, (work_h - h) / 2, w, h));
                } else {
                    let half_w = screen_w / 2 - 9;
                    let full_h = work_h - 12;
                    slots.push((windows[0].hwnd, 6, 6, half_w, full_h));
                    slots.push((windows[1].hwnd, screen_w / 2 + 3, 6, half_w, full_h));
                }
            }
            "grid" => {
                let count = windows.len().min(4);
                let half_w = screen_w / 2 - 9;
                let half_h = work_h / 2 - 9;
                if count == 1 {
                    let w = (screen_w * 72) / 100;
                    let h = (work_h * 78) / 100;
                    slots.push((windows[0].hwnd, (screen_w - w) / 2, (work_h - h) / 2, w, h));
                } else if count == 2 {
                    let full_h = work_h - 12;
                    slots.push((windows[0].hwnd, 6, 6, half_w, full_h));
                    slots.push((windows[1].hwnd, screen_w / 2 + 3, 6, half_w, full_h));
                } else if count == 3 {
                    slots.push((windows[0].hwnd, 6, 6, half_w, work_h - 12));
                    slots.push((windows[1].hwnd, screen_w / 2 + 3, 6, half_w, half_h));
                    slots.push((windows[2].hwnd, screen_w / 2 + 3, work_h / 2 + 3, half_w, half_h));
                } else {
                    slots.push((windows[0].hwnd, 6, 6, half_w, half_h));
                    slots.push((windows[1].hwnd, screen_w / 2 + 3, 6, half_w, half_h));
                    slots.push((windows[2].hwnd, 6, work_h / 2 + 3, half_w, half_h));
                    slots.push((windows[3].hwnd, screen_w / 2 + 3, work_h / 2 + 3, half_w, half_h));
                }
            }
            "cascade" => {
                let w = ((screen_w * 64) / 100).max(460);
                let h = ((work_h * 68) / 100).max(340);
                for (i, win) in windows.iter().take(5).enumerate() {
                    let idx = i as i32;
                    let x = (36 + idx * 42).min((screen_w - w - 12).max(12));
                    let y = (32 + idx * 36).min((work_h - h - 12).max(12));
                    slots.push((win.hwnd, x, y, w, h));
                }
            }
            "center" => {
                let active_hwnd = get_active_external_hwnd();
                let target_win = windows
                    .iter()
                    .find(|w| w.hwnd == active_hwnd)
                    .unwrap_or(&windows[0]);
                let w = ((screen_w * 70) / 100).max(520);
                let h = ((work_h * 74) / 100).max(400);
                let x = ((screen_w - w) / 2).max(16);
                let y = ((work_h - h) / 2).max(16);
                slots.push((target_win.hwnd, x, y, w, h));
            }
            _ => return Err(format!("Kiểu sắp xếp không hỗ trợ: {layout}")),
        }

        let mut arranged: Vec<WinRect> = Vec::new();
        for (hwnd, x, y, w, h) in slots {
            let target = HWND(hwnd as *mut core::ffi::c_void);
            if !IsWindow(target).as_bool() || !IsWindowVisible(target).as_bool() {
                continue;
            }
            if IsZoomed(target).as_bool() {
                let _ = ShowWindow(target, SW_RESTORE);
            }
            let _ = SetWindowPos(target, None, x, y, w, h, SWP_NOZORDER | SWP_NOACTIVATE);

            let mut updated = RECT::default();
            if GetWindowRect(target, &mut updated).is_ok() {
                let orig = windows.iter().find(|item| item.hwnd == hwnd);
                arranged.push(WinRect {
                    hwnd,
                    title: orig.map(|o| o.title.clone()).unwrap_or_default(),
                    process_name: orig.map(|o| o.process_name.clone()).unwrap_or_default(),
                    x: updated.left.max(0),
                    y: updated.top.max(0),
                    width: updated.right - updated.left,
                    height: updated.bottom - updated.top,
                    is_maximized: IsZoomed(target).as_bool(),
                });
            }
        }

        Ok(arranged)
    }

    #[cfg(not(windows))]
    {
        let _ = layout;
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

