use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::time::Duration;

use crate::backend::mini_screen::encode_base64;
use crate::backend::telemetry::apply_no_window;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UiaElementInfo {
    pub index: usize,
    pub name: String,
    pub control_type: String,
    pub automation_id: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub center_x: i32,
    pub center_y: i32,
    pub value: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SomSnapshotResult {
    pub hwnd: isize,
    pub title: String,
    pub width: i32,
    pub height: i32,
    pub image_base64: String,
    pub elements: Vec<UiaElementInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CdpTabInfo {
    pub id: String,
    pub title: String,
    pub url: String,
    #[serde(default)]
    pub ws_url: String,
}

pub fn parse_hotkey_vkeys(keys: &str) -> Result<(Vec<u16>, u16), String> {
    let parts: Vec<String> = keys
        .split('+')
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| !s.is_empty())
        .collect();
    if parts.is_empty() {
        return Err("Chuỗi phím tắt trống.".to_string());
    }

    let map_key = |k: &str| -> Option<u16> {
        match k {
            "ctrl" | "control" => Some(0x11),
            "shift" => Some(0x10),
            "alt" => Some(0x12),
            "win" | "meta" | "super" => Some(0x5B),
            "enter" | "return" => Some(0x0D),
            "esc" | "escape" => Some(0x1B),
            "tab" => Some(0x09),
            "space" => Some(0x20),
            "backspace" => Some(0x08),
            "delete" | "del" => Some(0x2E),
            "up" => Some(0x26),
            "down" => Some(0x28),
            "left" => Some(0x25),
            "right" => Some(0x27),
            "home" => Some(0x24),
            "end" => Some(0x23),
            "pgup" | "pageup" => Some(0x21),
            "pgdn" | "pagedown" => Some(0x22),
            "f1" => Some(0x70),
            "f2" => Some(0x71),
            "f3" => Some(0x72),
            "f4" => Some(0x73),
            "f5" => Some(0x74),
            "f6" => Some(0x75),
            "f7" => Some(0x76),
            "f8" => Some(0x77),
            "f9" => Some(0x78),
            "f10" => Some(0x79),
            "f11" => Some(0x7A),
            "f12" => Some(0x7B),
            _ if k.len() == 1 => {
                let ch = k.chars().next()?;
                if ch.is_ascii_alphanumeric() {
                    Some(ch.to_ascii_uppercase() as u16)
                } else {
                    None
                }
            }
            _ => None,
        }
    };

    let mut modifiers = Vec::new();
    let mut main_key: Option<u16> = None;
    for (idx, part) in parts.iter().enumerate() {
        let vk = map_key(part).ok_or_else(|| format!("Phím không hợp lệ: '{part}'"))?;
        if idx + 1 < parts.len() {
            modifiers.push(vk);
        } else {
            main_key = Some(vk);
        }
    }
    let final_vk = main_key.ok_or_else(|| "Thiếu phím chính.".to_string())?;
    Ok((modifiers, final_vk))
}

#[cfg(windows)]
fn send_mouse_click_win32(x: i32, y: i32, button: &str, double_click: bool) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
        MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEINPUT,
    };
    use windows::Win32::UI::WindowsAndMessaging::SetCursorPos;

    unsafe {
        let _ = SetCursorPos(x, y);
    }
    std::thread::sleep(Duration::from_millis(25));

    let (down_flag, up_flag) = if button.eq_ignore_ascii_case("right") {
        (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP)
    } else {
        (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP)
    };

    let make_input = |flags| INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    let clicks = if double_click { 2 } else { 1 };
    for _ in 0..clicks {
        let inputs = [make_input(down_flag), make_input(up_flag)];
        unsafe {
            SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
        }
        if double_click {
            std::thread::sleep(Duration::from_millis(45));
        }
    }
    Ok(())
}

#[cfg(windows)]
fn send_unicode_text_win32(text: &str) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
    };

    let utf16: Vec<u16> = text.encode_utf16().collect();
    for code_unit in utf16 {
        let pair = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: Default::default(),
                        wScan: code_unit,
                        dwFlags: KEYEVENTF_UNICODE,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: Default::default(),
                        wScan: code_unit,
                        dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];
        unsafe {
            SendInput(&pair, std::mem::size_of::<INPUT>() as i32);
        }
        std::thread::sleep(Duration::from_millis(6));
    }
    Ok(())
}

#[cfg(windows)]
fn send_hotkey_win32(keys: &str) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VIRTUAL_KEY,
    };

    let (modifiers, main_vk) = parse_hotkey_vkeys(keys)?;
    let make_vk = |vk: u16, up: bool| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(vk),
                wScan: 0,
                dwFlags: if up { KEYEVENTF_KEYUP } else { Default::default() },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    let mut inputs = Vec::new();
    for &m in &modifiers {
        inputs.push(make_vk(m, false));
    }
    inputs.push(make_vk(main_vk, false));
    inputs.push(make_vk(main_vk, true));
    for &m in modifiers.iter().rev() {
        inputs.push(make_vk(m, true));
    }
    unsafe {
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
    Ok(())
}

#[cfg(windows)]
fn send_scroll_win32(delta: i32, x: Option<i32>, y: Option<i32>) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_WHEEL, MOUSEINPUT,
    };
    use windows::Win32::UI::WindowsAndMessaging::SetCursorPos;

    if let (Some(px), Some(py)) = (x, y) {
        unsafe {
            let _ = SetCursorPos(px, py);
        }
    }
    let inp = [INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: (delta * 120) as u32,
                dwFlags: MOUSEEVENTF_WHEEL,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }];
    unsafe {
        SendInput(&inp, std::mem::size_of::<INPUT>() as i32);
    }
    Ok(())
}

#[tauri::command]
pub async fn auto_mouse_click(
    x: i32,
    y: i32,
    button: Option<String>,
    double_click: Option<bool>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            let btn = button.as_deref().unwrap_or("left");
            let dbl = double_click.unwrap_or(false);
            send_mouse_click_win32(x, y, btn, dbl)?;
            Ok(format!("Đã click ({btn}, double={dbl}) tại ({x}, {y})."))
        }
        #[cfg(not(windows))]
        {
            let _ = (x, y, button, double_click);
            Err("Chỉ hỗ trợ Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn auto_type_text(text: String, hwnd: Option<isize>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            let target = resolve_target_hwnd(hwnd);
            if target != 0 {
                let _ = auto_focus_window(target);
                std::thread::sleep(Duration::from_millis(60));
            }
            send_unicode_text_win32(&text)?;
            Ok(format!("Đã gõ {} ký tự.", text.chars().count()))
        }
        #[cfg(not(windows))]
        {
            let _ = (text, hwnd);
            Err("Chỉ hỗ trợ Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn auto_press_hotkey(keys: String, hwnd: Option<isize>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            let target = resolve_target_hwnd(hwnd);
            if target != 0 {
                let _ = auto_focus_window(target);
                std::thread::sleep(Duration::from_millis(60));
            }
            send_hotkey_win32(&keys)?;
            Ok(format!("Đã bấm tổ hợp phím '{keys}'."))
        }
        #[cfg(not(windows))]
        {
            let _ = (keys, hwnd);
            Err("Chỉ hỗ trợ Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn auto_scroll(
    delta: i32,
    x: Option<i32>,
    y: Option<i32>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            send_scroll_win32(delta, x, y)?;
            Ok(format!("Đã cuộn chuột delta={delta}."))
        }
        #[cfg(not(windows))]
        {
            let _ = (delta, x, y);
            Err("Chỉ hỗ trợ Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn resolve_target_hwnd(hwnd: Option<isize>) -> isize {
    #[cfg(windows)]
    {
        if let Some(h) = hwnd {
            return h;
        }
        crate::core::windows::get_active_external_hwnd()
    }
    #[cfg(not(windows))]
    {
        hwnd.unwrap_or(0)
    }
}

pub fn uia_control_type_name(id: i32) -> Option<&'static str> {
    match id {
        50000 => Some("Button"),
        50002 => Some("CheckBox"),
        50003 => Some("ComboBox"),
        50004 => Some("Edit"),
        50005 => Some("Hyperlink"),
        50007 => Some("ListItem"),
        50011 => Some("MenuItem"),
        50013 => Some("RadioButton"),
        50019 => Some("TabItem"),
        50025 => Some("Custom"),
        50030 => Some("Document"),
        _ => None,
    }
}

#[cfg(windows)]
fn collect_native_uia_with_elements(
    hwnd: isize,
    max_elements: usize,
) -> Result<Vec<(UiaElementInfo, windows::Win32::UI::Accessibility::IUIAutomationElement)>, String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
    };
    use windows::Win32::UI::Accessibility::{
        CUIAutomation, IUIAutomation, IUIAutomationValuePattern, TreeScope_Descendants,
        UIA_ValuePatternId,
    };

    if hwnd == 0 {
        return Ok(Vec::new());
    }

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let uia: IUIAutomation = CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| format!("Lỗi khởi tạo IUIAutomation COM: {e}"))?;
        let root = uia
            .ElementFromHandle(HWND(hwnd as *mut _))
            .map_err(|e| format!("ElementFromHandle lỗi: {e}"))?;
        let cond = uia
            .CreateTrueCondition()
            .map_err(|e| format!("CreateTrueCondition lỗi: {e}"))?;
        let arr = root
            .FindAll(TreeScope_Descendants, &cond)
            .map_err(|e| format!("FindAll UIA lỗi: {e}"))?;

        let total = arr.Length().unwrap_or(0);
        let mut results = Vec::new();
        let mut idx = 0usize;

        for i in 0..total {
            if results.len() >= max_elements {
                break;
            }
            let Ok(el) = arr.GetElement(i) else {
                continue;
            };
            if el.CurrentIsOffscreen().map(|b| b.as_bool()).unwrap_or(false) {
                continue;
            }
            let ct_id = el.CurrentControlType().map(|c| c.0).unwrap_or(0);
            let Some(ct_name) = uia_control_type_name(ct_id) else {
                continue;
            };
            let name = el
                .CurrentName()
                .map(|b| b.to_string())
                .unwrap_or_default()
                .trim()
                .to_string();
            if ct_name == "Custom" {
                let focusable = el
                    .CurrentIsKeyboardFocusable()
                    .map(|b| b.as_bool())
                    .unwrap_or(false);
                if name.is_empty() && !focusable {
                    continue;
                }
            }
            let Ok(rect) = el.CurrentBoundingRectangle() else {
                continue;
            };
            let w = rect.right - rect.left;
            let h = rect.bottom - rect.top;
            if w < 4 || h < 4 {
                continue;
            }
            let automation_id = el
                .CurrentAutomationId()
                .map(|b| b.to_string())
                .unwrap_or_default();
            let value = el
                .GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
                .ok()
                .and_then(|vp| vp.CurrentValue().ok())
                .map(|b| b.to_string())
                .unwrap_or_default();

            idx += 1;
            let info = UiaElementInfo {
                index: idx,
                name,
                control_type: ct_name.to_string(),
                automation_id,
                x: rect.left,
                y: rect.top,
                width: w,
                height: h,
                center_x: rect.left + w / 2,
                center_y: rect.top + h / 2,
                value,
            };
            results.push((info, el));
        }
        Ok(results)
    }
}

fn collect_uia_elements_sync(hwnd: isize, max_elements: usize) -> Result<Vec<UiaElementInfo>, String> {
    if hwnd == 0 {
        return Ok(Vec::new());
    }
    #[cfg(windows)]
    {
        let items = collect_native_uia_with_elements(hwnd, max_elements)?;
        Ok(items.into_iter().map(|(info, _)| info).collect())
    }
    #[cfg(not(windows))]
    {
        let _ = (hwnd, max_elements);
        Ok(Vec::new())
    }
}

#[cfg(windows)]
fn find_matching_uia_element(
    hwnd: isize,
    index: Option<usize>,
    name: Option<&str>,
    automation_id: Option<&str>,
) -> Result<(UiaElementInfo, windows::Win32::UI::Accessibility::IUIAutomationElement), String> {
    let items = collect_native_uia_with_elements(hwnd, 80)?;
    if let Some(idx) = index {
        if let Some(found) = items.iter().find(|(info, _)| info.index == idx) {
            return Ok(found.clone());
        }
    }
    if let Some(aid) = automation_id.map(str::trim).filter(|s| !s.is_empty()) {
        let aid_low = aid.to_ascii_lowercase();
        if let Some(found) = items
            .iter()
            .find(|(info, _)| info.automation_id.to_ascii_lowercase() == aid_low)
        {
            return Ok(found.clone());
        }
    }
    if let Some(nm) = name.map(str::trim).filter(|s| !s.is_empty()) {
        let nm_low = nm.to_lowercase();
        if let Some(found) = items
            .iter()
            .find(|(info, _)| info.name.to_lowercase().contains(&nm_low))
        {
            return Ok(found.clone());
        }
    }
    Err("Không tìm thấy UIA element phù hợp trong cửa sổ mục tiêu.".to_string())
}

#[tauri::command]
pub async fn auto_uia_invoke(
    hwnd: Option<isize>,
    index: Option<usize>,
    name: Option<String>,
    automation_id: Option<String>,
) -> Result<String, String> {
    let target = resolve_target_hwnd(hwnd);
    if target == 0 {
        return Err("Không xác định được cửa sổ đang active để Invoke UIA.".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use windows::Win32::UI::Accessibility::{
                IUIAutomationInvokePattern, IUIAutomationSelectionItemPattern, UIA_InvokePatternId,
                UIA_SelectionItemPatternId,
            };
            let (info, el) = find_matching_uia_element(
                target,
                index,
                name.as_deref(),
                automation_id.as_deref(),
            )?;
            unsafe {
                if let Ok(pat) =
                    el.GetCurrentPatternAs::<IUIAutomationInvokePattern>(UIA_InvokePatternId)
                {
                    if pat.Invoke().is_ok() {
                        return Ok(format!(
                            "UIA InvokePattern OK: [{}] {} \"{}\"",
                            info.index, info.control_type, info.name
                        ));
                    }
                }
                if let Ok(pat) = el.GetCurrentPatternAs::<IUIAutomationSelectionItemPattern>(
                    UIA_SelectionItemPatternId,
                ) {
                    if pat.Select().is_ok() {
                        return Ok(format!(
                            "UIA SelectionItemPattern OK: [{}] {} \"{}\"",
                            info.index, info.control_type, info.name
                        ));
                    }
                }
                let _ = el.SetFocus();
            }
            send_mouse_click_win32(info.center_x, info.center_y, "left", false)?;
            Ok(format!(
                "UIA SetFocus+Click OK: [{}] {} \"{}\" ({}, {})",
                info.index, info.control_type, info.name, info.center_x, info.center_y
            ))
        }
        #[cfg(not(windows))]
        {
            let _ = (target, index, name, automation_id);
            Err("Chỉ hỗ trợ Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn auto_uia_set_value(
    hwnd: Option<isize>,
    index: Option<usize>,
    name: Option<String>,
    automation_id: Option<String>,
    value: String,
    press_enter: Option<bool>,
) -> Result<String, String> {
    let target = resolve_target_hwnd(hwnd);
    if target == 0 {
        return Err("Không xác định được cửa sổ đang active để SetValue UIA.".to_string());
    }
    let do_enter = press_enter.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use windows::core::BSTR;
            use windows::Win32::UI::Accessibility::{
                IUIAutomationValuePattern, UIA_ValuePatternId,
            };

            let (info, el) = find_matching_uia_element(
                target,
                index,
                name.as_deref(),
                automation_id.as_deref(),
            )?;
            let mut used_native_pattern = false;
            unsafe {
                let _ = el.SetFocus();
                if let Ok(vp) =
                    el.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
                {
                    let bstr_val = BSTR::from(value.as_str());
                    if vp.SetValue(&bstr_val).is_ok() {
                        used_native_pattern = true;
                    }
                }
            }
            if !used_native_pattern {
                send_mouse_click_win32(info.center_x, info.center_y, "left", false)?;
                std::thread::sleep(Duration::from_millis(80));
                let _ = send_hotkey_win32("ctrl+a");
                std::thread::sleep(Duration::from_millis(40));
                send_unicode_text_win32(&value)?;
            }
            if do_enter {
                std::thread::sleep(Duration::from_millis(120));
                let _ = send_hotkey_win32("enter");
            }
            let mode = if used_native_pattern {
                "ValuePattern.SetValue"
            } else {
                "Focus+UnicodeSendInput"
            };
            Ok(format!(
                "UIA {mode} OK vào [{}] \"{}\" ({} ký tự, enter={do_enter})",
                info.index,
                info.name,
                value.chars().count()
            ))
        }
        #[cfg(not(windows))]
        {
            let _ = (target, index, name, automation_id, value, do_enter);
            Err("Chỉ hỗ trợ Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn auto_uia_snapshot(
    hwnd: Option<isize>,
    max_elements: Option<usize>,
) -> Result<Vec<UiaElementInfo>, String> {
    let target = resolve_target_hwnd(hwnd);
    let cap = max_elements.unwrap_or(45).clamp(5, 80);
    tauri::async_runtime::spawn_blocking(move || collect_uia_elements_sync(target, cap))
        .await
        .map_err(|e| e.to_string())?
}

pub fn draw_som_box_on_bgra(
    bgra: &mut [u8],
    img_w: usize,
    img_h: usize,
    rx: i32,
    ry: i32,
    rw: i32,
    rh: i32,
    label_num: usize,
) {
    let x0 = rx.max(0) as usize;
    let y0 = ry.max(0) as usize;
    let x1 = (rx + rw).min(img_w as i32 - 1).max(0) as usize;
    let y1 = (ry + rh).min(img_h as i32 - 1).max(0) as usize;
    if x1 <= x0 || y1 <= y0 {
        return;
    }

    let put_px = |buf: &mut [u8], px: usize, py: usize, b: u8, g: u8, r: u8| {
        if px < img_w && py < img_h {
            let idx = (py * img_w + px) * 4;
            if idx + 3 < buf.len() {
                buf[idx] = b;
                buf[idx + 1] = g;
                buf[idx + 2] = r;
                buf[idx + 3] = 255;
            }
        }
    };

    // Draw 2px high-contrast border
    for t in 0..2 {
        for x in x0..=x1 {
            put_px(bgra, x, (y0 + t).min(y1), 56, 189, 248);
            put_px(bgra, x, y1.saturating_sub(t), 56, 189, 248);
        }
        for y in y0..=y1 {
            put_px(bgra, (x0 + t).min(x1), y, 56, 189, 248);
            put_px(bgra, x1.saturating_sub(t), y, 56, 189, 248);
        }
    }

    // Draw solid badge background at top-left
    let tag_w = if label_num >= 10 { 22 } else { 16 };
    let tag_h = 14usize;
    for dy in 0..tag_h {
        for dx in 0..tag_w {
            put_px(bgra, x0 + dx, y0 + dy, 15, 23, 220);
        }
    }
}

#[tauri::command]
pub async fn auto_som_snapshot(hwnd: Option<isize>) -> Result<SomSnapshotResult, String> {
    let target = resolve_target_hwnd(hwnd);
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use windows::Win32::Foundation::{HWND, RECT};
            use windows::Win32::Graphics::Gdi::{
                BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
                GetDC, GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER,
                BI_RGB, DIB_RGB_COLORS, SRCCOPY,
            };
            use windows::Win32::UI::WindowsAndMessaging::{GetWindowRect, GetWindowTextW};

            if target == 0 {
                return Err("Không tìm thấy cửa sổ mục tiêu.".to_string());
            }
            let hwnd_win = HWND(target as *mut core::ffi::c_void);
            let mut rect = RECT::default();
            unsafe {
                GetWindowRect(hwnd_win, &mut rect)
                    .map_err(|_| "Không đọc được kích thước cửa sổ.".to_string())?;
            }
            let w = (rect.right - rect.left).max(16);
            let h = (rect.bottom - rect.top).max(16);

            let mut title_buf = [0u16; 256];
            let tlen = unsafe { GetWindowTextW(hwnd_win, &mut title_buf) };
            let title = String::from_utf16_lossy(&title_buf[..tlen as usize]);

            let elements = collect_uia_elements_sync(target, 35).unwrap_or_default();

            let mut bgra = vec![0u8; (w as usize) * (h as usize) * 4];
            unsafe {
                let hdc_screen = GetDC(None);
                let hdc_mem = CreateCompatibleDC(hdc_screen);
                let hbm = CreateCompatibleBitmap(hdc_screen, w, h);
                let old = SelectObject(hdc_mem, hbm);
                let _ = BitBlt(hdc_mem, 0, 0, w, h, hdc_screen, rect.left, rect.top, SRCCOPY);
                let mut bmi = BITMAPINFO {
                    bmiHeader: BITMAPINFOHEADER {
                        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                        biWidth: w,
                        biHeight: -h,
                        biPlanes: 1,
                        biBitCount: 32,
                        biCompression: BI_RGB.0,
                        ..Default::default()
                    },
                    ..Default::default()
                };
                GetDIBits(
                    hdc_mem,
                    hbm,
                    0,
                    h as u32,
                    Some(bgra.as_mut_ptr() as *mut _),
                    &mut bmi,
                    DIB_RGB_COLORS,
                );
                SelectObject(hdc_mem, old);
                let _ = DeleteObject(hbm);
                let _ = DeleteDC(hdc_mem);
                ReleaseDC(None, hdc_screen);
            }

            for el in &elements {
                draw_som_box_on_bgra(
                    &mut bgra,
                    w as usize,
                    h as usize,
                    el.x - rect.left,
                    el.y - rect.top,
                    el.width,
                    el.height,
                    el.index,
                );
            }

            // Encode compact BMP
            let pixel_bytes = bgra.len() as u32;
            let file_size = 54 + pixel_bytes;
            let mut bmp = Vec::with_capacity(file_size as usize);
            bmp.extend_from_slice(b"BM");
            bmp.extend_from_slice(&file_size.to_le_bytes());
            bmp.extend_from_slice(&[0u8; 4]);
            bmp.extend_from_slice(&54u32.to_le_bytes());
            bmp.extend_from_slice(&40u32.to_le_bytes());
            bmp.extend_from_slice(&w.to_le_bytes());
            bmp.extend_from_slice(&(-h).to_le_bytes());
            bmp.extend_from_slice(&1u16.to_le_bytes());
            bmp.extend_from_slice(&32u16.to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes());
            bmp.extend_from_slice(&pixel_bytes.to_le_bytes());
            bmp.extend_from_slice(&[0u8; 16]);
            bmp.extend_from_slice(&bgra);

            Ok(SomSnapshotResult {
                hwnd: target,
                title,
                width: w,
                height: h,
                image_base64: encode_base64(&bmp),
                elements,
            })
        }
        #[cfg(not(windows))]
        {
            Err("Chỉ hỗ trợ Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// =========================================================================
// CHROME DEVTOOLS PROTOCOL (CDP) - Pure Rust HTTP + RFC 6455 WebSocket
// =========================================================================

pub fn encode_ws_client_text_frame(text: &str) -> Vec<u8> {
    let payload = text.as_bytes();
    let len = payload.len();
    let mask = [0x37u8, 0xfa, 0x21, 0x3d];
    let mut frame = Vec::with_capacity(len + 14);
    frame.push(0x81); // FIN + text frame
    if len <= 125 {
        frame.push(0x80 | (len as u8));
    } else if len <= 65535 {
        frame.push(0x80 | 126);
        frame.extend_from_slice(&(len as u16).to_be_bytes());
    } else {
        frame.push(0x80 | 127);
        frame.extend_from_slice(&(len as u64).to_be_bytes());
    }
    frame.extend_from_slice(&mask);
    for (i, b) in payload.iter().enumerate() {
        frame.push(b ^ mask[i % 4]);
    }
    frame
}

pub fn decode_ws_server_frame(buf: &[u8]) -> Option<(u8, String, usize)> {
    if buf.len() < 2 {
        return None;
    }
    let opcode = buf[0] & 0x0f;
    let masked = (buf[1] & 0x80) != 0;
    let mut idx = 2usize;
    let mut payload_len = (buf[1] & 0x7f) as usize;
    if payload_len == 126 {
        if buf.len() < idx + 2 {
            return None;
        }
        payload_len = u16::from_be_bytes([buf[idx], buf[idx + 1]]) as usize;
        idx += 2;
    } else if payload_len == 127 {
        if buf.len() < idx + 8 {
            return None;
        }
        payload_len = u64::from_be_bytes([
            buf[idx],
            buf[idx + 1],
            buf[idx + 2],
            buf[idx + 3],
            buf[idx + 4],
            buf[idx + 5],
            buf[idx + 6],
            buf[idx + 7],
        ]) as usize;
        idx += 8;
    }
    let mask_key = if masked {
        if buf.len() < idx + 4 {
            return None;
        }
        let m = [buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]];
        idx += 4;
        Some(m)
    } else {
        None
    };
    if buf.len() < idx + payload_len {
        return None;
    }
    let mut out = buf[idx..idx + payload_len].to_vec();
    if let Some(m) = mask_key {
        for (i, b) in out.iter_mut().enumerate() {
            *b ^= m[i % 4];
        }
    }
    let text = String::from_utf8_lossy(&out).to_string();
    Some((opcode, text, idx + payload_len))
}

pub fn parse_cdp_tabs_json(raw_json: &str) -> Result<Vec<CdpTabInfo>, String> {
    let arr: Vec<serde_json::Value> =
        serde_json::from_str(raw_json).map_err(|e| format!("JSON CDP không hợp lệ: {e}"))?;
    let mut out = Vec::new();
    for item in arr {
        if item["type"].as_str() != Some("page") {
            continue;
        }
        let id = item["id"].as_str().unwrap_or("").to_string();
        if id.is_empty() {
            continue;
        }
        out.push(CdpTabInfo {
            id,
            title: item["title"].as_str().unwrap_or("").to_string(),
            url: item["url"].as_str().unwrap_or("").to_string(),
            ws_url: item["webSocketDebuggerUrl"].as_str().unwrap_or("").to_string(),
        });
    }
    Ok(out)
}

fn cdp_fetch_tabs_sync(port: u16) -> Result<Vec<CdpTabInfo>, String> {
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    if TcpStream::connect_timeout(&addr, Duration::from_millis(80)).is_err() {
        return Err(format!("Cổng CDP {port} chưa mở."));
    }
    let url = format!("http://127.0.0.1:{port}/json/list");
    let mut cmd = Command::new("curl.exe");
    cmd.args(["-sS", "-m", "2", &url]);
    apply_no_window(&mut cmd);
    let out = cmd
        .output()
        .map_err(|e| format!("Không kiểm tra được Chrome CDP port {port}: {e}"))?;
    let body = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !out.status.success() || body.is_empty() {
        return Err(format!(
            "Không kết nối được Chrome CDP trên cổng {port}. Hãy bấm 'Mở Chrome CDP' hoặc khởi chạy Chrome với --remote-debugging-port={port}."
        ));
    }
    parse_cdp_tabs_json(&body)
}

fn cdp_send_ws_command(port: u16, tab_id: &str, method: &str, params: serde_json::Value) -> Result<serde_json::Value, String> {
    let addr = format!("127.0.0.1:{port}");
    let mut stream = TcpStream::connect(&addr)
        .map_err(|e| format!("Không kết nối được WebSocket CDP ({addr}): {e}"))?;
    let _ = stream.set_read_timeout(Some(Duration::from_secs(8)));
    let path = format!("/devtools/page/{tab_id}");
    let handshake = format!(
        "GET {path} HTTP/1.1\r\nHost: {addr}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n"
    );
    stream
        .write_all(handshake.as_bytes())
        .map_err(|e| format!("Lỗi handshake CDP: {e}"))?;

    let mut raw_buf = Vec::with_capacity(4096);
    let mut tmp = [0u8; 2048];
    let header_end = loop {
        let n = stream
            .read(&mut tmp)
            .map_err(|e| format!("Lỗi đọc handshake CDP: {e}"))?;
        if n == 0 {
            return Err("Chrome CDP đóng kết nối khi handshake.".to_string());
        }
        raw_buf.extend_from_slice(&tmp[..n]);
        if let Some(pos) = raw_buf.windows(4).position(|w| w == b"\r\n\r\n") {
            break pos + 4;
        }
    };
    let hdr_str = String::from_utf8_lossy(&raw_buf[..header_end]);
    if !hdr_str.contains("101") {
        return Err(format!("CDP từ chối WebSocket upgrade: {hdr_str}"));
    }

    let req_id = 1u64;
    let msg = serde_json::json!({
        "id": req_id,
        "method": method,
        "params": params,
    })
    .to_string();
    stream
        .write_all(&encode_ws_client_text_frame(&msg))
        .map_err(|e| format!("Lỗi gửi lệnh CDP: {e}"))?;

    let mut ws_buf = raw_buf[header_end..].to_vec();
    loop {
        while let Some((opcode, text, consumed)) = decode_ws_server_frame(&ws_buf) {
            ws_buf.drain(..consumed);
            if opcode == 8 {
                return Err("Chrome CDP đóng WebSocket.".to_string());
            }
            if opcode == 1 {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                    if v["id"].as_u64() == Some(req_id) {
                        if let Some(err) = v.get("error") {
                            return Err(format!("CDP error: {err}"));
                        }
                        return Ok(v["result"].clone());
                    }
                }
            }
        }
        let n = stream
            .read(&mut tmp)
            .map_err(|e| format!("Timeout/lỗi đọc phản hồi CDP: {e}"))?;
        if n == 0 {
            return Err("Chrome CDP kết thúc luồng.".to_string());
        }
        ws_buf.extend_from_slice(&tmp[..n]);
    }
}

#[tauri::command]
pub async fn cdp_launch_debug_chrome(
    url: Option<String>,
    port: Option<u16>,
) -> Result<String, String> {
    let p = port.unwrap_or(9222);
    let target_url = url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("https://www.google.com")
        .to_string();

    tauri::async_runtime::spawn_blocking(move || {
        let profile_dir = std::env::temp_dir().join("duck_ai_cdp_profile");
        let _ = std::fs::create_dir_all(&profile_dir);
        let candidates = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        ];
        let bin = candidates
            .iter()
            .find(|path| std::path::Path::new(path).exists())
            .ok_or_else(|| "Không tìm thấy Chrome hoặc Edge để mở CDP.".to_string())?;

        let mut cmd = Command::new(bin);
        cmd.args([
            &format!("--remote-debugging-port={p}"),
            &format!("--user-data-dir={}", profile_dir.to_string_lossy()),
            "--no-first-run",
            &target_url,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
        cmd.spawn()
            .map_err(|e| format!("Không khởi chạy được trình duyệt CDP: {e}"))?;
        Ok(format!("Đã mở Chrome/Edge CDP trên cổng {p} -> {target_url}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn cdp_list_tabs(port: Option<u16>) -> Result<Vec<CdpTabInfo>, String> {
    let p = port.unwrap_or(9222);
    tauri::async_runtime::spawn_blocking(move || cdp_fetch_tabs_sync(p))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn cdp_dom_snapshot(
    tab_id: Option<String>,
    port: Option<u16>,
) -> Result<serde_json::Value, String> {
    let p = port.unwrap_or(9222);
    tauri::async_runtime::spawn_blocking(move || {
        let tabs = cdp_fetch_tabs_sync(p)?;
        let tid = tab_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .or_else(|| tabs.first().map(|t| t.id.clone()))
            .ok_or_else(|| "Không có tab Chrome nào đang mở.".to_string())?;

        let js = r#"(() => {
          const cssPath = (el) => {
            if (el.id) return '#' + CSS.escape(el.id);
            const name = el.getAttribute('name');
            if (name) return el.tagName.toLowerCase() + '[name="' + name.replace(/"/g, '\\"') + '"]';
            const aria = el.getAttribute('aria-label');
            if (aria) return el.tagName.toLowerCase() + '[aria-label="' + aria.replace(/"/g, '\\"') + '"]';
            let idx = 1, sib = el.previousElementSibling;
            while (sib) { if (sib.tagName === el.tagName) idx++; sib = sib.previousElementSibling; }
            return el.tagName.toLowerCase() + ':nth-of-type(' + idx + ')';
          };
          const nodes = Array.from(document.querySelectorAll('a,button,input,textarea,select,[role="button"]')).slice(0, 45);
          const elements = nodes.map((el, i) => {
            const r = el.getBoundingClientRect();
            return {
              index: i + 1,
              tag: el.tagName.toLowerCase(),
              type: el.getAttribute('type') || '',
              text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 70),
              value: (el.value !== undefined ? String(el.value) : '').slice(0, 50),
              selector: cssPath(el),
              visible: r.width > 0 && r.height > 0
            };
          }).filter(e => e.visible);
          const tables = Array.from(document.querySelectorAll('table')).slice(0, 3).map(t =>
            Array.from(t.querySelectorAll('tr')).slice(0, 10).map(tr =>
              Array.from(tr.querySelectorAll('th,td')).map(td => td.innerText.trim().slice(0, 60))
            )
          );
          return JSON.stringify({ title: document.title, url: location.href, elements, tables });
        })()"#;

        let res = cdp_send_ws_command(
            p,
            &tid,
            "Runtime.evaluate",
            serde_json::json!({ "expression": js, "returnByValue": true }),
        )?;
        let val_str = res["result"]["value"].as_str().unwrap_or("{}");
        serde_json::from_str::<serde_json::Value>(val_str)
            .map_err(|e| format!("Lỗi parse DOM snapshot: {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn cdp_action(
    tab_id: Option<String>,
    action: String,
    selector: Option<String>,
    value: Option<String>,
    port: Option<u16>,
) -> Result<String, String> {
    let p = port.unwrap_or(9222);
    tauri::async_runtime::spawn_blocking(move || {
        let tabs = cdp_fetch_tabs_sync(p)?;
        let tid = tab_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .or_else(|| tabs.first().map(|t| t.id.clone()))
            .ok_or_else(|| "Không có tab Chrome nào đang mở.".to_string())?;

        let act = action.trim().to_ascii_lowercase();
        let sel_json = serde_json::to_string(selector.as_deref().unwrap_or("")).unwrap_or_default();
        let val_json = serde_json::to_string(value.as_deref().unwrap_or("")).unwrap_or_default();

        if act == "navigate" {
            let nav_url = value.unwrap_or_default();
            let _ = cdp_send_ws_command(
                p,
                &tid,
                "Page.navigate",
                serde_json::json!({ "url": nav_url }),
            )?;
            return Ok(format!("CDP đã điều hướng tab tới {nav_url}"));
        }

        let js = match act.as_str() {
            "click" => format!(
                r#"(() => {{ const el = document.querySelector({sel_json}); if (!el) return 'ERR:Khong tim thay selector'; el.scrollIntoView({{block:'center'}}); el.click(); return 'OK:Clicked ' + {sel_json}; }})()"#
            ),
            "fill" => format!(
                r#"(() => {{ const el = document.querySelector({sel_json}); if (!el) return 'ERR:Khong tim thay selector'; el.focus(); el.value = {val_json}; el.dispatchEvent(new Event('input', {{bubbles:true}})); el.dispatchEvent(new Event('change', {{bubbles:true}})); return 'OK:Filled ' + {sel_json}; }})()"#
            ),
            "extract_table" => r#"(() => { const rows = Array.from(document.querySelectorAll('table tr')).slice(0, 25).map(tr => Array.from(tr.querySelectorAll('th,td')).map(td => td.innerText.trim())); return JSON.stringify(rows); })()"#.to_string(),
            "eval" => value.unwrap_or_else(|| "document.title".to_string()),
            _ => return Err(format!("CDP action '{act}' chưa hỗ trợ (dùng click/fill/navigate/extract_table/eval).")),
        };

        let res = cdp_send_ws_command(
            p,
            &tid,
            "Runtime.evaluate",
            serde_json::json!({ "expression": js, "returnByValue": true }),
        )?;
        let out = res["result"]["value"]
            .as_str()
            .map(|s| s.to_string())
            .unwrap_or_else(|| res["result"]["value"].to_string());
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn is_installer_or_uninstaller_name(name: &str) -> bool {
    let low = name.trim().to_ascii_lowercase();
    low.contains("uninstall")
        || low.contains("unins00")
        || low.contains("setup")
        || low.contains("installer")
        || low.contains("crashpad")
        || low.contains(" crash")
        || low.contains("updater")
}

pub fn resolve_app_exe_fast(query: &str) -> Option<std::path::PathBuf> {
    let q = query.trim().trim_matches('"').trim();
    if q.is_empty() {
        return None;
    }
    let direct = std::path::Path::new(q);
    if direct.is_file() && q.to_ascii_lowercase().ends_with(".exe") {
        return Some(direct.to_path_buf());
    }

    #[cfg(windows)]
    {
        let q_low = q.to_ascii_lowercase();
        let q_stem = q_low.strip_suffix(".exe").unwrap_or(&q_low);

        // Fast direct check: %LOCALAPPDATA%\Programs\<q>\<q>.exe (e.g. Zalo\Zalo.exe)
        if let Ok(local_app) = std::env::var("LOCALAPPDATA") {
            let direct_prog = std::path::PathBuf::from(&local_app)
                .join("Programs")
                .join(q)
                .join(format!("{q_stem}.exe"));
            if direct_prog.is_file() {
                return Some(direct_prog);
            }
        }

        let mut roots: Vec<std::path::PathBuf> = Vec::new();
        if let Ok(local_app) = std::env::var("LOCALAPPDATA") {
            roots.push(std::path::PathBuf::from(local_app).join("Programs"));
        }
        roots.push(std::path::PathBuf::from(r"C:\Program Files"));
        roots.push(std::path::PathBuf::from(r"C:\Program Files (x86)"));

        let mut candidates: Vec<(String, std::path::PathBuf)> = Vec::new();
        for root in roots {
            let Ok(entries) = std::fs::read_dir(&root) else {
                continue;
            };
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    if p.extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.eq_ignore_ascii_case("exe"))
                        .unwrap_or(false)
                    {
                        if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                            if !is_installer_or_uninstaller_name(stem)
                                && stem.to_ascii_lowercase().contains(q_stem)
                            {
                                candidates.push((stem.to_ascii_lowercase(), p));
                            }
                        }
                    }
                } else if p.is_dir() {
                    let Ok(sub_entries) = std::fs::read_dir(&p) else {
                        continue;
                    };
                    for sub in sub_entries.flatten() {
                        let sp = sub.path();
                        if sp.is_file()
                            && sp
                                .extension()
                                .and_then(|e| e.to_str())
                                .map(|e| e.eq_ignore_ascii_case("exe"))
                                .unwrap_or(false)
                        {
                            if let Some(stem) = sp.file_stem().and_then(|s| s.to_str()) {
                                if !is_installer_or_uninstaller_name(stem)
                                    && stem.to_ascii_lowercase().contains(q_stem)
                                {
                                    candidates.push((stem.to_ascii_lowercase(), sp));
                                }
                            }
                        }
                    }
                }
            }
        }

        if let Some((_, exact)) = candidates.iter().find(|(stem, _)| stem == q_stem) {
            return Some(exact.clone());
        }
        if let Some((_, first)) = candidates.first() {
            return Some(first.clone());
        }

        let mut where_cmd = Command::new("where.exe");
        where_cmd.arg(q);
        apply_no_window(&mut where_cmd);
        if let Ok(out) = where_cmd.output() {
            if out.status.success() {
                for line in String::from_utf8_lossy(&out.stdout).lines() {
                    let cand = std::path::PathBuf::from(line.trim());
                    if cand.is_file() {
                        return Some(cand);
                    }
                }
            }
        }
    }

    None
}

pub fn find_open_window_for_query(query: &str) -> Option<crate::core::windows::WinRect> {
    let q_low = query.trim().to_ascii_lowercase();
    let q_stem = q_low.strip_suffix(".exe").unwrap_or(&q_low);
    if q_stem.is_empty() {
        return None;
    }
    crate::core::windows::scan_open_windows()
        .into_iter()
        .find(|w| {
            w.title.to_ascii_lowercase().contains(q_stem)
                || w.process_name.to_ascii_lowercase().contains(q_stem)
        })
}

pub fn wait_and_focus_app_window(
    query: &str,
    max_attempts: usize,
) -> Option<crate::core::windows::WinRect> {
    for _ in 0..max_attempts {
        if let Some(w) = find_open_window_for_query(query) {
            let _ = auto_focus_window(w.hwnd);
            return Some(w);
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    None
}

#[tauri::command]
pub fn auto_focus_window(hwnd: isize) -> Result<String, String> {
    if hwnd == 0 {
        return Err("HWND không hợp lệ (0).".to_string());
    }
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VIRTUAL_KEY,
        };
        use windows::Win32::UI::WindowsAndMessaging::{
            BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId, IsIconic,
            SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
        };
        let handle = HWND(hwnd as *mut _);
        unsafe {
            let fg = GetForegroundWindow();
            let fg_tid = if !fg.0.is_null() {
                GetWindowThreadProcessId(fg, None)
            } else {
                0
            };
            let cur_tid = GetCurrentThreadId();
            let attached = if fg_tid != 0 && fg_tid != cur_tid {
                AttachThreadInput(cur_tid, fg_tid, true).as_bool()
            } else {
                false
            };

            if IsIconic(handle).as_bool() {
                let _ = ShowWindow(handle, SW_RESTORE);
            } else {
                let _ = ShowWindow(handle, SW_SHOW);
            }
            let _ = BringWindowToTop(handle);
            let mut focused = SetForegroundWindow(handle).as_bool();
            if !focused {
                // ALT key trick unlocks Windows foreground-lock when called from background thread
                let alt_inputs = [
                    INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VIRTUAL_KEY(0x12),
                                wScan: 0,
                                dwFlags: Default::default(),
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    },
                    INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: INPUT_0 {
                            ki: KEYBDINPUT {
                                wVk: VIRTUAL_KEY(0x12),
                                wScan: 0,
                                dwFlags: KEYEVENTF_KEYUP,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    },
                ];
                SendInput(&alt_inputs, std::mem::size_of::<INPUT>() as i32);
                focused = SetForegroundWindow(handle).as_bool();
            }
            if attached {
                let _ = AttachThreadInput(cur_tid, fg_tid, false);
            }
            let _ = focused;
        }
        crate::core::windows::set_last_active_hwnd(hwnd);
        Ok(format!("Đã focus cửa sổ hwnd={hwnd}"))
    }
    #[cfg(not(windows))]
    {
        let _ = hwnd;
        Err("Chỉ hỗ trợ Windows".to_string())
    }
}

#[tauri::command]
pub async fn auto_launch_app_with_hooks(
    target: String,
    cdp_port: Option<u16>,
) -> Result<String, String> {
    let raw = target.trim().trim_matches('"').trim().to_string();
    if raw.is_empty() {
        return Err("Tên hoặc đường dẫn ứng dụng trống.".to_string());
    }
    let port = cdp_port.unwrap_or(9223);

    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            if let Some(existing) = find_open_window_for_query(&raw) {
                let _ = auto_focus_window(existing.hwnd);
                if let Ok(tabs) = cdp_fetch_tabs_sync(port) {
                    if !tabs.is_empty() {
                        return Ok(format!(
                            "Ứng dụng {raw} đã mở sẵn: hwnd={} title=\"{}\" + CDP port {port} ({} tab).",
                            existing.hwnd, existing.title, tabs.len()
                        ));
                    }
                }
                return Ok(format!(
                    "Ứng dụng {raw} đã mở sẵn: hwnd={} title=\"{}\" (đã focus để đọc Native UIA COM).",
                    existing.hwnd, existing.title
                ));
            }

            let mut launched_stub = false;
            if let Some(exe_path) = resolve_app_exe_fast(&raw) {
                let file_len = std::fs::metadata(&exe_path).map(|m| m.len()).unwrap_or(0);
                let mut cmd = Command::new(&exe_path);
                if let Some(parent) = exe_path.parent() {
                    cmd.current_dir(parent);
                }
                if file_len >= 3_000_000 {
                    cmd.args([
                        "--force-renderer-accessibility",
                        &format!("--remote-debugging-port={port}"),
                    ]);
                } else {
                    launched_stub = true;
                }
                cmd.stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null());
                cmd.spawn().map_err(|e| {
                    format!("Không khởi chạy được '{}': {e}", exe_path.display())
                })?;
            } else {
                let safe_q = raw.replace('\'', "''");
                let ps_resolve = format!(
                    r#"$ErrorActionPreference='SilentlyContinue'
$q='{safe_q}'
$hitExe = $null
$roots = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:USERPROFILE\Desktop"
)
foreach ($r in $roots) {{
  if (Test-Path $r) {{
    $f = Get-ChildItem -Path $r -Recurse -File -Filter *.lnk | Where-Object {{ $_.BaseName -like "*$q*" -and $_.BaseName -notmatch 'uninstall|setup' }} | Select-Object -First 1
    if ($f) {{
      $sh = New-Object -ComObject WScript.Shell
      $sc = $sh.CreateShortcut($f.FullName)
      if ($sc.TargetPath -and (Test-Path $sc.TargetPath)) {{ $hitExe = $sc.TargetPath; break }}
    }}
  }}
}}
if ($hitExe) {{ Write-Output ("EXE:" + $hitExe); exit 0 }}
$app = Get-StartApps | Where-Object {{ $_.Name -like "*$q*" -and $_.Name -notmatch 'uninstall' }} | Select-Object -First 1
if ($app -and $app.AppID) {{
  Start-Process ("shell:AppsFolder\" + $app.AppID)
  Write-Output ("STARTAPP:" + $app.Name)
  exit 0
}}
Write-Output "NOT_FOUND"
exit 1"#
                );
                let mut ps_cmd = Command::new("powershell.exe");
                ps_cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_resolve]);
                apply_no_window(&mut ps_cmd);
                let out = ps_cmd
                    .output()
                    .map_err(|e| format!("Lỗi dò tìm app '{raw}': {e}"))?;
                let line = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if let Some(exe_path_str) = line.strip_prefix("EXE:") {
                    let exe_pb = std::path::PathBuf::from(exe_path_str.trim());
                    let file_len = std::fs::metadata(&exe_pb).map(|m| m.len()).unwrap_or(0);
                    let mut cmd = Command::new(&exe_pb);
                    if let Some(parent) = exe_pb.parent() {
                        cmd.current_dir(parent);
                    }
                    if file_len >= 3_000_000 {
                        cmd.args([
                            "--force-renderer-accessibility",
                            &format!("--remote-debugging-port={port}"),
                        ]);
                    } else {
                        launched_stub = true;
                    }
                    cmd.stdin(Stdio::null())
                        .stdout(Stdio::null())
                        .stderr(Stdio::null());
                    cmd.spawn()
                        .map_err(|e| format!("Không chạy được '{exe_path_str}': {e}"))?;
                } else if line.starts_with("STARTAPP:") {
                    let win_info = wait_and_focus_app_window(&raw, 12)
                        .map(|w| format!(" hwnd={} title=\"{}\"", w.hwnd, w.title))
                        .unwrap_or_default();
                    return Ok(format!(
                        "Đã mở {raw} qua {line}{win_info} (dùng Native UIA COM để tương tác)."
                    ));
                } else {
                    return Err(format!("Không tìm thấy ứng dụng '{raw}' trên máy để gắn hook."));
                }
            }

            let mut win_opt = wait_and_focus_app_window(&raw, 12);
            if win_opt.is_none() {
                // Fallback cuoi: thử kích hoạt qua Get-StartApps (shell:AppsFolder) nếu .exe stub chưa hiện cửa sổ
                let safe_q = raw.replace('\'', "''");
                let ps_startapp = format!(
                    r#"$ErrorActionPreference='SilentlyContinue'; $app = Get-StartApps | Where-Object {{ $_.Name -like "*{safe_q}*" -and $_.Name -notmatch 'uninstall' }} | Select-Object -First 1; if ($app -and $app.AppID) {{ Start-Process ("shell:AppsFolder\" + $app.AppID); Write-Output $app.AppID }}"#
                );
                let mut sa_cmd = Command::new("powershell.exe");
                sa_cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_startapp]);
                apply_no_window(&mut sa_cmd);
                if let Ok(out) = sa_cmd.output() {
                    if !String::from_utf8_lossy(&out.stdout).trim().is_empty() {
                        win_opt = wait_and_focus_app_window(&raw, 8);
                    }
                }
            }

            let win_info = win_opt
                .as_ref()
                .map(|w| format!(" hwnd={} title=\"{}\"", w.hwnd, w.title))
                .unwrap_or_default();
            if let Ok(tabs) = cdp_fetch_tabs_sync(port) {
                if !tabs.is_empty() {
                    return Ok(format!(
                        "Đã mở {raw}{win_info} với Accessibility + CDP port {port} (có thể chọc thẳng DOM, {} tab).",
                        tabs.len()
                    ));
                }
            }
            if win_opt.is_none() {
                return Err(format!(
                    "Đã khởi chạy '{raw}' nhưng chưa thấy cửa sổ ứng dụng xuất hiện sau 5 giây."
                ));
            }
            if launched_stub {
                Ok(format!(
                    "Đã mở {raw}{win_info} qua launcher chuẩn (dùng Native UIA COM & phím tắt để điều khiển)."
                ))
            } else {
                Ok(format!(
                    "Đã mở {raw}{win_info} với --force-renderer-accessibility (đã mở khóa cây Native UIA COM)."
                ))
            }
        }
        #[cfg(not(windows))]
        {
            let _ = (raw, port);
            Err("Chỉ hỗ trợ Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn auto_com_action(
    app: String,
    action: String,
    target: Option<String>,
    value: Option<String>,
) -> Result<String, String> {
    let app_low = app.trim().to_ascii_lowercase();
    let act_low = action.trim().to_ascii_lowercase();
    let tgt = target.unwrap_or_default().trim().to_string();
    let val = value.unwrap_or_default();

    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            let safe_tgt = tgt.replace('\'', "''");
            let safe_val = val.replace('\'', "''");

            if app_low == "protocol" {
                if tgt.is_empty() || !tgt.contains(':') {
                    return Err("URI protocol không hợp lệ (vd: zalo://, tg://, vscode://, mailto:).".to_string());
                }
                if tgt.chars().any(|c| matches!(c, '\r' | '\n' | '"' | '\'' | '&' | '|' | ';')) {
                    return Err("URI protocol chứa ký tự không an toàn.".to_string());
                }
                let ps = format!("$ErrorActionPreference='Stop'; Start-Process '{safe_tgt}'; Write-Output 'OK:Opened protocol'");
                let mut cmd = Command::new("powershell.exe");
                cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps]);
                apply_no_window(&mut cmd);
                let out = cmd
                    .output()
                    .map_err(|e| format!("Lỗi chạy protocol '{tgt}': {e}"))?;
                if !out.status.success() {
                    return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
                }
                return Ok(format!("Đã mở URI protocol: {tgt}"));
            }

            let ps_script = match (app_low.as_str(), act_low.as_str()) {
                ("excel", "read_sheet") => r#"$ErrorActionPreference='Stop'
$xl = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
$ws = $xl.ActiveSheet
$used = $ws.UsedRange
$rMax = [Math]::Min(30, $used.Rows.Count)
$cMax = [Math]::Min(10, $used.Columns.Count)
$lines = New-Object System.Collections.Generic.List[string]
for ($r = 1; $r -le $rMax; $r++) {
  $cols = @()
  for ($c = 1; $c -le $cMax; $c++) {
    $cols += [string]$used.Cells.Item($r, $c).Text
  }
  $lines.Add(($cols -join "`t"))
}
Write-Output ($lines -join "`n")"#.to_string(),
                ("excel", "write_cell") => {
                    if tgt.is_empty() {
                        return Err("Cần target là địa chỉ ô Excel (vd: 'A1').".to_string());
                    }
                    format!(
                        r#"$ErrorActionPreference='Stop'
$xl = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
$ws = $xl.ActiveSheet
$ws.Range('{safe_tgt}').Value2 = '{safe_val}'
Write-Output ('OK:Excel ' + '{safe_tgt}' + ' = ' + '{safe_val}')"#
                    )
                }
                ("word", "read_doc") => r#"$ErrorActionPreference='Stop'
$wd = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')
$txt = [string]$wd.ActiveDocument.Content.Text
if ($txt.Length -gt 2400) { $txt = $txt.Substring(0, 2400) + '...' }
Write-Output $txt"#.to_string(),
                ("word", "append_text") => format!(
                    r#"$ErrorActionPreference='Stop'
$wd = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')
$rng = $wd.ActiveDocument.Content
$rng.Collapse(0)
$rng.InsertAfter('{safe_val}')
Write-Output 'OK:Word appended text'"#
                ),
                ("outlook", "read_inbox") => r#"$ErrorActionPreference='Stop'
$ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application')
$ns = $ol.GetNamespace('MAPI')
$inbox = $ns.GetDefaultFolder(6)
$items = $inbox.Items
$items.Sort('[ReceivedTime]', $true)
$out = @()
$count = [Math]::Min(5, $items.Count)
for ($i = 1; $i -le $count; $i++) {
  $m = $items.Item($i)
  $out += ('- ' + [string]$m.SenderName + ': ' + [string]$m.Subject)
}
Write-Output ($out -join "`n")"#.to_string(),
                ("outlook", "draft_mail") => format!(
                    r#"$ErrorActionPreference='Stop'
$ol = New-Object -ComObject Outlook.Application
$m = $ol.CreateItem(0)
$m.To = '{safe_tgt}'
$m.Subject = 'Thư soạn từ Duck AI'
$m.Body = '{safe_val}'
$m.Display()
Write-Output ('OK:Outlook draft to ' + '{safe_tgt}')"#
                ),
                ("explorer", "list_folders") => r#"$ErrorActionPreference='Stop'
$sh = New-Object -ComObject Shell.Application
$paths = @()
foreach ($w in $sh.Windows()) {
  try {
    if ($w.Document -and $w.Document.Folder) { $paths += [string]$w.Document.Folder.Self.Path }
  } catch {}
}
if ($paths.Count -eq 0) { Write-Output '(Không có cửa sổ Explorer nào đang mở)' } else { Write-Output ($paths -join "`n") }"#.to_string(),
                ("explorer", "navigate") => {
                    if tgt.is_empty() {
                        return Err("Cần target là đường dẫn thư mục.".to_string());
                    }
                    format!(
                        r#"$ErrorActionPreference='Stop'
$sh = New-Object -ComObject Shell.Application
$wins = @($sh.Windows() | Where-Object {{ $_.Document -and $_.Document.Folder }})
if ($wins.Count -gt 0) {{
  $wins[0].Navigate('{safe_tgt}')
  Write-Output ('OK:Explorer navigated to ' + '{safe_tgt}')
}} else {{
  Start-Process explorer.exe '{safe_tgt}'
  Write-Output ('OK:Opened Explorer at ' + '{safe_tgt}')
}}"#
                    )
                }
                _ => {
                    return Err(format!(
                        "COM/Protocol '{app_low}.{act_low}' chưa hỗ trợ. Dùng excel(read_sheet/write_cell), word(read_doc/append_text), outlook(read_inbox/draft_mail), explorer(list_folders/navigate), protocol."
                    ))
                }
            };

            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
            apply_no_window(&mut cmd);
            let out = cmd
                .output()
                .map_err(|e| format!("Không chạy được COM '{app_low}.{act_low}': {e}"))?;
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            if !out.status.success() {
                return Err(if stderr.is_empty() {
                    format!("COM {app_low}.{act_low} thất bại.")
                } else {
                    format!("COM {app_low}.{act_low} lỗi: {stderr}")
                });
            }
            Ok(stdout)
        }
        #[cfg(not(windows))]
        {
            let _ = (app_low, act_low, tgt, val);
            Err("Chỉ hỗ trợ Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn set_clipboard_unicode_text(text: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("powershell.exe");
        cmd.env("DUCK_CLIP_TEXT", text);
        cmd.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value $env:DUCK_CLIP_TEXT",
        ]);
        apply_no_window(&mut cmd);
        let out = cmd
            .output()
            .map_err(|e| format!("Không ghi được Clipboard: {e}"))?;
        if !out.status.success() {
            return Err(format!(
                "Lỗi Set-Clipboard: {}",
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = text;
        Err("Chỉ hỗ trợ Windows.".to_string())
    }
}

fn ensure_app_window_open_and_focused(app: &str) -> Result<crate::core::windows::WinRect, String> {
    if let Some(existing) = find_open_window_for_query(app) {
        let _ = auto_focus_window(existing.hwnd);
        return Ok(existing);
    }

    if let Some(exe_path) = resolve_app_exe_fast(app) {
        let mut cmd = Command::new(&exe_path);
        if let Some(parent) = exe_path.parent() {
            cmd.current_dir(parent);
        }
        cmd.stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        let _ = cmd.spawn();
        if let Some(win) = wait_and_focus_app_window(app, 10) {
            return Ok(win);
        }
    }

    #[cfg(windows)]
    {
        let safe_q = app.trim().replace('\'', "''");
        let ps = format!(
            r#"$ErrorActionPreference='SilentlyContinue'; $a = Get-StartApps | Where-Object {{ $_.Name -like "*{safe_q}*" -and $_.Name -notmatch 'uninstall' }} | Select-Object -First 1; if ($a -and $a.AppID) {{ Start-Process ("shell:AppsFolder\" + $a.AppID); Write-Output $a.AppID }}"#
        );
        let mut sa = Command::new("powershell.exe");
        sa.args(["-NoProfile", "-NonInteractive", "-Command", &ps]);
        apply_no_window(&mut sa);
        if let Ok(out) = sa.output() {
            if !String::from_utf8_lossy(&out.stdout).trim().is_empty() {
                if let Some(win) = wait_and_focus_app_window(app, 14) {
                    return Ok(win);
                }
            }
        }
    }

    Err(format!(
        "Không mở được cửa sổ ứng dụng '{app}'. Hãy chắc chắn {app} đã cài đặt và đăng nhập."
    ))
}

#[tauri::command]
pub async fn auto_chat_app_send_message(
    app: String,
    contact: String,
    message: String,
) -> Result<String, String> {
    let app_clean = app.trim().to_string();
    let contact_clean = contact.trim().to_string();
    let msg_clean = message.trim().to_string();
    if app_clean.is_empty() || contact_clean.is_empty() || msg_clean.is_empty() {
        return Err("Thiếu tên app, tên người nhận hoặc nội dung tin nhắn.".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            let win = ensure_app_window_open_and_focused(&app_clean)?;
            let _ = auto_focus_window(win.hwnd);
            std::thread::sleep(Duration::from_millis(450));

            // Bước B: Mở ô tìm kiếm (Ctrl+F), xóa cũ và dán tên người nhận bằng Clipboard UTF-16
            let _ = send_hotkey_win32("ctrl+f");
            std::thread::sleep(Duration::from_millis(350));
            let _ = send_hotkey_win32("ctrl+a");
            std::thread::sleep(Duration::from_millis(50));
            let _ = send_hotkey_win32("backspace");
            std::thread::sleep(Duration::from_millis(60));
            set_clipboard_unicode_text(&contact_clean)?;
            let _ = auto_focus_window(win.hwnd);
            std::thread::sleep(Duration::from_millis(80));
            let _ = send_hotkey_win32("ctrl+v");
            std::thread::sleep(Duration::from_millis(1000));

            // Bước C: Tìm kết quả liên hệ qua Native UIA hoặc chọn kết quả đầu tiên
            let contact_low = contact_clean.to_lowercase();
            let mut clicked_via_uia = false;
            if let Ok(items) = collect_native_uia_with_elements(win.hwnd, 60) {
                if let Some((info, _)) = items.iter().find(|(info, _)| {
                    info.y > win.y + 95
                        && matches!(
                            info.control_type.as_str(),
                            "ListItem" | "Button" | "Custom" | "TabItem"
                        )
                        && info.name.to_lowercase().contains(&contact_low)
                }) {
                    let _ = send_mouse_click_win32(info.center_x, info.center_y, "left", false);
                    clicked_via_uia = true;
                }
            }
            if !clicked_via_uia {
                let _ = send_hotkey_win32("enter");
                std::thread::sleep(Duration::from_millis(250));
                let slot_x = win.x + 150.min((win.width / 4).max(80));
                let slot_y = win.y + 165;
                let _ = send_mouse_click_win32(slot_x, slot_y, "left", false);
            }
            std::thread::sleep(Duration::from_millis(750));

            // Bước D: Focus khung soạn tin ở góc dưới bên phải, dán tin nhắn và Enter gửi
            let _ = auto_focus_window(win.hwnd);
            std::thread::sleep(Duration::from_millis(100));
            let input_x = win.x + (win.width * 2) / 3;
            let input_y = win.y + win.height - 55;
            let _ = send_mouse_click_win32(input_x, input_y, "left", false);
            std::thread::sleep(Duration::from_millis(200));

            set_clipboard_unicode_text(&msg_clean)?;
            let _ = auto_focus_window(win.hwnd);
            std::thread::sleep(Duration::from_millis(80));
            let _ = send_hotkey_win32("ctrl+v");
            std::thread::sleep(Duration::from_millis(200));
            let _ = send_hotkey_win32("enter");

            Ok(format!(
                "[AUTO CHAT] Đã mở {app_clean} (hwnd={}), tìm liên hệ \"{contact_clean}\" và gửi tin nhắn \"{msg_clean}\".",
                win.hwnd
            ))
        }
        #[cfg(not(windows))]
        {
            let _ = (app_clean, contact_clean, msg_clean);
            Err("Chỉ hỗ trợ Windows.".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
