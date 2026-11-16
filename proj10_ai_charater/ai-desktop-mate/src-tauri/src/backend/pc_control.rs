use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

use crate::backend::telemetry::apply_no_window;

#[derive(Serialize, Clone, Debug)]
pub struct OcrResultInfo {
    pub image_path: String,
    pub raw_text: String,
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
    let trimmed = target.trim();
    if trimmed.is_empty() {
        return Err("Đường dẫn hoặc tên ứng dụng trống".to_string());
    }

    #[cfg(windows)]
    {
        // Mở URL (http/https/ms-settings) hoặc ứng dụng Windows bằng cmd /C start
        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/C", "start", "", trimmed]);
        apply_no_window(&mut cmd);
        cmd.spawn()
            .map_err(|e| format!("Không thể mở '{trimmed}': {e}"))?;
        return Ok(format!("Đã mở: {trimmed}"));
    }

    #[cfg(not(windows))]
    {
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
if (-not $eng) {{ throw "Windows OCR Engine không khả dụng" }}
$res = Await ($eng.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$stream.Dispose(); $fs.Dispose()
Write-Output $res.Text
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

