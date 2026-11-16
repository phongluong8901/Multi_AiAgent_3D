use serde::Deserialize;
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::WebviewWindow;

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

pub fn spawn_cursor_tracker(window: WebviewWindow, hitbox: Arc<HitboxState>) {
    std::thread::spawn(move || {
        let mut currently_ignoring = false;
        loop {
            std::thread::sleep(Duration::from_millis(16));

            let mut cursor_x = hitbox.cursor_x.load(Ordering::Relaxed);
            let mut cursor_y = hitbox.cursor_y.load(Ordering::Relaxed);
            let mut has_cursor = false;

            #[cfg(windows)]
            {
                use windows::Win32::Foundation::POINT;
                use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

                let mut pt = POINT::default();
                unsafe {
                    if GetCursorPos(&mut pt).is_ok() {
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

                let dx = cursor_x - cx;
                let dy = cursor_y - cy;
                if (dx * dx + dy * dy) <= (rad * rad) {
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
