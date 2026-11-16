use serde::Serialize;
use std::sync::atomic::Ordering;
use std::sync::Arc;

use crate::core::hitbox::{HitboxState, UiRect};
use crate::core::windows::{get_active_external_hwnd, scan_open_windows, WinRect};

#[derive(Serialize, Clone, Debug)]
pub struct DesktopState {
    pub windows: Vec<WinRect>,
    pub active_hwnd: isize,
    pub cursor_x: i32,
    pub cursor_y: i32,
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
pub fn get_desktop_state(state: tauri::State<'_, Arc<HitboxState>>) -> DesktopState {
    DesktopState {
        windows: scan_open_windows(),
        active_hwnd: get_active_external_hwnd(),
        cursor_x: state.cursor_x.load(Ordering::Relaxed),
        cursor_y: state.cursor_y.load(Ordering::Relaxed),
    }
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
                if IsZoomed(target).as_bool() {
                    let _ = ShowWindow(target, SW_RESTORE);
                }
                let mut rect = RECT::default();
                if GetWindowRect(target, &mut rect).is_err() {
                    return Err("Không đọc được kích thước cửa sổ".to_string());
                }
                let w = rect.right - rect.left;
                let mut new_x = rect.left + dx.unwrap_or(0);
                let mut new_y = rect.top + dy.unwrap_or(0);
                new_x = new_x.clamp(-w + 120, screen_w - 120);
                new_y = new_y.clamp(0, screen_h - 100);
                let _ = SetWindowPos(
                    target,
                    None,
                    new_x,
                    new_y,
                    0,
                    0,
                    SWP_NOZORDER | SWP_NOSIZE | SWP_NOACTIVATE,
                );
            }
            "resize_delta" => {
                if IsZoomed(target).as_bool() {
                    let _ = ShowWindow(target, SW_RESTORE);
                }
                let mut rect = RECT::default();
                if GetWindowRect(target, &mut rect).is_err() {
                    return Err("Không đọc được kích thước cửa sổ".to_string());
                }
                let cur_w = rect.right - rect.left;
                let cur_h = rect.bottom - rect.top;
                let delta_w = dx.unwrap_or(0);
                let delta_h = dy.unwrap_or(0);
                let clamped_w = (cur_w + delta_w).clamp(320, screen_w - 40);
                let clamped_h = (cur_h + delta_h).clamp(220, screen_h - 60);
                let new_x = rect.left.clamp(0, (screen_w - clamped_w).max(0));
                let new_y = rect.top.clamp(0, (screen_h - clamped_h).max(0));

                let _ = SetWindowPos(
                    target,
                    None,
                    new_x,
                    new_y,
                    clamped_w,
                    clamped_h,
                    SWP_NOZORDER | SWP_NOACTIVATE,
                );
            }
            "shrink" | "expand" => {
                if IsZoomed(target).as_bool() {
                    let _ = ShowWindow(target, SW_RESTORE);
                }
                let mut rect = RECT::default();
                if GetWindowRect(target, &mut rect).is_err() {
                    return Err("Không đọc được kích thước cửa sổ".to_string());
                }
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

                let _ = SetWindowPos(
                    target,
                    None,
                    new_x,
                    new_y,
                    clamped_w,
                    clamped_h,
                    SWP_NOZORDER | SWP_NOACTIVATE,
                );
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
        Ok(WinRect {
            hwnd,
            title,
            process_name,
            x: updated.left,
            y: updated.top,
            width: updated.right - updated.left,
            height: updated.bottom - updated.top,
        })
    }

    #[cfg(not(windows))]
    {
        let _ = (hwnd, action, dx, dy);
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

