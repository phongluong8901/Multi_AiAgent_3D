use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CapturedWindowFrame {
    pub hwnd: isize,
    pub title: String,
    pub process_name: String,
    pub width: u32,
    pub height: u32,
    pub is_minimized: bool,
    pub is_stealth: bool,
    pub bmp_base64: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CapturedWindowBatchItem {
    pub hwnd: isize,
    pub frame: Option<CapturedWindowFrame>,
    pub error: Option<String>,
}

pub fn sanitize_batch_hwnds(hwnds: &[isize]) -> Vec<isize> {
    let mut out = Vec::with_capacity(4);
    for &h in hwnds {
        if h == 0 || out.contains(&h) {
            continue;
        }
        out.push(h);
        if out.len() >= 4 {
            break;
        }
    }
    out
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MiniWindowEntry {
    pub hwnd: isize,
    pub title: String,
    pub process_name: String,
    pub is_minimized: bool,
    pub is_stealth: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MiniWebStatus {
    pub is_open: bool,
    pub url: String,
    pub title: String,
    pub always_on_top: bool,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Debug)]
pub struct SavedStealthWindow {
    pub orig_ex_style: isize,
    pub was_minimized: bool,
}

pub struct MiniScreenState {
    pub stealth_windows: Mutex<HashMap<isize, SavedStealthWindow>>,
}

impl MiniScreenState {
    pub fn new() -> Self {
        Self {
            stealth_windows: Mutex::new(HashMap::new()),
        }
    }

    pub fn is_stealth(&self, hwnd: isize) -> bool {
        self.stealth_windows
            .lock()
            .map(|g| g.contains_key(&hwnd))
            .unwrap_or(false)
    }

    pub fn restore_hwnd(&self, hwnd: isize, focus_after: bool) -> Result<String, String> {
        let saved = self
            .stealth_windows
            .lock()
            .map_err(|e| e.to_string())?
            .remove(&hwnd);

        #[cfg(windows)]
        {
            use windows::Win32::Foundation::{COLORREF, HWND};
            use windows::Win32::UI::WindowsAndMessaging::{
                IsWindow, SetForegroundWindow, SetLayeredWindowAttributes, SetWindowLongPtrW,
                SetWindowPos, ShowWindow, GWL_EXSTYLE, HWND_TOP, LWA_ALPHA, SWP_FRAMECHANGED,
                SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SW_MINIMIZE, SW_RESTORE,
                SW_SHOW,
            };

            let target = HWND(hwnd as *mut std::ffi::c_void);
            unsafe {
                if !IsWindow(target).as_bool() {
                    return Err("Cửa sổ không còn tồn tại.".to_string());
                }
                if let Some(info) = saved {
                    let _ = SetLayeredWindowAttributes(target, COLORREF(0), 255, LWA_ALPHA);
                    SetWindowLongPtrW(target, GWL_EXSTYLE, info.orig_ex_style);
                    let _ = SetWindowPos(
                        target,
                        HWND::default(),
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
                    );
                    if focus_after {
                        let _ = ShowWindow(target, SW_SHOW);
                        let _ = SetWindowPos(target, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
                        let _ = SetForegroundWindow(target);
                    } else if info.was_minimized {
                        let _ = ShowWindow(target, SW_MINIMIZE);
                    }
                    return Ok("Đã khôi phục hiển thị cửa sổ ẩn.".to_string());
                }
                if focus_after {
                    let _ = ShowWindow(target, SW_RESTORE);
                    let _ = SetForegroundWindow(target);
                }
            }
            Ok("Cửa sổ đang ở trạng thái bình thường.".to_string())
        }

        #[cfg(not(windows))]
        {
            let _ = (saved, focus_after);
            Err("Chỉ hỗ trợ trên Windows".to_string())
        }
    }

    pub fn restore_all(&self) -> usize {
        let hwnds: Vec<isize> = match self.stealth_windows.lock() {
            Ok(g) => g.keys().copied().collect(),
            Err(_) => return 0,
        };
        let mut count = 0usize;
        for h in hwnds {
            if self.restore_hwnd(h, false).is_ok() {
                count += 1;
            }
        }
        count
    }
}

impl Drop for MiniScreenState {
    fn drop(&mut self) {
        let _ = self.restore_all();
    }
}

pub const MINI_WEB_LABEL: &str = "duck_mini_web";

pub fn encode_base64(data: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((data.len() + 2) / 3) * 4);
    let mut i = 0;
    while i < data.len() {
        let b0 = data[i];
        let has_b1 = i + 1 < data.len();
        let has_b2 = i + 2 < data.len();
        let b1 = if has_b1 { data[i + 1] } else { 0 };
        let b2 = if has_b2 { data[i + 2] } else { 0 };

        let triple = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);
        out.push(TABLE[((triple >> 18) & 0x3f) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3f) as usize] as char);
        out.push(if has_b1 {
            TABLE[((triple >> 6) & 0x3f) as usize] as char
        } else {
            '='
        });
        out.push(if has_b2 {
            TABLE[(triple & 0x3f) as usize] as char
        } else {
            '='
        });
        i += 3;
    }
    out
}

pub fn build_bgr24_bmp(width: u32, height: u32, bgr_bottom_up: &[u8]) -> Vec<u8> {
    let row_stride = ((width * 3) + 3) & !3;
    let pixel_bytes = (row_stride * height) as usize;
    let file_size = 54 + pixel_bytes;

    let mut bmp = Vec::with_capacity(file_size);
    // BITMAPFILEHEADER (14 bytes)
    bmp.extend_from_slice(b"BM");
    bmp.extend_from_slice(&(file_size as u32).to_le_bytes());
    bmp.extend_from_slice(&0u16.to_le_bytes());
    bmp.extend_from_slice(&0u16.to_le_bytes());
    bmp.extend_from_slice(&54u32.to_le_bytes());

    // BITMAPINFOHEADER (40 bytes)
    bmp.extend_from_slice(&40u32.to_le_bytes());
    bmp.extend_from_slice(&(width as i32).to_le_bytes());
    bmp.extend_from_slice(&(height as i32).to_le_bytes());
    bmp.extend_from_slice(&1u16.to_le_bytes()); // planes
    bmp.extend_from_slice(&24u16.to_le_bytes()); // 24-bit BGR
    bmp.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
    bmp.extend_from_slice(&(pixel_bytes as u32).to_le_bytes());
    bmp.extend_from_slice(&0i32.to_le_bytes());
    bmp.extend_from_slice(&0i32.to_le_bytes());
    bmp.extend_from_slice(&0u32.to_le_bytes());
    bmp.extend_from_slice(&0u32.to_le_bytes());

    if bgr_bottom_up.len() >= pixel_bytes {
        bmp.extend_from_slice(&bgr_bottom_up[..pixel_bytes]);
    } else {
        bmp.extend_from_slice(bgr_bottom_up);
        bmp.resize(file_size, 0);
    }
    bmp
}

fn percent_encode_query(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.as_bytes() {
        match *b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char);
            }
            b' ' => out.push('+'),
            other => {
                out.push_str(&format!("%{:02X}", other));
            }
        }
    }
    out
}

pub fn normalize_mini_screen_url(raw: &str) -> Result<(String, String), String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok((
            "https://www.youtube.com/".to_string(),
            "Duck Mini Screen - YouTube".to_string(),
        ));
    }

    let lower = trimmed.to_ascii_lowercase();
    for bad in ["javascript:", "file:", "data:", "vbscript:", "about:"] {
        if lower.starts_with(bad) {
            return Err(format!("Không cho phép mở giao thức không an toàn '{bad}'."));
        }
    }

    let preset = match lower.as_str() {
        "youtube" | "yt" => Some(("https://www.youtube.com/", "Duck Mini Screen - YouTube")),
        "ytmusic" | "youtube music" | "music" => {
            Some(("https://music.youtube.com/", "Duck Mini Screen - YT Music"))
        }
        "lofi" => Some((
            "https://www.youtube.com/results?search_query=lofi+hip+hop+radio+beats+to+relax+study+to",
            "Duck Mini Screen - Lo-fi Chill",
        )),
        "tiktok" => Some(("https://www.tiktok.com/", "Duck Mini Screen - TikTok")),
        "google" => Some(("https://www.google.com/", "Duck Mini Screen - Google")),
        "chatgpt" => Some(("https://chatgpt.com/", "Duck Mini Screen - ChatGPT")),
        _ => None,
    };
    if let Some((url, title)) = preset {
        return Ok((url.to_string(), title.to_string()));
    }

    if lower.starts_with("http://") || lower.starts_with("https://") {
        let parsed = tauri::Url::parse(trimmed)
            .map_err(|e| format!("URL không hợp lệ: {e}"))?;
        let host = parsed.host_str().unwrap_or("Web");
        return Ok((parsed.to_string(), format!("Duck Mini Screen - {host}")));
    }

    if !trimmed.contains(' ') && trimmed.contains('.') {
        let with_scheme = format!("https://{trimmed}");
        if let Ok(parsed) = tauri::Url::parse(&with_scheme) {
            let host = parsed.host_str().unwrap_or("Web");
            return Ok((parsed.to_string(), format!("Duck Mini Screen - {host}")));
        }
    }

    let encoded = percent_encode_query(trimmed);
    let url = format!("https://www.youtube.com/results?search_query={encoded}");
    let short_q: String = trimmed.chars().take(28).collect();
    Ok((url, format!("Duck Mini Screen - YouTube: {short_q}")))
}

#[cfg(windows)]
#[link(name = "user32")]
unsafe extern "system" {
    fn PrintWindow(
        hwnd: *mut std::ffi::c_void,
        hdc_blt: *mut std::ffi::c_void,
        n_flags: u32,
    ) -> i32;
}

#[cfg(windows)]
fn apply_stealth_hidden_window(state: &MiniScreenState, hwnd: isize) -> Result<String, String> {
    use windows::Win32::Foundation::{COLORREF, HWND};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, IsIconic, IsWindow, SetLayeredWindowAttributes, SetWindowLongPtrW,
        SetWindowPos, ShowWindow, GWL_EXSTYLE, HWND_BOTTOM, LWA_ALPHA, SWP_FRAMECHANGED,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SW_SHOWNOACTIVATE, WS_EX_LAYERED, WS_EX_NOACTIVATE,
        WS_EX_TRANSPARENT,
    };

    let target = HWND(hwnd as *mut std::ffi::c_void);
    unsafe {
        if !IsWindow(target).as_bool() {
            return Err("Cửa sổ không còn tồn tại.".to_string());
        }

        let already_stealth = state.is_stealth(hwnd);
        if !already_stealth {
            let was_minimized = IsIconic(target).as_bool();
            let orig_ex_style = GetWindowLongPtrW(target, GWL_EXSTYLE);
            if let Ok(mut guard) = state.stealth_windows.lock() {
                guard.insert(
                    hwnd,
                    SavedStealthWindow {
                        orig_ex_style,
                        was_minimized,
                    },
                );
            }

            let new_ex = orig_ex_style
                | (WS_EX_LAYERED.0 as isize)
                | (WS_EX_TRANSPARENT.0 as isize)
                | (WS_EX_NOACTIVATE.0 as isize);
            SetWindowLongPtrW(target, GWL_EXSTYLE, new_ex);
            let _ = SetLayeredWindowAttributes(target, COLORREF(0), 1, LWA_ALPHA);

            if was_minimized {
                let _ = ShowWindow(target, SW_SHOWNOACTIVATE);
                // Củng cố lại alpha = 1 phòng trường hợp DWM reset sau restore
                let _ = SetLayeredWindowAttributes(target, COLORREF(0), 1, LWA_ALPHA);
            }

            let _ = SetWindowPos(
                target,
                HWND_BOTTOM,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );
        }
    }
    Ok("Đã chuyển cửa sổ sang chế độ Xem Ẩn (tàng hình nền, vẫn chiếu live).".to_string())
}

#[cfg(not(windows))]
fn apply_stealth_hidden_window(_state: &MiniScreenState, _hwnd: isize) -> Result<String, String> {
    Err("Chỉ hỗ trợ trên Windows".to_string())
}

fn is_mini_list_ignored(title: &str) -> bool {
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

#[tauri::command]
pub fn mini_screen_list_windows(state: tauri::State<'_, MiniScreenState>) -> Vec<MiniWindowEntry> {
    let mut list = Vec::new();
    #[cfg(windows)]
    unsafe {
        use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
        use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetWindowRect, GetWindowTextLengthW, GetWindowTextW, IsIconic,
            IsWindowVisible,
        };

        struct EnumCtx<'a> {
            out: &'a mut Vec<MiniWindowEntry>,
            state: &'a MiniScreenState,
        }

        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            unsafe {
                let ctx = &mut *(lparam.0 as *mut EnumCtx);
                if !IsWindowVisible(hwnd).as_bool() {
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
                if len <= 0 {
                    return BOOL(1);
                }
                let mut buf = vec![0u16; (len + 1) as usize];
                let copied = GetWindowTextW(hwnd, &mut buf);
                let title = String::from_utf16_lossy(&buf[..copied as usize]);
                if is_mini_list_ignored(&title) {
                    return BOOL(1);
                }

                let is_minimized = IsIconic(hwnd).as_bool();
                if !is_minimized {
                    let mut rect = RECT::default();
                    if GetWindowRect(hwnd, &mut rect).is_ok() {
                        let w = rect.right - rect.left;
                        let h = rect.bottom - rect.top;
                        if w < 180 || h < 90 {
                            return BOOL(1);
                        }
                    }
                }

                let hwnd_val = hwnd.0 as isize;
                let process_name = crate::core::windows::get_process_name_by_hwnd(hwnd);
                ctx.out.push(MiniWindowEntry {
                    hwnd: hwnd_val,
                    title,
                    process_name,
                    is_minimized,
                    is_stealth: ctx.state.is_stealth(hwnd_val),
                });
                BOOL(1)
            }
        }

        let mut ctx = EnumCtx {
            out: &mut list,
            state: &state,
        };
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut ctx as *mut _ as isize));
    }
    list
}

#[tauri::command]
pub fn mini_screen_set_stealth(
    state: tauri::State<'_, MiniScreenState>,
    hwnd: isize,
    enabled: bool,
) -> Result<String, String> {
    if hwnd == 0 {
        return Err("Chưa chọn cửa sổ.".to_string());
    }
    if enabled {
        apply_stealth_hidden_window(&state, hwnd)
    } else {
        state.restore_hwnd(hwnd, false)
    }
}

#[tauri::command]
pub fn mini_screen_restore_all_stealth(state: tauri::State<'_, MiniScreenState>) -> usize {
    state.restore_all()
}

#[cfg(windows)]
fn capture_single_window_gdi(
    hwnd: isize,
    cap_max_w: u32,
    is_stealth_now: bool,
) -> Result<CapturedWindowFrame, String> {
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
        ReleaseDC, SelectObject, SetBrushOrgEx, SetStretchBltMode, StretchBlt, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HALFTONE, HGDIOBJ, RGBQUAD, SRCCOPY,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowRect, GetWindowTextLengthW, GetWindowTextW, IsIconic, IsWindow,
    };

    let target = HWND(hwnd as *mut std::ffi::c_void);
    let max_w = cap_max_w.clamp(160, 1280);
    unsafe {
        if !IsWindow(target).as_bool() {
            return Err("Cửa sổ đã đóng hoặc không còn tồn tại.".to_string());
        }

        let tlen = GetWindowTextLengthW(target);
        let title = if tlen > 0 {
            let mut buf = vec![0u16; (tlen + 1) as usize];
            let copied = GetWindowTextW(target, &mut buf);
            String::from_utf16_lossy(&buf[..copied as usize])
        } else {
            format!("Window #{hwnd}")
        };
        let process_name = crate::core::windows::get_process_name_by_hwnd(target);

        if IsIconic(target).as_bool() {
            return Ok(CapturedWindowFrame {
                hwnd,
                title,
                process_name,
                width: 0,
                height: 0,
                is_minimized: true,
                is_stealth: is_stealth_now,
                bmp_base64: String::new(),
            });
        }

        let mut rect = RECT::default();
        if GetWindowRect(target, &mut rect).is_err() {
            return Err("Không đọc được kích thước cửa sổ đích.".to_string());
        }
        let src_w = rect.right - rect.left;
        let src_h = rect.bottom - rect.top;
        if src_w < 32 || src_h < 32 {
            return Err("Cửa sổ đích đang quá nhỏ để chiếu.".to_string());
        }

        let dst_w = max_w.min(src_w as u32).max(120);
        let dst_h = (((dst_w as f64) * (src_h as f64) / (src_w as f64)).round() as u32)
            .clamp(72, 960);

        let screen_dc = GetDC(HWND::default());
        if screen_dc.0.is_null() {
            return Err("Không lấy được Screen DC.".to_string());
        }

        let src_dc = CreateCompatibleDC(screen_dc);
        let src_bmp = CreateCompatibleBitmap(screen_dc, src_w, src_h);
        if src_dc.0.is_null() || src_bmp.0.is_null() {
            if !src_bmp.0.is_null() {
                let _ = DeleteObject(HGDIOBJ(src_bmp.0));
            }
            if !src_dc.0.is_null() {
                let _ = DeleteDC(src_dc);
            }
            let _ = ReleaseDC(HWND::default(), screen_dc);
            return Err("Không khởi tạo được buffer capture GDI.".to_string());
        }
        let old_src = SelectObject(src_dc, HGDIOBJ(src_bmp.0));

        // PW_RENDERFULLCONTENT = 2 (capture hardware-accelerated Chrome/Edge/Electron tabs even when covered or stealth alpha=1)
        let mut pw_ok = PrintWindow(target.0, src_dc.0, 2);
        if pw_ok == 0 {
            pw_ok = PrintWindow(target.0, src_dc.0, 0);
        }
        if pw_ok == 0 {
            SelectObject(src_dc, old_src);
            let _ = DeleteObject(HGDIOBJ(src_bmp.0));
            let _ = DeleteDC(src_dc);
            let _ = ReleaseDC(HWND::default(), screen_dc);
            return Err("Cửa sổ từ chối PrintWindow capture (có thể bị bảo vệ DRM hoặc UIPI).".to_string());
        }

        let dst_dc = CreateCompatibleDC(screen_dc);
        let dst_bmp = CreateCompatibleBitmap(screen_dc, dst_w as i32, dst_h as i32);
        if dst_dc.0.is_null() || dst_bmp.0.is_null() {
            if !dst_bmp.0.is_null() {
                let _ = DeleteObject(HGDIOBJ(dst_bmp.0));
            }
            if !dst_dc.0.is_null() {
                let _ = DeleteDC(dst_dc);
            }
            SelectObject(src_dc, old_src);
            let _ = DeleteObject(HGDIOBJ(src_bmp.0));
            let _ = DeleteDC(src_dc);
            let _ = ReleaseDC(HWND::default(), screen_dc);
            return Err("Không tạo được bitmap scale đích.".to_string());
        }
        let old_dst = SelectObject(dst_dc, HGDIOBJ(dst_bmp.0));

        let _ = SetStretchBltMode(dst_dc, HALFTONE);
        let _ = SetBrushOrgEx(dst_dc, 0, 0, None);
        let _ = StretchBlt(
            dst_dc,
            0,
            0,
            dst_w as i32,
            dst_h as i32,
            src_dc,
            0,
            0,
            src_w,
            src_h,
            SRCCOPY,
        );

        let row_stride = ((dst_w * 3) + 3) & !3;
        let mut pixel_buf = vec![0u8; (row_stride * dst_h) as usize];
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: dst_w as i32,
                biHeight: dst_h as i32,
                biPlanes: 1,
                biBitCount: 24,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default(); 1],
        };

        SelectObject(dst_dc, old_dst);
        let scanlines = GetDIBits(
            dst_dc,
            dst_bmp,
            0,
            dst_h,
            Some(pixel_buf.as_mut_ptr().cast()),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        SelectObject(src_dc, old_src);
        let _ = DeleteObject(HGDIOBJ(dst_bmp.0));
        let _ = DeleteDC(dst_dc);
        let _ = DeleteObject(HGDIOBJ(src_bmp.0));
        let _ = DeleteDC(src_dc);
        let _ = ReleaseDC(HWND::default(), screen_dc);

        if scanlines == 0 {
            return Err("Không đọc được điểm ảnh GetDIBits.".to_string());
        }

        let bmp_bytes = build_bgr24_bmp(dst_w, dst_h, &pixel_buf);
        let bmp_base64 = encode_base64(&bmp_bytes);

        Ok(CapturedWindowFrame {
            hwnd,
            title,
            process_name,
            width: dst_w,
            height: dst_h,
            is_minimized: false,
            is_stealth: is_stealth_now,
            bmp_base64,
        })
    }
}

#[tauri::command]
pub async fn mini_screen_capture_window(
    state: tauri::State<'_, MiniScreenState>,
    hwnd: isize,
    max_width: Option<u32>,
    auto_stealth_minimized: Option<bool>,
) -> Result<CapturedWindowFrame, String> {
    if hwnd == 0 {
        return Err("Chưa chọn cửa sổ nguồn (hwnd = 0).".to_string());
    }

    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{IsIconic, IsWindow};

        let target_check = HWND(hwnd as *mut std::ffi::c_void);
        let was_iconic_before = unsafe {
            IsWindow(target_check).as_bool() && IsIconic(target_check).as_bool()
        };
        if was_iconic_before && auto_stealth_minimized.unwrap_or(false) {
            let _ = apply_stealth_hidden_window(&state, hwnd);
            std::thread::sleep(std::time::Duration::from_millis(38));
        }

        let is_stealth_now = state.is_stealth(hwnd);
        let cap_max_w = max_width.unwrap_or(480).clamp(160, 1280);
        tauri::async_runtime::spawn_blocking(move || {
            capture_single_window_gdi(hwnd, cap_max_w, is_stealth_now)
        })
        .await
        .map_err(|e| format!("Lỗi tác vụ chụp cửa sổ: {e}"))?
    }

    #[cfg(not(windows))]
    {
        let _ = (state, max_width, auto_stealth_minimized);
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

#[tauri::command]
pub async fn mini_screen_capture_windows_batch(
    state: tauri::State<'_, MiniScreenState>,
    hwnds: Vec<isize>,
    max_width: Option<u32>,
    auto_stealth_minimized: Option<bool>,
) -> Result<Vec<CapturedWindowBatchItem>, String> {
    let clean_hwnds = sanitize_batch_hwnds(&hwnds);
    if clean_hwnds.is_empty() {
        return Ok(Vec::new());
    }

    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{IsIconic, IsWindow};

        let do_auto_stealth = auto_stealth_minimized.unwrap_or(false);
        if do_auto_stealth {
            let mut transitioned = false;
            for &h in &clean_hwnds {
                let target = HWND(h as *mut std::ffi::c_void);
                let is_min = unsafe { IsWindow(target).as_bool() && IsIconic(target).as_bool() };
                if is_min && apply_stealth_hidden_window(&state, h).is_ok() {
                    transitioned = true;
                }
            }
            if transitioned {
                std::thread::sleep(std::time::Duration::from_millis(38));
            }
        }

        let items_meta: Vec<(isize, bool)> = clean_hwnds
            .into_iter()
            .map(|h| (h, state.is_stealth(h)))
            .collect();
        let cap_max_w = max_width.unwrap_or(460).clamp(160, 1280);

        tauri::async_runtime::spawn_blocking(move || {
            let mut out = Vec::with_capacity(items_meta.len());
            for (h, stealth_now) in items_meta {
                match capture_single_window_gdi(h, cap_max_w, stealth_now) {
                    Ok(frame) => out.push(CapturedWindowBatchItem {
                        hwnd: h,
                        frame: Some(frame),
                        error: None,
                    }),
                    Err(err) => out.push(CapturedWindowBatchItem {
                        hwnd: h,
                        frame: None,
                        error: Some(err),
                    }),
                }
            }
            out
        })
        .await
        .map_err(|e| format!("Lỗi tác vụ chụp đa cửa sổ: {e}"))
    }

    #[cfg(not(windows))]
    {
        let _ = (state, max_width, auto_stealth_minimized, clean_hwnds);
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

#[tauri::command]
pub fn mini_screen_focus_window(
    state: tauri::State<'_, MiniScreenState>,
    hwnd: isize,
) -> Result<String, String> {
    if hwnd == 0 {
        return Err("Chưa chọn cửa sổ.".to_string());
    }
    state.restore_hwnd(hwnd, true)
}

fn read_mini_web_status(app: &tauri::AppHandle) -> MiniWebStatus {
    if let Some(win) = app.get_webview_window(MINI_WEB_LABEL) {
        let url = win.url().map(|u| u.to_string()).unwrap_or_default();
        let title = win.title().unwrap_or_else(|_| "Duck Mini Screen".to_string());
        let always_on_top = win.is_always_on_top().unwrap_or(true);
        let sf = win.scale_factor().unwrap_or(1.0);
        let (w, h) = win
            .inner_size()
            .map(|sz| (sz.width as f64 / sf, sz.height as f64 / sf))
            .unwrap_or((480.0, 300.0));
        MiniWebStatus {
            is_open: true,
            url,
            title,
            always_on_top,
            width: w.round(),
            height: h.round(),
        }
    } else {
        MiniWebStatus {
            is_open: false,
            url: String::new(),
            title: String::new(),
            always_on_top: true,
            width: 480.0,
            height: 300.0,
        }
    }
}

#[tauri::command]
pub async fn mini_screen_open_web(
    app: tauri::AppHandle,
    target: String,
    width: Option<f64>,
    height: Option<f64>,
    always_on_top: Option<bool>,
) -> Result<MiniWebStatus, String> {
    let (url_str, win_title) = normalize_mini_screen_url(&target)?;
    let parsed_url =
        tauri::Url::parse(&url_str).map_err(|e| format!("Không parse được URL: {e}"))?;
    let w = width.unwrap_or(480.0).clamp(300.0, 1280.0);
    let h = height.unwrap_or(300.0).clamp(190.0, 920.0);
    let pin = always_on_top.unwrap_or(true);

    if let Some(win) = app.get_webview_window(MINI_WEB_LABEL) {
        win.navigate(parsed_url)
            .map_err(|e| format!("Không điều hướng được Mini Web: {e}"))?;
        let _ = win.set_title(&win_title);
        let _ = win.set_always_on_top(pin);
        if width.is_some() || height.is_some() {
            let _ = win.set_size(tauri::LogicalSize::new(w, h));
        }
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(read_mini_web_status(&app));
    }

    let mut builder = tauri::WebviewWindowBuilder::new(
        &app,
        MINI_WEB_LABEL,
        tauri::WebviewUrl::External(parsed_url),
    )
    .title(&win_title)
    .inner_size(w, h)
    .min_inner_size(300.0, 190.0)
    .resizable(true)
    .always_on_top(pin)
    .decorations(true)
    .visible(true);

    if let Ok(Some(mon)) = app.primary_monitor() {
        let sf = mon.scale_factor();
        let mon_w = mon.size().width as f64 / sf;
        let x = (mon_w - w - 26.0).max(20.0);
        builder = builder.position(x, 42.0);
    }

    let win = builder
        .build()
        .map_err(|e| format!("Không tạo được cửa sổ Mini Screen Web: {e}"))?;

    let app_handle = app.clone();
    win.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            let _ = app_handle.emit("duck-mini-web-closed", ());
        }
    });

    Ok(read_mini_web_status(&app))
}

#[tauri::command]
pub async fn mini_screen_control_web(
    app: tauri::AppHandle,
    action: String,
    width: Option<f64>,
    height: Option<f64>,
    always_on_top: Option<bool>,
) -> Result<MiniWebStatus, String> {
    let act = action.trim().to_ascii_lowercase();
    if act == "status" {
        return Ok(read_mini_web_status(&app));
    }

    if let Some(win) = app.get_webview_window(MINI_WEB_LABEL) {
        match act.as_str() {
            "close" => {
                if let Ok(blank) = tauri::Url::parse("about:blank") {
                    let _ = win.navigate(blank);
                }
                if win.destroy().is_err() {
                    let _ = win.close();
                }
                return Ok(MiniWebStatus {
                    is_open: false,
                    url: String::new(),
                    title: String::new(),
                    always_on_top: true,
                    width: 480.0,
                    height: 300.0,
                });
            }
            "resize" => {
                let w = width.unwrap_or(480.0).clamp(300.0, 1280.0);
                let h = height.unwrap_or(300.0).clamp(190.0, 920.0);
                win.set_size(tauri::LogicalSize::new(w, h))
                    .map_err(|e| format!("Không đổi kích thước được Mini Web: {e}"))?;
            }
            "pin" => {
                let next_pin = always_on_top.unwrap_or_else(|| !win.is_always_on_top().unwrap_or(true));
                win.set_always_on_top(next_pin)
                    .map_err(|e| format!("Không đổi Always-on-Top được: {e}"))?;
            }
            "focus" => {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
            other => return Err(format!("Hành động Mini Web không hợp lệ: '{other}'.")),
        }
    }
    Ok(read_mini_web_status(&app))
}
