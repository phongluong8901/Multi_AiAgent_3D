use serde::Deserialize;
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{Emitter, WebviewWindow};

#[derive(Deserialize, Clone, Copy, Debug, Default)]
pub struct UiRect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

pub struct HitboxState {
    pub char_x: AtomicI32,
    pub char_y: AtomicI32,
    pub char_r: AtomicI32,
    pub ui_rects: Mutex<Vec<UiRect>>,
    pub is_dragging: AtomicBool,
    pub manual_interactive: AtomicBool,
    pub cursor_x: AtomicI32,
    pub cursor_y: AtomicI32,
    pub audio_peak_milli: AtomicI32,
    pub key_press_counter: AtomicI32,
    pub cursor_idle_ms: AtomicI32,
    pub goose_nudging: AtomicBool,
}

impl HitboxState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            char_x: AtomicI32::new(-9999),
            char_y: AtomicI32::new(-9999),
            char_r: AtomicI32::new(100),
            ui_rects: Mutex::new(Vec::new()),
            is_dragging: AtomicBool::new(false),
            manual_interactive: AtomicBool::new(false),
            cursor_x: AtomicI32::new(0),
            cursor_y: AtomicI32::new(0),
            audio_peak_milli: AtomicI32::new(0),
            key_press_counter: AtomicI32::new(0),
            cursor_idle_ms: AtomicI32::new(0),
            goose_nudging: AtomicBool::new(false),
        })
    }
}

fn point_in_rect_padded(px: i32, py: i32, rect: UiRect, pad: i32) -> bool {
    if rect.w <= 0 || rect.h <= 0 {
        return false;
    }
    px >= (rect.x - pad)
        && px <= (rect.x + rect.w + pad)
        && py >= (rect.y - pad)
        && py <= (rect.y + rect.h + pad)
}

#[cfg(windows)]
fn acquire_audio_meter() -> Option<windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation> {
    use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
    use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};

    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
        device.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None).ok()
    }
}

pub fn spawn_cursor_tracker(window: WebviewWindow, hitbox: Arc<HitboxState>) {
    std::thread::spawn(move || {
        #[cfg(windows)]
        let mut audio_meter = {
            unsafe {
                let _ = windows::Win32::System::Com::CoInitializeEx(
                    None,
                    windows::Win32::System::Com::COINIT_MULTITHREADED,
                );
            }
            acquire_audio_meter()
        };
        let mut tick_count: u32 = 0;
        let mut prev_raw_x: i32 = 0;
        let mut prev_raw_y: i32 = 0;
        let mut has_prev_raw = false;
        let mut prev_keys_down: u64 = 0;
        let mut prev_alt_q = false;
        let mut prev_alt_w = false;
        let mut last_hotkey_at = Instant::now() - Duration::from_secs(2);

        let mut currently_ignoring = false;
        loop {
            std::thread::sleep(Duration::from_millis(16));
            tick_count = tick_count.wrapping_add(1);

            let mut cursor_x = hitbox.cursor_x.load(Ordering::Relaxed);
            let mut cursor_y = hitbox.cursor_y.load(Ordering::Relaxed);
            let mut has_cursor = false;
            #[allow(unused_assignments)]
            let mut left_btn_down = false;

            #[cfg(windows)]
            {
                use windows::Win32::Foundation::POINT;
                use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
                use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

                let mut pt = POINT::default();
                unsafe {
                    if GetCursorPos(&mut pt).is_ok() {
                        if !has_prev_raw {
                            prev_raw_x = pt.x;
                            prev_raw_y = pt.y;
                            has_prev_raw = true;
                        } else if hitbox.goose_nudging.load(Ordering::Relaxed) {
                            prev_raw_x = pt.x;
                            prev_raw_y = pt.y;
                        } else if (pt.x - prev_raw_x).abs() + (pt.y - prev_raw_y).abs() <= 2 {
                            let cur = hitbox.cursor_idle_ms.load(Ordering::Relaxed);
                            if cur < 3_600_000 {
                                hitbox.cursor_idle_ms.store(cur + 16, Ordering::Relaxed);
                            }
                        } else {
                            hitbox.cursor_idle_ms.store(0, Ordering::Relaxed);
                            prev_raw_x = pt.x;
                            prev_raw_y = pt.y;
                        }

                        let scale = window.scale_factor().unwrap_or(1.0).max(0.5);
                        if let Ok(win_pos) = window.outer_position() {
                            cursor_x = ((pt.x - win_pos.x) as f64 / scale).round() as i32;
                            cursor_y = ((pt.y - win_pos.y) as f64 / scale).round() as i32;
                        } else {
                            cursor_x = (pt.x as f64 / scale).round() as i32;
                            cursor_y = (pt.y as f64 / scale).round() as i32;
                        }
                        hitbox.cursor_x.store(cursor_x, Ordering::Relaxed);
                        hitbox.cursor_y.store(cursor_y, Ordering::Relaxed);
                        has_cursor = true;
                    }

                    // Theo dõi nhịp gõ phím toàn cục qua GetAsyncKeyState (46 phím chữ/số/Space/Enter/Backspace)
                    let mut mask: u64 = 0;
                    let mut bit_idx: u32 = 0;
                    for vk in [0x08_i32, 0x0D, 0x20] {
                        if (GetAsyncKeyState(vk) as u16 & 0x8000) != 0 {
                            mask |= 1u64 << bit_idx;
                        }
                        bit_idx += 1;
                    }
                    for vk in 0x30_i32..=0x5A_i32 {
                        if (GetAsyncKeyState(vk) as u16 & 0x8000) != 0 {
                            mask |= 1u64 << bit_idx;
                        }
                        bit_idx += 1;
                    }
                    let newly_pressed = mask & !prev_keys_down;
                    if newly_pressed != 0 {
                        hitbox
                            .key_press_counter
                            .fetch_add(newly_pressed.count_ones() as i32, Ordering::Relaxed);
                    }
                    prev_keys_down = mask;

                    // Global Hotkey: Alt+Q (Gọi khung chat) và Alt+W (Bật/Tắt chế độ nấp mép màn hình)
                    left_btn_down = (GetAsyncKeyState(0x01_i32) as u16 & 0x8000) != 0;
                    let alt_down = (GetAsyncKeyState(0x12_i32) as u16 & 0x8000) != 0;
                    let q_down = (GetAsyncKeyState(0x51_i32) as u16 & 0x8000) != 0;
                    let w_down = (GetAsyncKeyState(0x57_i32) as u16 & 0x8000) != 0;
                    let cur_alt_q = alt_down && q_down;
                    let cur_alt_w = alt_down && w_down;

                    if cur_alt_q && !prev_alt_q && last_hotkey_at.elapsed() >= Duration::from_millis(450) {
                        last_hotkey_at = Instant::now();
                        let _ = window.set_focus();
                        let _ = window.emit("desktop-mate://global-hotkey", "summon_chat");
                    } else if cur_alt_w && !prev_alt_w && last_hotkey_at.elapsed() >= Duration::from_millis(450) {
                        last_hotkey_at = Instant::now();
                        let _ = window.emit("desktop-mate://global-hotkey", "toggle_edge_peek");
                    }
                    prev_alt_q = cur_alt_q;
                    prev_alt_w = cur_alt_w;

                    // Đo biên độ nhạc hệ thống (WASAPI IAudioMeterInformation) mỗi ~48ms
                    if tick_count % 3 == 0 {
                        if audio_meter.is_none() && tick_count % 120 == 0 {
                            audio_meter = acquire_audio_meter();
                        }
                        if let Some(ref meter) = audio_meter {
                            match meter.GetPeakValue() {
                                Ok(peak) => {
                                    let clamped = (peak.clamp(0.0, 1.0) * 1000.0) as i32;
                                    hitbox.audio_peak_milli.store(clamped, Ordering::Relaxed);
                                }
                                Err(_) => {
                                    audio_meter = None;
                                    hitbox.audio_peak_milli.store(0, Ordering::Relaxed);
                                }
                            }
                        }
                    }
                }
            }

            if hitbox.manual_interactive.load(Ordering::Relaxed) {
                if currently_ignoring {
                    let _ = window.set_ignore_cursor_events(false);
                    currently_ignoring = false;
                }
                continue;
            }

            let is_dragging = hitbox.is_dragging.load(Ordering::Relaxed);
            let mut should_interact = is_dragging;

            if !should_interact && has_cursor {
                let cx = hitbox.char_x.load(Ordering::Relaxed);
                let cy = hitbox.char_y.load(Ordering::Relaxed);
                let rad = hitbox.char_r.load(Ordering::Relaxed);
                let rad_eff = if left_btn_down { rad + 120 } else { rad };

                let dx = cursor_x - cx;
                let dy = cursor_y - cy;
                if (dx * dx + dy * dy) <= (rad_eff * rad_eff) {
                    should_interact = true;
                }

                if !should_interact {
                    if let Ok(rects) = hitbox.ui_rects.lock() {
                        for r in rects.iter() {
                            if point_in_rect_padded(cursor_x, cursor_y, *r, 6) {
                                should_interact = true;
                                break;
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
