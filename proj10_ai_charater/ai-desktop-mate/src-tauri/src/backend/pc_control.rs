use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

use crate::backend::telemetry::apply_no_window;

#[derive(Serialize, Clone, Debug)]
pub struct OcrResultInfo {
    pub image_path: String,
    pub raw_text: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OcrRegionResult {
    pub image_path: String,
    pub image_base64: String,
    pub raw_text: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Clone, Debug)]
pub struct TranslateResult {
    pub translated_text: String,
    pub detected_lang: String,
    pub engine: String,
}

fn get_screenshots_dir() -> PathBuf {
    let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf());
    let dir = match project_root {
        Some(ref root) if root.exists() => root.join("data").join("screenshots"),
        _ => std::env::temp_dir().join("AI_Desktop_Mate_Screenshots"),
    };
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn capture_screenshot_sync() -> Result<String, String> {
    let dir_str = get_screenshots_dir()
        .to_string_lossy()
        .replace('\'', "''");
    let ps_script = format!(
        r#"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$dir = '{dir_str}'
if (-not (Test-Path $dir)) {{ New-Item -ItemType Directory -Path $dir -Force | Out-Null }}
$file = Join-Path $dir ("shot_" + (Get-Date -Format 'yyyyMMdd_HHmmss') + ".png")
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output $file
"#
    );
    let mut cmd = Command::new("powershell.exe");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
    apply_no_window(&mut cmd);

    let out = cmd
        .output()
        .map_err(|e| format!("Không thể chụp màn hình: {e}"))?;
    if !out.status.success() {
        return Err("Lỗi khi lưu ảnh chụp màn hình".to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[cfg(windows)]
#[link(name = "user32")]
unsafe extern "system" {
    fn keybd_event(b_vk: u8, b_scan: u8, dw_flags: u32, dw_extra_info: usize);
}

#[tauri::command]
pub fn open_web_or_app(target: String) -> Result<String, String> {
    let trimmed = target.trim().trim_matches('"').trim();
    if trimmed.is_empty() {
        return Err("Đường dẫn hoặc tên ứng dụng trống".to_string());
    }

    #[cfg(windows)]
    {
        let lower = trimmed.to_ascii_lowercase();
        let is_uri_or_path = lower.starts_with("http://")
            || lower.starts_with("https://")
            || lower.starts_with("ms-settings:")
            || lower.starts_with("mailto:")
            || lower.starts_with("shell:")
            || std::path::Path::new(trimmed).exists();

        if is_uri_or_path {
            let mut cmd = Command::new("cmd.exe");
            cmd.args(["/C", "start", "", trimmed]);
            apply_no_window(&mut cmd);
            cmd.spawn()
                .map_err(|e| format!("Không thể mở '{trimmed}': {e}"))?;
            return Ok(format!("Đã mở: {trimmed}"));
        }

        // 1. Dùng resolver thuần Rust (cực nhanh, lọc bỏ Uninstall/Setup, ưu tiên <q>.exe)
        // Không truyền flags lạ (tránh Squirrel launcher stub như Zalo.exe tự thoát).
        if let Some(exe_path) = crate::backend::automation_desktop::resolve_app_exe_fast(trimmed) {
            let mut cmd = Command::new(&exe_path);
            if let Some(parent) = exe_path.parent() {
                cmd.current_dir(parent);
            }
            cmd.stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            cmd.spawn()
                .map_err(|e| format!("Không thể mở '{}': {e}", exe_path.display()))?;
            if let Some(w) = crate::backend::automation_desktop::wait_and_focus_app_window(trimmed, 8) {
                return Ok(format!(
                    "Đã mở: {} ({}) hwnd={} title=\"{}\"",
                    trimmed,
                    exe_path.display(),
                    w.hwnd,
                    w.title
                ));
            }
            // Nếu exe là stub không lên cửa sổ sau 2s, tiếp tục fallback sang StartApps/Start Menu bên dưới
        }

        // 2. Tìm qua Get-StartApps hoặc Start Menu / Desktop (.lnk) — không đệ quy LocalAppData\Programs
        let safe_q = trimmed.replace('\'', "''");
        let ps = format!(
            r#"$ErrorActionPreference='SilentlyContinue'
$q='{safe_q}'
$apps = Get-StartApps | Where-Object {{ $_.Name -eq $q -and $_.Name -notmatch 'uninstall' }}
if (-not $apps) {{ $apps = Get-StartApps | Where-Object {{ $_.Name -like "*$q*" -and $_.Name -notmatch 'uninstall' }} }}
$app = $apps | Select-Object -First 1
if ($app -and $app.AppID) {{
  Start-Process ("shell:AppsFolder\" + $app.AppID)
  Write-Output ("STARTAPP:" + $app.Name + " (" + $app.AppID + ")")
  exit 0
}}
$roots = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:USERPROFILE\Desktop"
)
foreach ($r in $roots) {{
  if (Test-Path $r) {{
    $hit = Get-ChildItem -Path $r -Recurse -File -Filter *.lnk | Where-Object {{ $_.BaseName -like "*$q*" -and $_.BaseName -notmatch 'uninstall|setup' }} | Select-Object -First 1
    if ($hit) {{
      Start-Process $hit.FullName
      Write-Output ("FILE:" + $hit.FullName)
      exit 0
    }}
  }}
}}
Write-Output "NOT_FOUND"
exit 1"#
        );
        let mut ps_cmd = Command::new("powershell.exe");
        ps_cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps]);
        apply_no_window(&mut ps_cmd);
        let out = ps_cmd
            .output()
            .map_err(|e| format!("Lỗi tìm ứng dụng '{trimmed}': {e}"))?;
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if out.status.success() && !stdout.is_empty() && stdout != "NOT_FOUND" {
            return Ok(format!("Đã mở '{trimmed}' qua {stdout}"));
        }

        return Err(format!(
            "Không tìm thấy ứng dụng '{trimmed}' trên máy (đã kiểm tra PATH, StartApps, Start Menu, Desktop, Programs)."
        ));
    }

    #[cfg(not(windows))]
    {
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

#[tauri::command]
pub fn open_local_file_or_search(query: String) -> Result<String, String> {
    let raw = query.trim().trim_matches('"').trim_matches('\'').trim();
    if raw.is_empty() {
        return Err("Tên file hoặc đường dẫn trống".to_string());
    }

    #[cfg(windows)]
    {
        // 1. Kiểm tra nếu raw là đường dẫn tồn tại trực tiếp
        let direct_path = std::path::Path::new(raw);
        if direct_path.exists() {
            let full_str = direct_path
                .canonicalize()
                .unwrap_or_else(|_| direct_path.to_path_buf())
                .to_string_lossy()
                .to_string();
            let clean_full = full_str.trim_start_matches(r"\\?\").to_string();
            let mut cmd = Command::new("cmd.exe");
            cmd.args(["/C", "start", "", &clean_full]);
            apply_no_window(&mut cmd);
            cmd.spawn()
                .map_err(|e| format!("Không thể mở file '{clean_full}': {e}"))?;
            return Ok(clean_full);
        }

        // 2. Tìm kiếm trong các thư mục thông dụng:
        let mut search_dirs: Vec<PathBuf> = Vec::new();
        if let Ok(cur) = std::env::current_dir() {
            search_dirs.push(cur.clone());
            if let Some(parent) = cur.parent() {
                search_dirs.push(parent.to_path_buf());
            }
        }
        if let Some(proj_root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
            search_dirs.push(proj_root.to_path_buf());
            if let Some(p2) = proj_root.parent() {
                search_dirs.push(p2.to_path_buf());
            }
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let up = PathBuf::from(userprofile);
            search_dirs.push(up.join("Desktop"));
            search_dirs.push(up.join("Downloads"));
            search_dirs.push(up.join("Documents"));
            search_dirs.push(up);
        }

        let filename = std::path::Path::new(raw)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(raw);

        for dir in search_dirs {
            if !dir.exists() {
                continue;
            }
            let candidate = dir.join(filename);
            if candidate.exists() {
                let full_str = candidate.to_string_lossy().to_string();
                let clean_full = full_str.trim_start_matches(r"\\?\").to_string();
                let mut cmd = Command::new("cmd.exe");
                cmd.args(["/C", "start", "", &clean_full]);
                apply_no_window(&mut cmd);
                cmd.spawn()
                    .map_err(|e| format!("Không thể mở file '{clean_full}': {e}"))?;
                return Ok(clean_full);
            }
        }

        Err(format!(
            "Không tìm thấy file \"{filename}\" trong Desktop, Downloads, Documents hoặc thư mục hiện tại. Hãy cung cấp đường dẫn đầy đủ (ví dụ: D:\\data\\{filename})."
        ))
    }

    #[cfg(not(windows))]
    {
        let _ = raw;
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

#[tauri::command]
pub fn control_media(action: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        const KEYEVENTF_KEYUP: u32 = 0x0002;
        let vk: u8 = match action.as_str() {
            "vol_up" => 0xAF,     // VK_VOLUME_UP
            "vol_down" => 0xAE,   // VK_VOLUME_DOWN
            "mute" => 0xAD,       // VK_VOLUME_MUTE
            "play_pause" => 0xB3, // VK_MEDIA_PLAY_PAUSE
            "next" => 0xB0,       // VK_MEDIA_NEXT_TRACK
            "prev" => 0xB1,       // VK_MEDIA_PREV_TRACK
            _ => return Err(format!("Lệnh media không hợp lệ: {action}")),
        };

        // Nếu tăng/giảm âm lượng thì nhấn 3 nhịp cho rõ rệt (mỗi nhịp = 2% trên Windows)
        let repeats = if action == "vol_up" || action == "vol_down" {
            3
        } else {
            1
        };

        unsafe {
            for _ in 0..repeats {
                keybd_event(vk, 0, 0, 0);
                keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
            }
        }

        let label = match action.as_str() {
            "vol_up" => "Đã tăng âm lượng",
            "vol_down" => "Đã giảm âm lượng",
            "mute" => "Đã bật/tắt tiếng (Mute)",
            "play_pause" => "Đã Phát / Tạm dừng nhạc",
            "next" => "Đã chuyển bài tiếp theo",
            "prev" => "Đã quay lại bài trước",
            _ => "Hoàn tất",
        };
        return Ok(label.to_string());
    }

    #[cfg(not(windows))]
    {
        let _ = action;
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

#[tauri::command]
pub async fn take_screenshot() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(capture_screenshot_sync)
        .await
        .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn capture_and_encode_screenshot() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let shot_path = capture_screenshot_sync()?;
        let ps_code = format!(
            r#"[Convert]::ToBase64String([System.IO.File]::ReadAllBytes('{p}'))"#,
            p = shot_path.replace('\'', "''")
        );
        let mut cmd = Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_code]);
        apply_no_window(&mut cmd);
        let out = cmd.output().map_err(|e| format!("Lỗi encode base64: {e}"))?;
        if !out.status.success() {
            return Err("Không thể encode ảnh base64".to_string());
        }
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn get_clipboard_text() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut cmd = Command::new("powershell.exe");
        cmd.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard -Raw",
        ]);
        apply_no_window(&mut cmd);
        let out = cmd.output().map_err(|e| format!("Không thể đọc clipboard: {e}"))?;
        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
        } else {
            Ok(String::new())
        }
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn set_clipboard_text(text: String) -> Result<String, String> {
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return Err("Nội dung ghi vào Clipboard đang trống".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            let mut cmd = Command::new("powershell.exe");
            cmd.env("DUCK_CLIP_TEXT", &trimmed);
            cmd.args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value $env:DUCK_CLIP_TEXT",
            ]);
            apply_no_window(&mut cmd);
            let out = cmd
                .output()
                .map_err(|e| format!("Không thể ghi clipboard: {e}"))?;
            if !out.status.success() {
                let err = String::from_utf8_lossy(&out.stderr);
                return Err(format!("Lỗi ghi clipboard: {err}"));
            }
            let preview: String = trimmed.chars().take(48).collect();
            let suffix = if trimmed.chars().count() > 48 { "..." } else { "" };
            Ok(format!("Đã sao chép vào Clipboard: \"{preview}{suffix}\""))
        }
        #[cfg(not(windows))]
        {
            Err("Chỉ hỗ trợ Clipboard trên Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn manage_processes(action: String, target: Option<String>) -> Result<String, String> {
    let act = action.trim().to_lowercase();
    let raw_target = target.unwrap_or_default().trim().to_string();
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            if act == "kill" || act == "close" || act == "stop" {
                let cleaned = raw_target
                    .trim_end_matches(".exe")
                    .trim_end_matches(".EXE")
                    .trim()
                    .to_string();
                if cleaned.is_empty() {
                    return Err("Hãy nêu tên ứng dụng/tiến trình cần đóng (ví dụ: chrome, notepad, zalo).".to_string());
                }
                let lower = cleaned.to_lowercase();
                let protected = [
                    "system",
                    "idle",
                    "csrss",
                    "wininit",
                    "winlogon",
                    "services",
                    "lsass",
                    "smss",
                    "svchost",
                    "dwm",
                    "explorer",
                    "audiodg",
                    "registry",
                    "memory compression",
                    "ai-desktop-mate",
                    "duck ai manager",
                    "antigravity",
                    "code",
                    "powershell",
                    "cmd",
                ];
                if protected.iter().any(|p| lower == *p || p.contains(&lower) && lower.len() >= 3 && (lower == "code" || lower == "explorer" || lower == "system" || lower == "svchost")) {
                    return Err(format!("Bảo vệ an toàn: Không thể tự động tắt tiến trình hệ thống/IDE quan trọng '{cleaned}'."));
                }

                let ps_script = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$q = $env:DUCK_PROC_TARGET.ToLower().Trim()
if ($q.Length -lt 2) { Write-Output '{"count":0,"mb":0,"names":""}'; exit 0 }
$aliasMap = @{
  'google chrome' = 'chrome'; 'trình duyệt chrome' = 'chrome';
  'microsoft edge' = 'msedge'; 'edge' = 'msedge';
  'máy tính' = 'CalculatorApp'; 'calculator' = 'CalculatorApp'; 'calc' = 'CalculatorApp';
  'word' = 'WINWORD'; 'excel' = 'EXCEL'; 'powerpoint' = 'POWERPNT';
  'ghi chú' = 'Notepad'; 'notepad' = 'Notepad'; 'zalo' = 'Zalo';
  'spotify' = 'Spotify'; 'discord' = 'Discord'; 'telegram' = 'Telegram';
  'vlc' = 'vlc'; 'steam' = 'steam'; 'unikey' = 'UniKeyNT'
}
if ($aliasMap.ContainsKey($q)) { $q = $aliasMap[$q].ToLower() }
$procs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
  $pn = $_.ProcessName.ToLower()
  $pn -eq $q -or ($q.Length -ge 3 -and $pn -like "*$q*")
})
if ($procs.Count -eq 0) {
  Write-Output '{"count":0,"mb":0,"names":""}'
  exit 0
}
$blocked = @('system','idle','csrss','wininit','winlogon','services','lsass','smss','svchost','dwm','explorer','audiodg','ai-desktop-mate','duck ai manager','antigravity','code','powershell','cmd')
$safeProcs = @($procs | Where-Object { $blocked -notcontains $_.ProcessName.ToLower() })
if ($safeProcs.Count -eq 0) {
  Write-Output '{"count":-1,"mb":0,"names":"protected"}'
  exit 0
}
$totalBytes = ($safeProcs | Measure-Object -Property WorkingSet64 -Sum).Sum
$names = (($safeProcs | Select-Object -ExpandProperty ProcessName -Unique) -join ', ')
$killed = 0
foreach ($p in $safeProcs) {
  try {
    Stop-Process -Id $p.Id -Force -ErrorAction Stop
    $killed++
  } catch {}
}
$mb = [math]::Round(($totalBytes / 1MB), 1)
@{ count = $killed; mb = $mb; names = $names } | ConvertTo-Json -Compress
"#;
                let mut cmd = Command::new("powershell.exe");
                cmd.env("DUCK_PROC_TARGET", &cleaned);
                cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_script]);
                apply_no_window(&mut cmd);
                let out = cmd
                    .output()
                    .map_err(|e| format!("Không thể quản lý tiến trình: {e}"))?;
                let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let v: serde_json::Value = serde_json::from_str(&stdout).unwrap_or_default();
                let count = v["count"].as_i64().unwrap_or(0);
                if count < 0 {
                    return Err(format!("Bảo vệ an toàn: Tiến trình '{cleaned}' nằm trong danh sách được bảo vệ."));
                }
                if count == 0 {
                    return Ok(format!("Không tìm thấy tiến trình nào khớp với \"{cleaned}\" đang chạy."));
                }
                let mb = v["mb"].as_f64().unwrap_or(0.0);
                let names = v["names"].as_str().unwrap_or(&cleaned);
                return Ok(format!("Đã đóng {count} tiến trình [{names}], giải phóng khoảng {mb:.1} MB RAM!"));
            }

            let ps_top = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$top = Get-Process -ErrorAction SilentlyContinue |
  Sort-Object WorkingSet64 -Descending |
  Select-Object -First 5 |
  ForEach-Object {
    @{
      name = [string]$_.ProcessName
      mb = [math]::Round(($_.WorkingSet64 / 1MB), 0)
      pid = [int]$_.Id
    }
  }
$top | ConvertTo-Json -Compress
"#;
            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_top]);
            apply_no_window(&mut cmd);
            let out = cmd
                .output()
                .map_err(|e| format!("Không thể đọc danh sách tiến trình: {e}"))?;
            if !out.status.success() {
                return Err("Lỗi truy vấn danh sách tiến trình Windows".to_string());
            }
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let list: Vec<serde_json::Value> = serde_json::from_str(&stdout).unwrap_or_default();
            if list.is_empty() {
                return Ok("Không đọc được tiến trình nào đang chạy.".to_string());
            }
            let formatted: Vec<String> = list
                .iter()
                .enumerate()
                .map(|(i, item)| {
                    let name = item["name"].as_str().unwrap_or("unknown");
                    let mb = item["mb"].as_i64().unwrap_or(0);
                    format!("{}. {} ({} MB)", i + 1, name, mb)
                })
                .collect();
            Ok(format!("Top 5 tiến trình ngốn RAM nhất: {}", formatted.join(" | ")))
        }
        #[cfg(not(windows))]
        {
            let _ = (act, raw_target);
            Err("Chỉ hỗ trợ quản lý tiến trình trên Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn save_sticky_note_to_desktop(
    content: String,
    title: Option<String>,
) -> Result<String, String> {
    let cleaned = content.trim().to_string();
    if cleaned.is_empty() {
        return Err("Nội dung ghi chú đang trống".to_string());
    }
    let title_str = title.unwrap_or_else(|| "Ghi chú nhanh".to_string());
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use std::io::Write;
            use windows::Win32::System::SystemInformation::GetLocalTime;

            let profile = std::env::var_os("USERPROFILE")
                .map(PathBuf::from)
                .unwrap_or_else(std::env::temp_dir);
            let mut desktop_dir = profile.join("Desktop");
            if !desktop_dir.exists() {
                let one_drive_desktop = profile.join("OneDrive").join("Desktop");
                if one_drive_desktop.exists() {
                    desktop_dir = one_drive_desktop;
                } else {
                    let _ = std::fs::create_dir_all(&desktop_dir);
                }
            }

            let file_path = desktop_dir.join("Duck_AI_Notes.txt");
            let st = unsafe { GetLocalTime() };
            let stamp = format!(
                "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
                st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond
            );
            let entry = format!("[{stamp}] ({title_str})\r\n{cleaned}\r\n----------------------------------------\r\n");

            let mut file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&file_path)
                .map_err(|e| format!("Không thể mở file ghi chú: {e}"))?;
            file.write_all(entry.as_bytes())
                .map_err(|e| format!("Không thể ghi nội dung note: {e}"))?;

            Ok(file_path.to_string_lossy().to_string())
        }
        #[cfg(not(windows))]
        {
            let _ = (cleaned, title_str);
            Err("Chỉ hỗ trợ lưu file Desktop trên Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn ocr_latest_screenshot(take_new: bool) -> Result<OcrResultInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            let dir = get_screenshots_dir();
            let existing = if !take_new {
                std::fs::read_dir(&dir)
                    .ok()
                    .into_iter()
                    .flatten()
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| {
                        p.extension().and_then(|s| s.to_str()) == Some("png")
                    })
                    .max_by_key(|p| {
                        std::fs::metadata(p)
                            .and_then(|m| m.modified())
                            .unwrap_or(std::time::UNIX_EPOCH)
                    })
            } else {
                None
            };

            let img_path = match existing {
                Some(p) => p.to_string_lossy().to_string(),
                None => capture_screenshot_sync()?,
            };
            let img_escaped = img_path.replace('\'', "''");

            let ps_script = format!(
                r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {{ $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }})[0]
function Await($WinRtTask, $ResultType) {{
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}}
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$fs = [System.IO.File]::OpenRead('{img_escaped}')
$stream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($fs)
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $eng) {{
  $firstLang = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Select-Object -First 1
  if ($firstLang) {{ $eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($firstLang) }}
}}
if (-not $eng) {{ throw "Windows OCR Engine không khả dụng" }}
$res = Await ($eng.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$stream.Dispose(); $fs.Dispose()
if ($res.Lines -and $res.Lines.Count -gt 0) {{
  (($res.Lines | ForEach-Object {{ $_.Text }}) -join "`n").Trim()
}} else {{
  Write-Output $res.Text
}}
"#
            );

            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
            apply_no_window(&mut cmd);

            let out = cmd
                .output()
                .map_err(|e| format!("Không thể chạy Windows OCR: {e}"))?;
            if !out.status.success() {
                let err = String::from_utf8_lossy(&out.stderr);
                return Err(format!("Lỗi OCR ảnh: {err}"));
            }

            let raw_text = String::from_utf8_lossy(&out.stdout).trim().to_string();
            Ok(OcrResultInfo {
                image_path: img_path,
                raw_text,
            })
        }
        #[cfg(not(windows))]
        {
            let _ = take_new;
            Err("Chỉ hỗ trợ OCR trên Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn ocr_screen_region(
    x_ratio: f64,
    y_ratio: f64,
    w_ratio: f64,
    h_ratio: f64,
) -> Result<OcrRegionResult, String> {
    let xr = if x_ratio.is_finite() { x_ratio.clamp(0.0, 0.99) } else { 0.0 };
    let yr = if y_ratio.is_finite() { y_ratio.clamp(0.0, 0.99) } else { 0.0 };
    let wr = if w_ratio.is_finite() { w_ratio.clamp(0.005, 1.0) } else { 0.2 };
    let hr = if h_ratio.is_finite() { h_ratio.clamp(0.005, 1.0) } else { 0.2 };

    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            let dir_str = get_screenshots_dir()
                .to_string_lossy()
                .replace('\'', "''");

            let ps_script = format!(
                r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class DuckDpiUtil {{
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}}
"@
$null = [DuckDpiUtil]::SetProcessDPIAware()

$dir = '{dir_str}'
if (-not (Test-Path $dir)) {{ New-Item -ItemType Directory -Path $dir -Force | Out-Null }}
$file = Join-Path $dir ("ocr_snip_" + (Get-Date -Format 'yyyyMMdd_HHmmss_fff') + ".png")

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$rx = $bounds.X + [int][Math]::Round({xr:.6} * $bounds.Width)
$ry = $bounds.Y + [int][Math]::Round({yr:.6} * $bounds.Height)
$rw = [Math]::Max(12, [int][Math]::Min($bounds.X + $bounds.Width - $rx, [Math]::Round({wr:.6} * $bounds.Width)))
$rh = [Math]::Max(12, [int][Math]::Min($bounds.Y + $bounds.Height - $ry, [Math]::Round({hr:.6} * $bounds.Height)))

$bmp = New-Object System.Drawing.Bitmap $rw, $rh
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rx, $ry, 0, 0, (New-Object System.Drawing.Size $rw, $rh))
$bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)

$ocrFile = $file
$tempOcr = ""
if ($rw -lt 420 -or $rh -lt 140) {{
  $uw = $rw * 2
  $uh = $rh * 2
  $up = New-Object System.Drawing.Bitmap $uw, $uh
  $ug = [System.Drawing.Graphics]::FromImage($up)
  $ug.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $ug.DrawImage($bmp, 0, 0, $uw, $uh)
  $tempOcr = Join-Path $env:TEMP ("duck_ocr_up_" + [Guid]::NewGuid().ToString("N") + ".png")
  $up.Save($tempOcr, [System.Drawing.Imaging.ImageFormat]::Png)
  $ug.Dispose()
  $up.Dispose()
  $ocrFile = $tempOcr
}}
$g.Dispose()
$bmp.Dispose()

$b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($file))

$rawText = ""
try {{
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {{ $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }})[0]
  function Await($WinRtTask, $ResultType) {{
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
  }}
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $fs = [System.IO.File]::OpenRead($ocrFile)
  $stream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($fs)
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if (-not $eng) {{
    $firstLang = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Select-Object -First 1
    if ($firstLang) {{ $eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($firstLang) }}
  }}
  if ($eng) {{
    $res = Await ($eng.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    if ($res.Lines -and $res.Lines.Count -gt 0) {{
      $rawText = (($res.Lines | ForEach-Object {{ $_.Text }}) -join "`n").Trim()
    }} else {{
      $rawText = ($res.Text | Out-String).Trim()
    }}
  }}
  $stream.Dispose()
  $fs.Dispose()
}} finally {{
  if ($tempOcr -and (Test-Path $tempOcr)) {{
    Remove-Item $tempOcr -Force -ErrorAction SilentlyContinue
  }}
}}

@{{
  image_path = $file
  image_base64 = $b64
  raw_text = $rawText
  width = $rw
  height = $rh
}} | ConvertTo-Json -Compress
"#
            );

            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
            apply_no_window(&mut cmd);

            let out = cmd
                .output()
                .map_err(|e| format!("Không thể chạy OCR vùng màn hình: {e}"))?;
            if !out.status.success() {
                let err = String::from_utf8_lossy(&out.stderr);
                return Err(format!("Lỗi OCR vùng: {err}"));
            }

            let stdout = String::from_utf8_lossy(&out.stdout);
            let parsed: OcrRegionResult = serde_json::from_str(stdout.trim())
                .map_err(|e| format!("Lỗi đọc kết quả OCR JSON: {e}"))?;
            Ok(parsed)
        }
        #[cfg(not(windows))]
        {
            let _ = (xr, yr, wr, hr);
            Err("Chỉ hỗ trợ OCR vùng màn hình trên Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn translate_text_quick(
    text: String,
    target_lang: String,
) -> Result<TranslateResult, String> {
    let cleaned: String = text.trim().chars().take(3500).collect();
    if cleaned.is_empty() {
        return Err("Văn bản dịch đang trống".to_string());
    }
    let tl = match target_lang.trim().to_lowercase().as_str() {
        "vi" | "vn" => "vi".to_string(),
        "en" => "en".to_string(),
        "ja" | "jp" => "ja".to_string(),
        "ko" | "kr" => "ko".to_string(),
        "zh" | "zh-cn" | "cn" => "zh-CN".to_string(),
        "fr" => "fr".to_string(),
        other if !other.is_empty() && other.len() <= 8 => other.to_string(),
        _ => "vi".to_string(),
    };

    tauri::async_runtime::spawn_blocking(move || {
        let tl_arg = format!("tl={tl}");
        let q_arg = format!("q={cleaned}");

        let mut g_cmd = Command::new("curl.exe");
        g_cmd.args([
            "-s",
            "-m",
            "10",
            "-G",
            "https://translate.googleapis.com/translate_a/single",
            "--data-urlencode",
            "client=gtx",
            "--data-urlencode",
            "sl=auto",
            "--data-urlencode",
            &tl_arg,
            "--data-urlencode",
            "dt=t",
            "--data-urlencode",
            &q_arg,
        ]);
        apply_no_window(&mut g_cmd);

        if let Ok(out) = g_cmd.output() {
            if out.status.success() {
                let raw = String::from_utf8_lossy(&out.stdout);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(raw.trim()) {
                    if let Some(arr) = v[0].as_array() {
                        let mut joined = String::new();
                        for seg in arr {
                            if let Some(piece) = seg[0].as_str() {
                                joined.push_str(piece);
                            }
                        }
                        let final_txt = joined.trim().to_string();
                        if !final_txt.is_empty() {
                            let detected = v[2].as_str().unwrap_or("auto").to_string();
                            return Ok(TranslateResult {
                                translated_text: final_txt,
                                detected_lang: detected,
                                engine: "Google Translate".to_string(),
                            });
                        }
                    }
                }
            }
        }

        let short_mm: String = cleaned.chars().take(480).collect();
        let mm_q = format!("q={short_mm}");
        let mm_pair = format!("langpair=en|{tl}");
        let mut m_cmd = Command::new("curl.exe");
        m_cmd.args([
            "-s",
            "-m",
            "10",
            "-G",
            "https://api.mymemory.translated.net/get",
            "--data-urlencode",
            &mm_q,
            "--data-urlencode",
            &mm_pair,
        ]);
        apply_no_window(&mut m_cmd);

        if let Ok(out) = m_cmd.output() {
            if out.status.success() {
                let raw = String::from_utf8_lossy(&out.stdout);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(raw.trim()) {
                    if let Some(txt) = v["responseData"]["translatedText"].as_str() {
                        let clean_res = txt.trim().to_string();
                        if !clean_res.is_empty() {
                            return Ok(TranslateResult {
                                translated_text: clean_res,
                                detected_lang: "auto".to_string(),
                                engine: "MyMemory".to_string(),
                            });
                        }
                    }
                }
            }
        }

        Err("Không thể kết nối dịch thuật trực tuyến".to_string())
    })
    .await
    .map_err(|e| format!("Lỗi dịch thuật nền: {e}"))?
}

#[tauri::command]
pub fn lock_pc_screen() -> Result<String, String> {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("rundll32.exe");
        cmd.args(["user32.dll,LockWorkStation"]);
        apply_no_window(&mut cmd);
        cmd.spawn()
            .map_err(|e| format!("Không thể khóa màn hình: {e}"))?;
        return Ok("Đã khóa màn hình Windows".to_string());
    }
    #[cfg(not(windows))]
    {
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

#[tauri::command]
pub fn open_latest_screenshot(open_folder: bool) -> Result<String, String> {
    #[cfg(windows)]
    {
        let flag = if open_folder { "1" } else { "0" };
        let dir_str = get_screenshots_dir()
            .to_string_lossy()
            .replace('\'', "''");
        let ps_script = format!(
            r#"
$dir = '{dir_str}'
if (-not (Test-Path $dir)) {{ throw "Chưa có thư mục ảnh chụp" }}
$latest = Get-ChildItem -Path $dir -Filter 'shot_*.png' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latest) {{
  Start-Process explorer.exe $dir
  Write-Output $dir
  exit 0
}}
if ("{flag}" -eq "1") {{
  Start-Process explorer.exe "/select,`"$($latest.FullName)`""
}} else {{
  Invoke-Item $latest.FullName
}}
Write-Output $latest.FullName
"#
        );
        let mut cmd = Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
        apply_no_window(&mut cmd);
        let out = cmd
            .output()
            .map_err(|e| format!("Không thể mở ảnh: {e}"))?;
        if !out.status.success() {
            return Err("Chưa có ảnh chụp màn hình nào trong AI_Desktop_Mate".to_string());
        }
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    }
    #[cfg(not(windows))]
    {
        let _ = open_folder;
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

#[tauri::command]
pub async fn hardware_action(action: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            match action.as_str() {
                "brightness_up" | "brightness_down" => {
                    let delta: i32 = if action == "brightness_up" { 15 } else { -15 };
                    let ps_script = format!(
                        r#"
$cur = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction SilentlyContinue | Select-Object -First 1
$m = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $cur -or -not $m) {{
  Write-Output "UNSUPPORTED"
  exit 0
}}
$next = [Math]::Max(10, [Math]::Min(100, [int]$cur.CurrentBrightness + ({delta})))
$null = Invoke-CimMethod -InputObject $m -MethodName WmiSetBrightness -Arguments @{{ Timeout = 1; Brightness = $next }}
Write-Output $next
"#
                    );
                    let mut cmd = Command::new("powershell.exe");
                    cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
                    apply_no_window(&mut cmd);
                    let out = cmd
                        .output()
                        .map_err(|e| format!("Lỗi chỉnh độ sáng: {e}"))?;
                    let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if res == "UNSUPPORTED" || res.is_empty() {
                        return Ok("Màn hình rời không hỗ trợ WMI độ sáng, bạn hãy chỉnh trực tiếp trên màn hình nhé".to_string());
                    }
                    Ok(format!("Đã chỉnh độ sáng màn hình lên {res}%"))
                }
                "clean_ram" => {
                    let ps_script = r#"
[System.GC]::Collect()
Get-Process | ForEach-Object { try { $_.MinWorkingSet = $_.MinWorkingSet } catch {} }
$os = Get-CimInstance Win32_OperatingSystem
$freeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
Write-Output $freeGb
"#;
                    let mut cmd = Command::new("powershell.exe");
                    cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_script]);
                    apply_no_window(&mut cmd);
                    let out = cmd
                        .output()
                        .map_err(|e| format!("Lỗi dọn RAM: {e}"))?;
                    let free_gb = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    Ok(format!("Đã giải phóng bộ nhớ đệm các tiến trình nền! RAM trống hiện tại: {free_gb} GB"))
                }
                "taskmgr" => {
                    let mut cmd = Command::new("taskmgr.exe");
                    apply_no_window(&mut cmd);
                    cmd.spawn().map_err(|e| format!("Không mở được Task Manager: {e}"))?;
                    Ok("Đã mở Task Manager".to_string())
                }
                _ => Err(format!("Lệnh phần cứng không hỗ trợ: {action}")),
            }
        }
        #[cfg(not(windows))]
        {
            let _ = action;
            Err("Chỉ hỗ trợ trên Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub fn trigger_app_hotkey(hwnd: isize, action: String) -> Result<String, String> {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{IsWindow, SetForegroundWindow};

        const KEYEVENTF_KEYUP: u32 = 0x0002;
        const VK_CONTROL: u8 = 0x11;
        const VK_TAB: u8 = 0x09;
        const VK_NEXT: u8 = 0x22;
        const VK_F5: u8 = 0x74;
        const VK_OEM_3: u8 = 0xC0;

        let target = HWND(hwnd as *mut _);
        if target.0.is_null() || !IsWindow(target).as_bool() {
            return Err("Cửa sổ mục tiêu không còn mở".to_string());
        }

        let _ = SetForegroundWindow(target);
        std::thread::sleep(std::time::Duration::from_millis(60));

        let send_combo = |mod_vk: Option<u8>, key_vk: u8| {
            if let Some(m) = mod_vk {
                keybd_event(m, 0, 0, 0);
            }
            keybd_event(key_vk, 0, 0, 0);
            keybd_event(key_vk, 0, KEYEVENTF_KEYUP, 0);
            if let Some(m) = mod_vk {
                keybd_event(m, 0, KEYEVENTF_KEYUP, 0);
            }
        };

        let label = match action.as_str() {
            "new_tab" => {
                send_combo(Some(VK_CONTROL), b'T');
                "Đã mở Tab mới (Ctrl+T)"
            }
            "next_tab" => {
                send_combo(Some(VK_CONTROL), VK_TAB);
                "Đã chuyển sang Tab tiếp theo (Ctrl+Tab)"
            }
            "vs_terminal" => {
                send_combo(Some(VK_CONTROL), VK_OEM_3);
                "Đã bật/tắt Terminal trong VS Code (Ctrl+`)"
            }
            "scroll_down" => {
                send_combo(None, VK_NEXT);
                "Đã cuộn xuống một trang (PageDown)"
            }
            "refresh" => {
                send_combo(None, VK_F5);
                "Đã làm mới khung hiện tại (F5)"
            }
            _ => return Err(format!("Thao tác khung không hỗ trợ: {action}")),
        };
        Ok(label.to_string())
    }
    #[cfg(not(windows))]
    {
        let _ = (hwnd, action);
        Err("Chỉ hỗ trợ trên Windows".to_string())
    }
}

#[tauri::command]
pub async fn deep_system_control(action: String, param: Option<String>) -> Result<String, String> {
    let act = action.trim().to_lowercase();
    let param_str = param.unwrap_or_default().trim().to_string();
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            match act.as_str() {
                "empty_recycle_bin" | "clean_bin" | "clear_recycle_bin" => {
                    let ps_script = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$shell = New-Object -ComObject Shell.Application
$bin = $shell.NameSpace(10)
$cnt = $bin.Items().Count
if ($cnt -eq 0) { Write-Output "EMPTY"; exit 0 }
Clear-RecycleBin -Force -ErrorAction SilentlyContinue
Write-Output $cnt
"#;
                    let mut cmd = Command::new("powershell.exe");
                    cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_script]);
                    apply_no_window(&mut cmd);
                    let out = cmd
                        .output()
                        .map_err(|e| format!("Lỗi dọn Thùng Rác: {e}"))?;
                    let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if res == "EMPTY" {
                        return Ok("Thùng Rác Windows hiện đang trống sẵn!".to_string());
                    }
                    Ok(format!("Đã dọn sạch {res} mục trong Thùng Rác Windows!"))
                }
                "kill_unresponsive" | "kill_hung" => {
                    let ps_script = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$blocked = @('system','idle','csrss','wininit','winlogon','services','lsass','smss','svchost','dwm','explorer','audiodg','ai-desktop-mate','duck ai manager','antigravity','code','powershell','cmd')
$hung = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
  $_.MainWindowHandle -ne 0 -and (-not $_.Responding) -and ($blocked -notcontains $_.ProcessName.ToLower())
})
if ($hung.Count -eq 0) { Write-Output "NONE"; exit 0 }
$names = (($hung | Select-Object -ExpandProperty ProcessName -Unique) -join ', ')
$killed = 0
foreach ($p in $hung) {
  try { Stop-Process -Id $p.Id -Force -ErrorAction Stop; $killed++ } catch {}
}
Write-Output "$killed|$names"
"#;
                    let mut cmd = Command::new("powershell.exe");
                    cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_script]);
                    apply_no_window(&mut cmd);
                    let out = cmd
                        .output()
                        .map_err(|e| format!("Lỗi quét tiến trình treo: {e}"))?;
                    let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if res == "NONE" || res.is_empty() {
                        return Ok("Tuyệt vời, hiện không có ứng dụng nào bị treo (Not Responding)!".to_string());
                    }
                    let mut parts = res.splitn(2, '|');
                    let cnt = parts.next().unwrap_or("0");
                    let names = parts.next().unwrap_or("");
                    Ok(format!("Đã đóng khẩn cấp {cnt} ứng dụng bị treo [{names}]!"))
                }
                "flush_dns" => {
                    let mut cmd = Command::new("ipconfig.exe");
                    cmd.args(["/flushdns"]);
                    apply_no_window(&mut cmd);
                    let out = cmd
                        .output()
                        .map_err(|e| format!("Không thể chạy ipconfig /flushdns: {e}"))?;
                    if out.status.success() {
                        Ok("Đã làm mới (Flush) bộ nhớ đệm DNS Windows giúp kết nối mạng mượt hơn!".to_string())
                    } else {
                        Err("Không thể flush DNS (kiểm tra quyền hệ thống).".to_string())
                    }
                }
                "power_high" | "power_balanced" | "power_saver" => {
                    let (label, ps_script) = if act == "power_high" {
                        (
                            "Hiệu năng cao (High Performance)",
                            r#"
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
if ($LASTEXITCODE -ne 0) {
  $line = powercfg /list | Select-String -Pattern 'High|Ultimate|Hiệu' | Select-Object -First 1
  if ($line -match '([a-fA-F0-9\-]{36})') { powercfg /setactive $matches[1] | Out-Null }
}
"#,
                        )
                    } else if act == "power_saver" {
                        (
                            "Tiết kiệm pin (Power Saver)",
                            r#"
powercfg /setactive a1841308-3541-4fab-bc81-f71556f20b4a 2>$null
if ($LASTEXITCODE -ne 0) {
  $line = powercfg /list | Select-String -Pattern 'Saver|Tiết kiệm' | Select-Object -First 1
  if ($line -match '([a-fA-F0-9\-]{36})') { powercfg /setactive $matches[1] | Out-Null }
}
"#,
                        )
                    } else {
                        (
                            "Cân bằng (Balanced)",
                            "powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>$null",
                        )
                    };
                    let mut cmd = Command::new("powershell.exe");
                    cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_script]);
                    apply_no_window(&mut cmd);
                    let _ = cmd.output();
                    Ok(format!("Đã chuyển chế độ nguồn Windows sang: {label}!"))
                }
                "shutdown_timer" => {
                    let mins: u64 = param_str.parse::<u64>().unwrap_or(30).clamp(1, 720);
                    let secs = mins * 60;
                    let mut cmd = Command::new("shutdown.exe");
                    cmd.args(["/s", "/t", &secs.to_string()]);
                    apply_no_window(&mut cmd);
                    let out = cmd
                        .output()
                        .map_err(|e| format!("Không thể hẹn tắt máy: {e}"))?;
                    if out.status.success() {
                        Ok(format!("Đã hẹn giờ tắt máy Windows sau {mins} phút! (Nhắn 'hủy tắt máy' để hủy)"))
                    } else {
                        Err("Không thể đặt lịch tắt máy (có thể đã có lịch tắt máy đang chờ; hãy 'hủy tắt máy' trước).".to_string())
                    }
                }
                "cancel_shutdown" => {
                    let mut cmd = Command::new("shutdown.exe");
                    cmd.args(["/a"]);
                    apply_no_window(&mut cmd);
                    let out = cmd
                        .output()
                        .map_err(|e| format!("Không thể hủy lệnh tắt máy: {e}"))?;
                    if out.status.success() {
                        Ok("Đã hủy lịch tắt máy tự động thành công!".to_string())
                    } else {
                        Ok("Hiện không có lịch tắt máy nào đang chạy.".to_string())
                    }
                }
                "open_panel" => {
                    let key = param_str.to_lowercase();
                    let (target, label) = match key.as_str() {
                        "services" => ("services.msc", "Services"),
                        "devmgmt" | "device" => ("devmgmt.msc", "Device Manager"),
                        "diskmgmt" | "disk" => ("diskmgmt.msc", "Disk Management"),
                        "resmon" | "resource" => ("resmon.exe", "Resource Monitor"),
                        "taskmgr" => ("taskmgr.exe", "Task Manager"),
                        "sound" | "audio" => ("ms-settings:sound", "Sound Settings"),
                        "bluetooth" | "bt" => ("ms-settings:bluetooth", "Bluetooth Settings"),
                        "display" | "screen" => ("ms-settings:display", "Display Settings"),
                        "startup" | "apps" => ("ms-settings:startupapps", "Startup Apps"),
                        "update" | "windowsupdate" => ("ms-settings:windowsupdate", "Windows Update"),
                        "wifi" | "network" => ("ms-settings:network-wifi", "Network & WiFi"),
                        _ => ("control", "Control Panel"),
                    };
                    let mut cmd = Command::new("cmd.exe");
                    cmd.args(["/C", "start", "", target]);
                    apply_no_window(&mut cmd);
                    cmd.spawn()
                        .map_err(|e| format!("Không mở được bảng {label}: {e}"))?;
                    Ok(format!("Đã mở trình quản lý hệ thống: {label}!"))
                }
                _ => Err(format!("Lệnh điều khiển hệ thống chưa hỗ trợ: {act}")),
            }
        }
        #[cfg(not(windows))]
        {
            let _ = (act, param_str);
            Err("Chỉ hỗ trợ điều khiển hệ thống trên Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn manage_ports(action: String, port: Option<u16>) -> Result<String, String> {
    let act = action.trim().to_lowercase();
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            if act == "kill" {
                let target_port = port.ok_or_else(|| "Hãy cung cấp số Port cần giải phóng (ví dụ 3000, 5173, 8080).".to_string())?;
                if target_port == 0 {
                    return Err("Số Port không hợp lệ".to_string());
                }
                let ps_script = format!(
                    r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$conns = @(Get-NetTCPConnection -LocalPort {target_port} -ErrorAction SilentlyContinue | Where-Object {{ $_.OwningProcess -gt 4 }})
$pids = @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
if ($pids.Count -eq 0) {{ Write-Output "EMPTY"; exit 0 }}
$blocked = @('system','idle','csrss','wininit','winlogon','services','lsass','smss','svchost','dwm','explorer','ai-desktop-mate','duck ai manager','antigravity','code')
$killed = @()
foreach ($pId in $pids) {{
  $proc = Get-Process -Id $pId -ErrorAction SilentlyContinue
  if ($proc -and ($blocked -notcontains $proc.ProcessName.ToLower())) {{
    try {{
      Stop-Process -Id $pId -Force -ErrorAction Stop
      $killed += "$($proc.ProcessName) (PID $pId)"
    }} catch {{}}
  }}
}}
if ($killed.Count -eq 0) {{ Write-Output "PROTECTED"; exit 0 }}
Write-Output ($killed -join ', ')
"#
                );
                let mut cmd = Command::new("powershell.exe");
                cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
                apply_no_window(&mut cmd);
                let out = cmd.output().map_err(|e| format!("Lỗi giải phóng port: {e}"))?;
                let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if res == "EMPTY" || res.is_empty() {
                    return Ok(format!("Hiện không có tiến trình nào đang chiếm Port {target_port}."));
                }
                if res == "PROTECTED" {
                    return Err(format!("Tiến trình đang giữ Port {target_port} nằm trong danh sách bảo vệ an toàn."));
                }
                return Ok(format!("Đã giải phóng Port {target_port}! Đã đóng: {res}."));
            }

            let ps_list = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$devPorts = @(3000,3001,3306,4000,4200,5000,5173,5432,6379,8000,8080,8443,8888,9000,11434,1420,27017)
$rows = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess -gt 4 } |
  Sort-Object @{Expression={ $devPorts -contains $_.LocalPort }; Descending=$true}, LocalPort |
  Group-Object LocalPort |
  Select-Object -First 10
$out = @()
foreach ($g in $rows) {
  $first = $g.Group | Select-Object -First 1
  $proc = Get-Process -Id $first.OwningProcess -ErrorAction SilentlyContinue
  $pname = if ($proc) { $proc.ProcessName } else { "PID:$($first.OwningProcess)" }
  $out += ":$($first.LocalPort) ($pname)"
}
Write-Output ($out -join ' | ')
"#;
            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_list]);
            apply_no_window(&mut cmd);
            let out = cmd.output().map_err(|e| format!("Không quét được Port: {e}"))?;
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if res.is_empty() {
                return Ok("Không phát hiện Port localhost nào đang mở Listen.".to_string());
            }
            Ok(format!("Các Port đang mở Listen: {res}"))
        }
        #[cfg(not(windows))]
        {
            let _ = (act, port);
            Err("Chỉ hỗ trợ trên Windows".to_string())
        }
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn check_git_status(path: Option<String>) -> Result<String, String> {
    let target_dir = path
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .and_then(|p| p.parent())
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")))
        });

    tauri::async_runtime::spawn_blocking(move || {
        let mut status_cmd = Command::new("git");
        status_cmd.current_dir(&target_dir);
        status_cmd.args(["status", "-sb"]);
        apply_no_window(&mut status_cmd);
        let status_out = status_cmd
            .output()
            .map_err(|e| format!("Không chạy được git (kiểm tra đã cài git chưa): {e}"))?;

        if !status_out.status.success() {
            let err = String::from_utf8_lossy(&status_out.stderr);
            return Err(format!("Thư mục '{}' không phải Git repo: {}", target_dir.display(), err.trim()));
        }

        let status_text = String::from_utf8_lossy(&status_out.stdout);
        let mut lines = status_text.lines();
        let branch_line = lines.next().unwrap_or("branch unknown").trim_start_matches("## ").trim();
        let changed: Vec<&str> = lines.map(|l| l.trim()).filter(|l| !l.is_empty()).collect();

        let mut log_cmd = Command::new("git");
        log_cmd.current_dir(&target_dir);
        log_cmd.args(["log", "-1", "--oneline"]);
        apply_no_window(&mut log_cmd);
        let last_commit = log_cmd
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Chưa có commit".to_string());

        let changes_desc = if changed.is_empty() {
            "Working tree sạch (không có thay đổi chưa commit)".to_string()
        } else {
            let preview: Vec<&str> = changed.iter().copied().take(5).collect();
            format!(
                "{} file thay đổi: {}{}",
                changed.len(),
                preview.join(", "),
                if changed.len() > 5 { ", ..." } else { "" }
            )
        };

        Ok(format!(
            "[GIT] Branch: {branch_line} | {changes_desc} | Commit gần nhất: {last_commit}"
        ))
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn inspect_dropped_file(
    file_name: String,
    content_base64: Option<String>,
    text_preview: Option<String>,
) -> Result<String, String> {
    let clean_name = file_name.trim().to_string();
    let lower = clean_name.to_lowercase();
    let is_image = lower.ends_with(".png")
        || lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".bmp")
        || lower.ends_with(".webp")
        || lower.ends_with(".gif");

    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        if is_image {
            let b64 = content_base64.unwrap_or_default();
            if b64.is_empty() {
                return Err("Không đọc được dữ liệu ảnh thả vào.".to_string());
            }
            let dir = get_screenshots_dir();
            let safe_ext = clean_name
                .rsplit('.')
                .next()
                .filter(|e| e.len() <= 5 && e.chars().all(|c| c.is_ascii_alphanumeric()))
                .unwrap_or("png");
            let temp_img = dir.join(format!("drop_{}.{}", std::process::id(), safe_ext));
            let temp_escaped = temp_img.to_string_lossy().replace('\'', "''");

            let ps_script = format!(
                r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$bytes = [Convert]::FromBase64String($env:DUCK_DROP_B64)
[System.IO.File]::WriteAllBytes('{temp_escaped}', $bytes)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {{ $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }})[0]
function Await($WinRtTask, $ResultType) {{
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}}
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$fs = [System.IO.File]::OpenRead('{temp_escaped}')
$stream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($fs)
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$txt = ""
if ($eng) {{
  $res = Await ($eng.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $txt = $res.Text
}}
$stream.Dispose(); $fs.Dispose()
Write-Output $txt
"#
            );
            let mut cmd = Command::new("powershell.exe");
            cmd.env("DUCK_DROP_B64", &b64);
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
            apply_no_window(&mut cmd);
            let out = cmd
                .output()
                .map_err(|e| format!("Lỗi xử lý ảnh thả vào: {e}"))?;
            let ocr_text = String::from_utf8_lossy(&out.stdout)
                .replace('\r', " ")
                .replace('\n', " ")
                .trim()
                .to_string();
            return Ok(format!(
                "[DROPPED_IMAGE]|{}|{}",
                temp_img.to_string_lossy(),
                ocr_text
            ));
        }

        let raw_text = text_preview.unwrap_or_default();
        let line_count = raw_text.lines().count();
        let char_count = raw_text.chars().count();
        let mut extra = String::new();

        if lower.ends_with(".csv") {
            let header = raw_text.lines().next().unwrap_or("");
            let cols: Vec<&str> = header.split(',').map(|s| s.trim()).collect();
            extra = format!(
                " | {} cột CSV ({})",
                cols.len(),
                cols.iter().take(5).copied().collect::<Vec<_>>().join(", ")
            );
        } else if lower.ends_with(".log") || lower.ends_with(".txt") || lower.ends_with(".py") || lower.ends_with(".rs") || lower.ends_with(".ts") || lower.ends_with(".js") {
            let err_lines = raw_text
                .lines()
                .filter(|l| {
                    let ll = l.to_lowercase();
                    ll.contains("error") || ll.contains("exception") || ll.contains("panic") || ll.contains("traceback")
                })
                .count();
            if err_lines > 0 {
                extra = format!(" | Phát hiện {err_lines} dòng có từ khóa Error/Exception");
            }
        }

        Ok(format!(
            "[DROPPED_TEXT] File \"{clean_name}\": {line_count} dòng, {char_count} ký tự{extra}."
        ))
    })
    .await
    .map_err(|e| format!("Lỗi đọc file thả vào: {e}"))?
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NumericColStat {
    pub column: String,
    pub count: usize,
    pub min: f64,
    pub max: f64,
    pub avg: f64,
    pub sum: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChartBarItem {
    pub label: String,
    pub value: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ColumnChartSeries {
    pub column_name: String,
    pub unit_or_kind: String,
    pub points: Vec<ChartBarItem>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IngestedFileAnalysis {
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size_kb: f64,
    pub row_count: usize,
    pub col_count: usize,
    pub columns: Vec<String>,
    pub sample_rows: Vec<Vec<String>>,
    pub numeric_stats: Vec<NumericColStat>,
    pub chart_series: Vec<ChartBarItem>,
    pub column_charts: Vec<ColumnChartSeries>,
    pub raw_excerpt: String,
    pub quick_overview: String,
}

fn split_csv_line(line: &str, sep: char) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let chars: Vec<char> = line.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i];
        if ch == '"' {
            if in_quotes && i + 1 < chars.len() && chars[i + 1] == '"' {
                current.push('"');
                i += 2;
                continue;
            }
            in_quotes = !in_quotes;
        } else if ch == sep && !in_quotes {
            fields.push(current.trim().to_string());
            current.clear();
        } else {
            current.push(ch);
        }
        i += 1;
    }
    fields.push(current.trim().to_string());
    fields
}

fn build_tabular_stats(
    rows: &[Vec<String>],
) -> (
    Vec<String>,
    Vec<Vec<String>>,
    Vec<NumericColStat>,
    Vec<ChartBarItem>,
    Vec<ColumnChartSeries>,
) {
    if rows.is_empty() {
        return (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());
    }
    let columns: Vec<String> = rows[0]
        .iter()
        .enumerate()
        .map(|(i, h)| {
            let t = h.trim();
            if t.is_empty() {
                format!("Col_{}", i + 1)
            } else {
                t.to_string()
            }
        })
        .collect();

    let data_rows = &rows[1..];
    let sample_rows: Vec<Vec<String>> = data_rows
        .iter()
        .take(40)
        .map(|r| {
            (0..columns.len())
                .map(|c| r.get(c).cloned().unwrap_or_default())
                .collect()
        })
        .collect();

    let mut numeric_stats = Vec::new();
    let mut numeric_col_indices = Vec::new();
    let mut categorical_col_indices = Vec::new();

    for col_idx in 0..columns.len() {
        let mut vals: Vec<f64> = Vec::new();
        for r in data_rows.iter().take(500) {
            if let Some(cell) = r.get(col_idx) {
                let norm = cell
                    .trim()
                    .replace(',', "")
                    .replace('%', "")
                    .replace('$', "");
                if let Ok(v) = norm.parse::<f64>() {
                    if v.is_finite() {
                        vals.push(v);
                    }
                }
            }
        }
        if vals.len() >= 2 {
            numeric_col_indices.push(col_idx);
            let min = vals.iter().copied().fold(f64::INFINITY, f64::min);
            let max = vals.iter().copied().fold(f64::NEG_INFINITY, f64::max);
            let sum: f64 = vals.iter().sum();
            let avg = sum / (vals.len() as f64);
            numeric_stats.push(NumericColStat {
                column: columns[col_idx].clone(),
                count: vals.len(),
                min: (min * 100.0).round() / 100.0,
                max: (max * 100.0).round() / 100.0,
                avg: (avg * 100.0).round() / 100.0,
                sum: (sum * 100.0).round() / 100.0,
            });
        } else {
            categorical_col_indices.push(col_idx);
        }
    }

    let label_col_opt = categorical_col_indices.first().copied();
    let mut column_charts: Vec<ColumnChartSeries> = Vec::new();

    // 1. Tạo biểu đồ cột riêng cho TỪNG cột số (tối đa 10 giá trị đầu theo cột nhãn)
    for &num_idx in &numeric_col_indices {
        let label_idx = label_col_opt
            .or_else(|| (0..columns.len()).find(|&i| i != num_idx))
            .unwrap_or(num_idx);
        let mut pts = Vec::new();
        for (r_idx, r) in data_rows.iter().take(24).enumerate() {
            let raw_val = r.get(num_idx).map(|s| s.trim()).unwrap_or("0");
            let norm = raw_val.replace(',', "").replace('%', "").replace('$', "");
            if let Ok(val) = norm.parse::<f64>() {
                if val.is_finite() {
                    let lbl = if label_idx != num_idx {
                        r.get(label_idx)
                            .map(|s| s.trim())
                            .filter(|s| !s.is_empty())
                            .unwrap_or("Row")
                            .chars()
                            .take(14)
                            .collect::<String>()
                    } else {
                        format!("#{}", r_idx + 1)
                    };
                    pts.push(ChartBarItem {
                        label: lbl,
                        value: (val * 100.0).round() / 100.0,
                    });
                }
            }
        }
        if !pts.is_empty() {
            column_charts.push(ColumnChartSeries {
                column_name: columns[num_idx].clone(),
                unit_or_kind: "numeric".to_string(),
                points: pts,
            });
        }
    }

    // 2. Nếu có >= 2 cột số, thêm cột biểu đồ tổng hợp "So sánh Avg"
    if numeric_stats.len() >= 2 {
        let avg_pts: Vec<ChartBarItem> = numeric_stats
            .iter()
            .take(10)
            .map(|st| ChartBarItem {
                label: st.column.chars().take(14).collect(),
                value: st.avg,
            })
            .collect();
        column_charts.push(ColumnChartSeries {
            column_name: "So sánh TB các cột".to_string(),
            unit_or_kind: "overview".to_string(),
            points: avg_pts,
        });
    }

    // 3. Tạo biểu đồ tần suất cho tối đa 3 cột phân loại (categorical) để bảng toàn chữ vẫn có chart cột!
    for &cat_idx in categorical_col_indices.iter().take(3) {
        let mut freq: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
        for r in data_rows.iter().take(500) {
            if let Some(cell) = r.get(cat_idx) {
                let cleaned = cell.trim();
                if !cleaned.is_empty() {
                    let key: String = cleaned.chars().take(16).collect();
                    *freq.entry(key).or_insert(0) += 1;
                }
            }
        }
        if freq.len() >= 2 && freq.len() <= 200 {
            let mut pairs: Vec<(String, usize)> = freq.into_iter().collect();
            pairs.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
            let pts: Vec<ChartBarItem> = pairs
                .into_iter()
                .take(8)
                .map(|(k, v)| ChartBarItem {
                    label: k,
                    value: v as f64,
                })
                .collect();
            if !pts.is_empty() {
                column_charts.push(ColumnChartSeries {
                    column_name: format!("{} (Tần suất)", columns[cat_idx]),
                    unit_or_kind: "frequency".to_string(),
                    points: pts,
                });
            }
        }
    }

    let chart_series = column_charts
        .first()
        .map(|c| c.points.clone())
        .unwrap_or_default();

    (columns, sample_rows, numeric_stats, chart_series, column_charts)
}

#[tauri::command]
pub async fn analyze_ingested_file(
    file_path: Option<String>,
    file_name: String,
    content_base64: Option<String>,
    text_preview: Option<String>,
) -> Result<IngestedFileAnalysis, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path_str = file_path.unwrap_or_default().trim().to_string();
        let clean_name = if !file_name.trim().is_empty() {
            file_name.trim().to_string()
        } else {
            PathBuf::from(&path_str)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown_file")
                .to_string()
        };
        let lower = clean_name.to_lowercase();

        // Đọc byte thực tế nếu có file_path hoặc content_base64
        let raw_bytes: Option<Vec<u8>> = if !path_str.is_empty() && PathBuf::from(&path_str).exists() {
            std::fs::read(&path_str).ok()
        } else {
            None
        };

        let file_size_kb = raw_bytes
            .as_ref()
            .map(|b| (b.len() as f64) / 1024.0)
            .or_else(|| content_base64.as_ref().map(|b| (b.len() as f64 * 0.75) / 1024.0))
            .or_else(|| text_preview.as_ref().map(|t| (t.len() as f64) / 1024.0))
            .unwrap_or(1.0);

        let is_image = lower.ends_with(".png")
            || lower.ends_with(".jpg")
            || lower.ends_with(".jpeg")
            || lower.ends_with(".bmp")
            || lower.ends_with(".webp")
            || lower.ends_with(".gif");
        let is_csv = lower.ends_with(".csv") || lower.ends_with(".tsv");
        let is_excel = lower.ends_with(".xlsx") || lower.ends_with(".xls");
        let is_pdf = lower.ends_with(".pdf");

        // 1. IMAGE (OCR + Độ phân giải ảnh thực)
        #[cfg(windows)]
        if is_image {
            let dir = get_screenshots_dir();
            let temp_img = if !path_str.is_empty() && PathBuf::from(&path_str).exists() {
                PathBuf::from(&path_str)
            } else {
                let b64 = content_base64.unwrap_or_default();
                let safe_ext = clean_name
                    .rsplit('.')
                    .next()
                    .filter(|e| e.len() <= 5 && e.chars().all(|c| c.is_ascii_alphanumeric()))
                    .unwrap_or("png");
                let p = dir.join(format!("ingest_{}.{}", std::process::id(), safe_ext));
                if !b64.is_empty() {
                    let ps_w = format!(
                        "[System.IO.File]::WriteAllBytes('{}', [Convert]::FromBase64String($env:DUCK_DROP_B64))",
                        p.to_string_lossy().replace('\'', "''")
                    );
                    let mut c = Command::new("powershell.exe");
                    c.env("DUCK_DROP_B64", &b64);
                    c.args(["-NoProfile", "-NonInteractive", "-Command", &ps_w]);
                    apply_no_window(&mut c);
                    let _ = c.output();
                }
                p
            };

            let escaped = temp_img.to_string_lossy().replace('\'', "''");
            let ps_img = format!(
                r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {{ $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }})[0]
function Await($WinRtTask, $ResultType) {{
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}}
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$fs = [System.IO.File]::OpenRead('{escaped}')
$stream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($fs)
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$w = [int]$decoder.PixelWidth
$h = [int]$decoder.PixelHeight
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$eng = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$lines = @()
if ($eng) {{
  $res = Await ($eng.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  foreach ($ln in $res.Lines) {{ $lines += [string]$ln.Text }}
}}
$stream.Dispose(); $fs.Dispose()
@{{ w = $w; h = $h; lines = $lines }} | ConvertTo-Json -Compress
"#
            );
            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_img]);
            apply_no_window(&mut cmd);
            let out = cmd.output().map_err(|e| format!("Lỗi phân tích ảnh: {e}"))?;
            let text_out = String::from_utf8_lossy(&out.stdout);
            let v: serde_json::Value =
                serde_json::from_str(text_out.trim()).unwrap_or(serde_json::json!({}));
            let width = v["w"].as_u64().unwrap_or(0);
            let height = v["h"].as_u64().unwrap_or(0);
            let lines: Vec<String> = v["lines"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|x| x.as_str().map(|s| s.trim().to_string()))
                        .filter(|s| !s.is_empty())
                        .collect()
                })
                .unwrap_or_default();

            let raw_excerpt = if lines.is_empty() {
                format!("Ảnh {} ({}x{} px) không có văn bản OCR rõ nét.", clean_name, width, height)
            } else {
                lines.join("\n")
            };

            let chart_series: Vec<ChartBarItem> = lines
                .iter()
                .take(8)
                .enumerate()
                .map(|(i, ln)| ChartBarItem {
                    label: format!("Line {}", i + 1),
                    value: ln.chars().count() as f64,
                })
                .collect();

            let sample_rows: Vec<Vec<String>> = lines
                .iter()
                .take(10)
                .enumerate()
                .map(|(i, ln)| vec![format!("#{}", i + 1), ln.clone()])
                .collect();

            let overview = format!(
                "[IMAGE] \"{}\" | Độ phân giải: {}x{} px | Dung lượng: {:.1} KB | OCR: {} dòng chữ.",
                clean_name,
                width,
                height,
                file_size_kb,
                lines.len()
            );

            return Ok(IngestedFileAnalysis {
                file_name: clean_name,
                file_path: temp_img.to_string_lossy().to_string(),
                file_type: "IMAGE".to_string(),
                file_size_kb: (file_size_kb * 10.0).round() / 10.0,
                row_count: lines.len(),
                col_count: 2,
                columns: vec!["Dòng".to_string(), "Nội dung OCR".to_string()],
                sample_rows,
                numeric_stats: vec![NumericColStat {
                    column: "Kích thước (px)".to_string(),
                    count: 2,
                    min: (width.min(height)) as f64,
                    max: (width.max(height)) as f64,
                    avg: ((width + height) as f64) / 2.0,
                    sum: (width * height) as f64,
                }],
                chart_series: chart_series.clone(),
                column_charts: if chart_series.is_empty() {
                    vec![ColumnChartSeries {
                        column_name: "Kích thước Ảnh (px)".to_string(),
                        unit_or_kind: "overview".to_string(),
                        points: vec![
                            ChartBarItem { label: "Chiều rộng".to_string(), value: width as f64 },
                            ChartBarItem { label: "Chiều cao".to_string(), value: height as f64 },
                        ],
                    }]
                } else {
                    vec![ColumnChartSeries {
                        column_name: "Độ dài dòng OCR".to_string(),
                        unit_or_kind: "numeric".to_string(),
                        points: chart_series,
                    }]
                },
                raw_excerpt,
                quick_overview: overview,
            });
        }

        // 2. CSV / TSV
        if is_csv {
            let text_data = if let Some(ref b) = raw_bytes {
                String::from_utf8_lossy(b).to_string()
            } else {
                text_preview.clone().unwrap_or_default()
            };
            let first_line = text_data.lines().find(|l| !l.trim().is_empty()).unwrap_or("");
            let sep = if lower.ends_with(".tsv") {
                '\t'
            } else if !first_line.contains(',') && first_line.contains(';') {
                ';'
            } else {
                ','
            };
            let parsed_rows: Vec<Vec<String>> = text_data
                .lines()
                .map(|l| l.trim())
                .filter(|l| !l.is_empty())
                .take(600)
                .map(|l| split_csv_line(l, sep))
                .collect();

            let total_rows = text_data.lines().filter(|l| !l.trim().is_empty()).count().saturating_sub(1);
            let (columns, sample_rows, numeric_stats, chart_series, column_charts) = build_tabular_stats(&parsed_rows);
            let overview = format!(
                "[CSV] \"{}\" | {} dòng dữ liệu x {} cột ({}) | {} cột số được thống kê.",
                clean_name,
                total_rows,
                columns.len(),
                columns.iter().take(4).cloned().collect::<Vec<_>>().join(", "),
                numeric_stats.len()
            );
            return Ok(IngestedFileAnalysis {
                file_name: clean_name,
                file_path: path_str,
                file_type: "CSV".to_string(),
                file_size_kb: (file_size_kb * 10.0).round() / 10.0,
                row_count: total_rows,
                col_count: columns.len(),
                columns,
                sample_rows,
                numeric_stats,
                chart_series,
                column_charts,
                raw_excerpt: text_data.chars().take(4500).collect(),
                quick_overview: overview,
            });
        }

        // 3. EXCEL (.xlsx / .xls) - Đọc OpenXML chuẩn không cần cài Microsoft Excel
        if is_excel {
            let dir = get_screenshots_dir();
            let excel_path = if !path_str.is_empty() && PathBuf::from(&path_str).exists() {
                PathBuf::from(&path_str)
            } else {
                let p = dir.join(format!("ingest_{}.xlsx", std::process::id()));
                if let Some(b64) = content_base64.clone() {
                    let ps_w = format!(
                        "[System.IO.File]::WriteAllBytes('{}', [Convert]::FromBase64String($env:DUCK_DROP_B64))",
                        p.to_string_lossy().replace('\'', "''")
                    );
                    let mut c = Command::new("powershell.exe");
                    c.env("DUCK_DROP_B64", &b64);
                    c.args(["-NoProfile", "-NonInteractive", "-Command", &ps_w]);
                    apply_no_window(&mut c);
                    let _ = c.output();
                }
                p
            };

            let escaped_xl = excel_path.to_string_lossy().replace('\'', "''");
            let ps_xl = format!(
                r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem
$rowsOut = @()
$sheetNames = @()
try {{
  $zip = [System.IO.Compression.ZipFile]::OpenRead('{escaped_xl}')
  $shared = @()
  $ssEntry = $zip.GetEntry('xl/sharedStrings.xml')
  if ($ssEntry) {{
    $sr = New-Object System.IO.StreamReader($ssEntry.Open(), [System.Text.Encoding]::UTF8)
    [xml]$ssXml = $sr.ReadToEnd()
    $sr.Close()
    foreach ($si in $ssXml.sst.si) {{
      if ($si.t) {{
        $txt = if ($si.t.'#text') {{ [string]$si.t.'#text' }} else {{ [string]$si.t }}
        $shared += $txt
      }} elseif ($si.r) {{
        $shared += (($si.r | ForEach-Object {{ if ($_.t.'#text') {{ $_.t.'#text' }} else {{ [string]$_.t }} }}) -join '')
      }} else {{
        $shared += [string]$si.InnerText
      }}
    }}
  }}
  $wbEntry = $zip.GetEntry('xl/workbook.xml')
  if ($wbEntry) {{
    $srW = New-Object System.IO.StreamReader($wbEntry.Open(), [System.Text.Encoding]::UTF8)
    [xml]$wbXml = $srW.ReadToEnd()
    $srW.Close()
    foreach ($sh in $wbXml.workbook.sheets.sheet) {{ $sheetNames += [string]$sh.name }}
  }}
  $sheetEntry = $zip.Entries | Where-Object {{ $_.FullName -like 'xl/worksheets/sheet*.xml' }} | Select-Object -First 1
  if ($sheetEntry) {{
    $srS = New-Object System.IO.StreamReader($sheetEntry.Open(), [System.Text.Encoding]::UTF8)
    [xml]$shXml = $srS.ReadToEnd()
    $srS.Close()
    $xmlRows = $shXml.worksheet.sheetData.row | Select-Object -First 300
    foreach ($xr in $xmlRows) {{
      $rowVals = New-Object System.Collections.Generic.List[string]
      foreach ($c in $xr.c) {{
        $val = ''
        if ($c.t -eq 's') {{
          $idx = [int]$c.v
          if ($idx -ge 0 -and $idx -lt $shared.Count) {{ $val = [string]$shared[$idx] }}
        }} elseif ($c.t -eq 'inlineStr') {{
          $val = [string]$c.is.InnerText
        }} else {{
          $val = [string]$c.v
        }}
        $rowVals.Add($val)
      }}
      if ($rowVals.Count -gt 0) {{ $rowsOut += ,($rowVals.ToArray()) }}
    }}
  }}
  $zip.Dispose()
}} catch {{ }}
@{{ sheets = $sheetNames; rows = $rowsOut }} | ConvertTo-Json -Depth 5 -Compress
"#
            );

            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_xl]);
            apply_no_window(&mut cmd);
            let out = cmd.output().map_err(|e| format!("Lỗi đọc Excel: {e}"))?;
            let text_out = String::from_utf8_lossy(&out.stdout);
            let v: serde_json::Value =
                serde_json::from_str(text_out.trim()).unwrap_or(serde_json::json!({}));

            let sheets: Vec<String> = v["sheets"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|x| x.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            let parsed_rows: Vec<Vec<String>> = v["rows"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .map(|r| {
                            r.as_array()
                                .map(|cells| {
                                    cells
                                        .iter()
                                        .map(|c| c.as_str().unwrap_or("").to_string())
                                        .collect()
                                })
                                .unwrap_or_default()
                        })
                        .filter(|r: &Vec<String>| !r.is_empty())
                        .collect()
                })
                .unwrap_or_default();

            let total_rows = parsed_rows.len().saturating_sub(1);
            let (columns, sample_rows, numeric_stats, chart_series, column_charts) = build_tabular_stats(&parsed_rows);
            let raw_excerpt = parsed_rows
                .iter()
                .take(40)
                .map(|r| r.join(" | "))
                .collect::<Vec<_>>()
                .join("\n");
            let sheets_info = if sheets.is_empty() {
                "Sheet1".to_string()
            } else {
                sheets.join(", ")
            };
            let overview = format!(
                "[EXCEL] \"{}\" | Sheet: {} | {} dòng x {} cột | {} cột số thống kê.",
                clean_name,
                sheets_info,
                total_rows,
                columns.len(),
                numeric_stats.len()
            );
            return Ok(IngestedFileAnalysis {
                file_name: clean_name,
                file_path: excel_path.to_string_lossy().to_string(),
                file_type: "EXCEL".to_string(),
                file_size_kb: (file_size_kb * 10.0).round() / 10.0,
                row_count: total_rows,
                col_count: columns.len(),
                columns,
                sample_rows,
                numeric_stats,
                chart_series,
                column_charts,
                raw_excerpt,
                quick_overview: overview,
            });
        }

        // 4. PDF (.pdf) - Trích số trang & giải nén luồng văn bản
        if is_pdf {
            let dir = get_screenshots_dir();
            let pdf_path = if !path_str.is_empty() && PathBuf::from(&path_str).exists() {
                PathBuf::from(&path_str)
            } else {
                let p = dir.join(format!("ingest_{}.pdf", std::process::id()));
                if let Some(b64) = content_base64.clone() {
                    let ps_w = format!(
                        "[System.IO.File]::WriteAllBytes('{}', [Convert]::FromBase64String($env:DUCK_DROP_B64))",
                        p.to_string_lossy().replace('\'', "''")
                    );
                    let mut c = Command::new("powershell.exe");
                    c.env("DUCK_DROP_B64", &b64);
                    c.args(["-NoProfile", "-NonInteractive", "-Command", &ps_w]);
                    apply_no_window(&mut c);
                    let _ = c.output();
                }
                p
            };

            let escaped_pdf = pdf_path.to_string_lossy().replace('\'', "''");
            let ps_pdf = format!(
                r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$bytes = [System.IO.File]::ReadAllBytes('{escaped_pdf}')
$raw = [System.Text.Encoding]::Latin1.GetString($bytes)
$pageMatches = [regex]::Matches($raw, '/Type\s*/Page(?![a-zA-Z])')
$pageCount = [Math]::Max(1, $pageMatches.Count)
$texts = New-Object System.Collections.Generic.List[string]

$streamMatches = [regex]::Matches($raw, 'stream\r?\n([\s\S]*?)\r?\nendstream')
foreach ($m in ($streamMatches | Select-Object -First 40)) {{
  $sRaw = $m.Groups[1].Value
  $sBytes = [System.Text.Encoding]::Latin1.GetBytes($sRaw)
  $decodedStr = $sRaw
  if ($sBytes.Length -gt 6 -and $sBytes[0] -eq 0x78) {{
    try {{
      $ms = New-Object System.IO.MemoryStream($sBytes, 2, $sBytes.Length - 2)
      $ds = New-Object System.IO.Compression.DeflateStream($ms, [System.IO.Compression.CompressionMode]::Decompress)
      $sr = New-Object System.IO.StreamReader($ds, [System.Text.Encoding]::Latin1)
      $decodedStr = $sr.ReadToEnd()
      $sr.Close(); $ds.Close(); $ms.Close()
    }} catch {{}}
  }}
  $tjMatches = [regex]::Matches($decodedStr, '\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*T[jJ]')
  foreach ($tm in $tjMatches) {{
    $chunk = $tm.Groups[1].Value -replace '\\([()\\])','$1' -replace '[^\x20-\x7E\u00C0-\u1EF9]',' '
    $chunk = $chunk.Trim()
    if ($chunk.Length -ge 2) {{ $texts.Add($chunk) }}
  }}
}}
$joined = ($texts -join ' ') -replace '\s+', ' '
if ($joined.Length -gt 3200) {{ $joined = $joined.Substring(0, 3200) }}
@{{ pages = $pageCount; text = $joined; streams = $streamMatches.Count }} | ConvertTo-Json -Compress
"#
            );

            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NoProfile", "-NonInteractive", "-Command", &ps_pdf]);
            apply_no_window(&mut cmd);
            let out = cmd.output().map_err(|e| format!("Lỗi đọc PDF: {e}"))?;
            let text_out = String::from_utf8_lossy(&out.stdout);
            let v: serde_json::Value =
                serde_json::from_str(text_out.trim()).unwrap_or(serde_json::json!({}));
            let pages = v["pages"].as_u64().unwrap_or(1) as usize;
            let streams = v["streams"].as_u64().unwrap_or(0) as usize;
            let extracted = v["text"].as_str().unwrap_or("").trim().to_string();
            let word_count = extracted.split_whitespace().count();

            let raw_excerpt = if !extracted.is_empty() {
                extracted.clone()
            } else {
                format!(
                    "Tệp PDF \"{}\" gồm {} trang ({} đối tượng stream, {:.1} KB). PDF có thể dùng ảnh scan hoặc font mã hóa đặc biệt.",
                    clean_name, pages, streams, file_size_kb
                )
            };

            let words: Vec<&str> = raw_excerpt.split_whitespace().collect();
            let seg_size = (words.len() / 6).max(12);
            let mut sample_rows = Vec::new();
            let mut chart_series = Vec::new();
            for (idx, chunk) in words.chunks(seg_size).take(6).enumerate() {
                let txt = chunk.join(" ");
                chart_series.push(ChartBarItem {
                    label: format!("Đoạn {}", idx + 1),
                    value: chunk.len() as f64,
                });
                sample_rows.push(vec![format!("Đoạn {}", idx + 1), txt]);
            }

            let overview = format!(
                "[PDF] \"{}\" | {} trang | {:.1} KB | Trích xuất ~{} từ văn bản.",
                clean_name, pages, file_size_kb, word_count
            );

            return Ok(IngestedFileAnalysis {
                file_name: clean_name,
                file_path: pdf_path.to_string_lossy().to_string(),
                file_type: "PDF".to_string(),
                file_size_kb: (file_size_kb * 10.0).round() / 10.0,
                row_count: pages,
                col_count: 2,
                columns: vec!["Phần".to_string(), "Nội dung trích xuất".to_string()],
                sample_rows,
                numeric_stats: vec![NumericColStat {
                    column: "Thống kê PDF".to_string(),
                    count: pages,
                    min: pages as f64,
                    max: word_count as f64,
                    avg: if pages > 0 { (word_count as f64) / (pages as f64) } else { 0.0 },
                    sum: word_count as f64,
                }],
                chart_series: chart_series.clone(),
                column_charts: vec![ColumnChartSeries {
                    column_name: "Mật độ từ theo Đoạn PDF".to_string(),
                    unit_or_kind: "numeric".to_string(),
                    points: chart_series,
                }],
                raw_excerpt,
                quick_overview: overview,
            });
        }

        // 5. TEXT / JSON / LOG / CODE FALLBACK
        let raw_text = if let Some(ref b) = raw_bytes {
            String::from_utf8_lossy(b).to_string()
        } else {
            text_preview.unwrap_or_default()
        };
        let line_count = raw_text.lines().count();
        let word_count = raw_text.split_whitespace().count();
        let sample_rows: Vec<Vec<String>> = raw_text
            .lines()
            .filter(|l| !l.trim().is_empty())
            .take(10)
            .enumerate()
            .map(|(i, l)| vec![format!("L{}", i + 1), l.chars().take(120).collect()])
            .collect();
        let chart_series: Vec<ChartBarItem> = raw_text
            .lines()
            .filter(|l| !l.trim().is_empty())
            .take(8)
            .enumerate()
            .map(|(i, l)| ChartBarItem {
                label: format!("L{}", i + 1),
                value: l.chars().count() as f64,
            })
            .collect();

        let overview = format!(
            "[TEXT] \"{}\" | {} dòng | {} từ | {:.1} KB.",
            clean_name, line_count, word_count, file_size_kb
        );

        Ok(IngestedFileAnalysis {
            file_name: clean_name,
            file_path: path_str,
            file_type: "TEXT".to_string(),
            file_size_kb: (file_size_kb * 10.0).round() / 10.0,
            row_count: line_count,
            col_count: 2,
            columns: vec!["Dòng".to_string(), "Nội dung".to_string()],
            sample_rows,
            numeric_stats: Vec::new(),
            chart_series: chart_series.clone(),
            column_charts: vec![ColumnChartSeries {
                column_name: "Độ dài từng dòng (ký tự)".to_string(),
                unit_or_kind: "numeric".to_string(),
                points: chart_series,
            }],
            raw_excerpt: raw_text.chars().take(4500).collect(),
            quick_overview: overview,
        })
    })
    .await
    .map_err(|e| format!("Lỗi phân tích file nạp vào: {e}"))?
}


