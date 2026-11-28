use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::backend::telemetry::apply_no_window;

#[cfg(windows)]
#[link(name = "user32")]
unsafe extern "system" {
    fn SetCursorPos(x: i32, y: i32) -> i32;
    fn mouse_event(dw_flags: u32, dx: u32, dy: u32, dw_data: u32, dw_extra_info: usize);
    fn keybd_event(b_vk: u8, b_scan: u8, dw_flags: u32, dw_extra_info: usize);
    fn BlockInput(f_block_it: i32) -> i32;
    fn GetSystemMetrics(n_index: i32) -> i32;
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct P2pWirePacket {
    pub kind: String,
    pub room_code: Option<String>,
    pub peer_name: Option<String>,
    pub body_color: Option<String>,
    pub accent_color: Option<String>,
    pub x_ratio: Option<f64>,
    pub y_ratio: Option<f64>,
    pub vx: Option<f64>,
    pub vy: Option<f64>,
    pub walk_dir: Option<i32>,
    pub char_state: Option<String>,
    pub weapon: Option<String>,
    pub hp: Option<i32>,
    pub peer_hp: Option<i32>,
    pub max_hp: Option<i32>,
    pub skill: Option<String>,
    pub damage: Option<i32>,
    pub winner_is_sender: Option<bool>,
    pub cmd_type: Option<String>,
    pub x_norm: Option<f64>,
    pub y_norm: Option<f64>,
    pub button: Option<String>,
    pub vk: Option<u8>,
    pub wheel_delta: Option<i32>,
    pub text: Option<String>,
    pub duration_sec: Option<u64>,
    pub reason: Option<String>,
    pub aim_x: Option<f64>,
    pub aim_y: Option<f64>,
    pub is_hidden: Option<bool>,
    pub is_shielding: Option<bool>,
    pub is_jetpack: Option<bool>,
    pub is_sliding: Option<bool>,
    pub windows_json: Option<String>,
    pub energy: Option<i32>,
    pub peer_energy: Option<i32>,
    pub foods_json: Option<String>,
    pub food_id: Option<u64>,
    pub frame_b64: Option<String>,
    pub frame_w: Option<u32>,
    pub frame_h: Option<u32>,
    pub frame_seq: Option<u64>,
}

#[derive(Serialize, Clone, Debug)]
pub struct P2pStatus {
    pub local_ip: String,
    pub listen_port: u16,
    pub local_name: String,
    pub room_code: String,
    pub phase: String,
    pub peer_name: String,
    pub peer_addr: String,
    pub peer_body_color: String,
    pub peer_accent_color: String,
    pub pending_peer_name: String,
    pub pending_peer_addr: String,
    pub winner_remaining_sec: u64,
    pub victim_remaining_sec: u64,
    pub is_sim_mode: bool,
    pub is_web_peer: bool,
    pub is_room_host: bool,
    pub mobile_url: String,
    pub lan_ips: Vec<String>,
    pub host_windows_json: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct P2pRemoteFrameSnapshot {
    pub has_frame: bool,
    pub frame_b64: String,
    pub width: u32,
    pub height: u32,
    pub seq: u64,
    pub cursor_x: f64,
    pub cursor_y: f64,
    pub remaining_sec: u64,
    pub is_sim_mode: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct P2pEventPayload {
    pub event_type: String,
    pub packet: Option<P2pWirePacket>,
    pub status: P2pStatus,
    pub message: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct LanPeerInfo {
    pub name: String,
    pub addr: String,
    pub port: u16,
}

struct P2pInner {
    app: AppHandle,
    local_ip: String,
    lan_ips: Vec<String>,
    listen_port: u16,
    local_name: String,
    room_code: String,
    phase: String,
    peer_name: String,
    peer_addr: String,
    peer_body_color: String,
    peer_accent_color: String,
    pending_peer_name: String,
    pending_peer_addr: String,
    pending_body_color: String,
    pending_accent_color: String,
    pending_stream: Option<TcpStream>,
    active_stream: Option<TcpStream>,
    winner_control_until: Option<Instant>,
    victim_control_until: Option<Instant>,
    is_sim_mode: bool,
    is_web_peer: bool,
    is_room_host: bool,
    host_windows_json: String,
    pc_x_ratio: f64,
    pc_y_ratio: f64,
    pc_walk_dir: i32,
    pc_state: String,
    pc_weapon: String,
    pc_hp: i32,
    peer_hp: i32,
    pc_energy: i32,
    peer_energy: i32,
    pk_foods_json: String,
    pc_migrated_out: bool,
    pc_hidden: bool,
    pc_shielding: bool,
    pc_jetpack: bool,
    pc_sliding: bool,
    last_pc_skill: String,
    last_pc_skill_seq: u64,
    last_pc_aim_x: f64,
    last_pc_aim_y: f64,
    block_generation: u64,
    remote_frame_b64: String,
    remote_frame_w: u32,
    remote_frame_h: u32,
    remote_frame_seq: u64,
    remote_cursor_x: f64,
    remote_cursor_y: f64,
}

pub struct P2pState {
    inner: Arc<Mutex<P2pInner>>,
    jitter_cancel: Arc<AtomicBool>,
}

fn is_virtual_adapter_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("vethernet")
        || lower.contains("wsl")
        || lower.contains("hyper-v")
        || lower.contains("virtualbox")
        || lower.contains("vmware")
        || lower.contains("docker")
        || lower.contains("loopback")
        || lower.contains("bluetooth")
}

fn detect_lan_ipv4_candidates() -> Vec<String> {
    let mut primary: Vec<String> = Vec::new();
    let mut secondary: Vec<String> = Vec::new();

    let push_ip = |ip_str: &str, is_virtual: bool, pri: &mut Vec<String>, sec: &mut Vec<String>| {
        let Ok(ip) = ip_str.trim().parse::<std::net::Ipv4Addr>() else {
            return;
        };
        if ip.is_loopback() || ip.is_link_local() || ip.is_unspecified() {
            return;
        }
        let s = ip.to_string();
        if pri.contains(&s) || sec.contains(&s) {
            return;
        }
        if is_virtual {
            sec.push(s);
        } else {
            pri.push(s);
        }
    };

    // 1. Collect outbound route candidates via UDP socket (no actual packet sent)
    for probe in ["192.168.1.1:80", "10.0.0.1:80", "8.8.8.8:80", "1.1.1.1:80"] {
        if let Ok(sock) = UdpSocket::bind("0.0.0.0:0") {
            if sock.connect(probe).is_ok() {
                if let Ok(addr) = sock.local_addr() {
                    if let std::net::IpAddr::V4(v4) = addr.ip() {
                        push_ip(&v4.to_string(), false, &mut primary, &mut secondary);
                    }
                }
            }
        }
    }

    // 2. Parse Windows ipconfig to list all non-loopback IPv4 interfaces cleanly
    #[cfg(windows)]
    {
        let mut cmd = std::process::Command::new("ipconfig");
        apply_no_window(&mut cmd);
        if let Ok(out) = cmd.output() {
            let txt = String::from_utf8_lossy(&out.stdout);
            let mut in_virtual_adapter = false;
            for raw_line in txt.lines() {
                let line = raw_line.trim_end();
                if line.trim().is_empty() {
                    continue;
                }
                if !line.starts_with(' ') && !line.starts_with('\t') {
                    in_virtual_adapter = is_virtual_adapter_name(line);
                    continue;
                }
                if line.to_ascii_lowercase().contains("ipv4") {
                    if let Some((_, rhs)) = line.split_once(':') {
                        let cleaned = rhs.split('(').next().unwrap_or(rhs).trim();
                        push_ip(cleaned, in_virtual_adapter, &mut primary, &mut secondary);
                    }
                }
            }
        }
    }

    let mut combined = primary;
    for s in secondary {
        if !combined.contains(&s) {
            combined.push(s);
        }
    }
    combined
}

#[allow(dead_code)]
fn detect_local_ip() -> String {
    detect_lan_ipv4_candidates()
        .into_iter()
        .next()
        .unwrap_or_else(|| "127.0.0.1".to_string())
}

fn generate_room_code() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64 + d.as_secs())
        .unwrap_or(123456);
    let code = 100000 + (nanos % 900000);
    format!("{code}")
}

fn get_pc_username() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "DuckPlayer".to_string())
}

fn refresh_expired_timers(inner: &mut P2pInner) {
    let now = Instant::now();
    if let Some(until) = inner.winner_control_until {
        if now >= until {
            inner.winner_control_until = None;
            inner.remote_frame_b64.clear();
            inner.remote_frame_w = 0;
            inner.remote_frame_h = 0;
            inner.remote_frame_seq = 0;
            if inner.phase == "winner_control" {
                inner.phase = if inner.active_stream.is_some() || inner.is_sim_mode || inner.is_web_peer {
                    "connected".to_string()
                } else {
                    "hosting".to_string()
                };
            }
        }
    }
    if let Some(until) = inner.victim_control_until {
        if now >= until {
            release_win32_block_input();
            inner.victim_control_until = None;
            if inner.phase == "victim_controlled" {
                inner.phase = if inner.active_stream.is_some() || inner.is_sim_mode || inner.is_web_peer {
                    "connected".to_string()
                } else {
                    "hosting".to_string()
                };
            }
        }
    }
}

fn build_status(inner: &P2pInner) -> P2pStatus {
    let now = Instant::now();
    let winner_remaining_sec = inner
        .winner_control_until
        .and_then(|t| t.checked_duration_since(now))
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let victim_remaining_sec = inner
        .victim_control_until
        .and_then(|t| t.checked_duration_since(now))
        .map(|d| d.as_secs())
        .unwrap_or(0);

    P2pStatus {
        local_ip: inner.local_ip.clone(),
        listen_port: inner.listen_port,
        local_name: inner.local_name.clone(),
        room_code: inner.room_code.clone(),
        phase: inner.phase.clone(),
        peer_name: inner.peer_name.clone(),
        peer_addr: inner.peer_addr.clone(),
        peer_body_color: inner.peer_body_color.clone(),
        peer_accent_color: inner.peer_accent_color.clone(),
        pending_peer_name: inner.pending_peer_name.clone(),
        pending_peer_addr: inner.pending_peer_addr.clone(),
        winner_remaining_sec,
        victim_remaining_sec,
        is_sim_mode: inner.is_sim_mode,
        is_web_peer: inner.is_web_peer,
        is_room_host: inner.is_room_host,
        mobile_url: format!("http://{}:{}/?room={}", inner.local_ip, inner.listen_port, inner.room_code),
        lan_ips: inner.lan_ips.clone(),
        host_windows_json: inner.host_windows_json.clone(),
    }
}

fn emit_p2p(inner: &P2pInner, event_type: &str, packet: Option<P2pWirePacket>, msg: Option<String>) {
    let payload = P2pEventPayload {
        event_type: event_type.to_string(),
        packet,
        status: build_status(inner),
        message: msg,
    };
    let _ = inner.app.emit("desktop-mate://p2p-event", payload);
}

fn send_json_line(stream: &mut TcpStream, pkt: &P2pWirePacket) -> Result<(), String> {
    let mut line = serde_json::to_string(pkt).map_err(|e| format!("Serialize error: {e}"))?;
    line.push('\n');
    stream
        .write_all(line.as_bytes())
        .map_err(|e| format!("Send TCP error: {e}"))?;
    let _ = stream.flush();
    Ok(())
}

fn release_win32_block_input() {
    #[cfg(windows)]
    unsafe {
        let _ = BlockInput(0);
    }
}

pub fn capture_desktop_frame_bmp_b64(max_w: u32) -> Result<(String, u32, u32, f64, f64), String> {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::Foundation::{HWND, POINT};
        use windows::Win32::Graphics::Gdi::{
            CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
            ReleaseDC, SelectObject, SetBrushOrgEx, SetStretchBltMode, StretchBlt, BITMAPINFO,
            BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HALFTONE, HGDIOBJ, RGBQUAD, SRCCOPY,
        };
        use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

        let sw = GetSystemMetrics(0).max(800);
        let sh = GetSystemMetrics(1).max(600);
        let mut pt = POINT { x: sw / 2, y: sh / 2 };
        let _ = GetCursorPos(&mut pt);
        let cursor_x_norm = (pt.x as f64 / sw as f64).clamp(0.0, 1.0);
        let cursor_y_norm = (pt.y as f64 / sh as f64).clamp(0.0, 1.0);

        let dst_w = max_w.clamp(320, 960).min(sw as u32);
        let dst_h = (((dst_w as f64) * (sh as f64) / (sw as f64)).round() as u32).clamp(180, 640);

        let screen_dc = GetDC(HWND::default());
        if screen_dc.0.is_null() {
            return Err("Không lấy được Screen DC.".to_string());
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
            let _ = ReleaseDC(HWND::default(), screen_dc);
            return Err("Không tạo được bitmap scale desktop.".to_string());
        }

        let old_dst = SelectObject(dst_dc, HGDIOBJ(dst_bmp.0));
        let _ = SetStretchBltMode(dst_dc, HALFTONE);
        let _ = SetBrushOrgEx(dst_dc, 0, 0, None);
        let stretch_ok = StretchBlt(
            dst_dc,
            0,
            0,
            dst_w as i32,
            dst_h as i32,
            screen_dc,
            0,
            0,
            sw,
            sh,
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
        let scanlines = if stretch_ok.as_bool() {
            GetDIBits(
                dst_dc,
                dst_bmp,
                0,
                dst_h,
                Some(pixel_buf.as_mut_ptr().cast()),
                &mut bmi,
                DIB_RGB_COLORS,
            )
        } else {
            0
        };

        let _ = DeleteObject(HGDIOBJ(dst_bmp.0));
        let _ = DeleteDC(dst_dc);
        let _ = ReleaseDC(HWND::default(), screen_dc);

        if scanlines == 0 {
            return Err("Không đọc được điểm ảnh desktop GetDIBits.".to_string());
        }

        let bmp = crate::backend::mini_screen::build_bgr24_bmp(dst_w, dst_h, &pixel_buf);
        let b64 = crate::backend::mini_screen::encode_base64(&bmp);
        Ok((b64, dst_w, dst_h, cursor_x_norm, cursor_y_norm))
    }

    #[cfg(not(windows))]
    {
        let _ = max_w;
        Err("Chỉ hỗ trợ chụp màn hình trên Windows.".to_string())
    }
}

fn spawn_victim_screen_streamer(inner_arc: Arc<Mutex<P2pInner>>) {
    std::thread::spawn(move || {
        let mut seq: u64 = 1;
        loop {
            let stream_opt: Option<TcpStream>;
            if let Ok(mut guard) = inner_arc.lock() {
                refresh_expired_timers(&mut guard);
                if guard.phase != "victim_controlled" || guard.victim_control_until.is_none() {
                    break;
                }
                if guard.is_sim_mode || guard.is_web_peer {
                    break;
                }
                stream_opt = guard.active_stream.as_ref().and_then(|s| s.try_clone().ok());
            } else {
                break;
            }

            let Some(mut stream) = stream_opt else {
                break;
            };

            if let Ok((b64, w, h, cx, cy)) = capture_desktop_frame_bmp_b64(560) {
                let pkt = P2pWirePacket {
                    kind: "remote_frame".to_string(),
                    frame_b64: Some(b64),
                    frame_w: Some(w),
                    frame_h: Some(h),
                    frame_seq: Some(seq),
                    x_ratio: Some(cx),
                    y_ratio: Some(cy),
                    ..Default::default()
                };
                if send_json_line(&mut stream, &pkt).is_err() {
                    break;
                }
                seq = seq.wrapping_add(1);
            }
            std::thread::sleep(Duration::from_millis(150));
        }
    });
}

pub fn is_extended_vk(vk: u8) -> bool {
    matches!(
        vk,
        0x21 | 0x22 | 0x23 | 0x24 | 0x25 | 0x26 | 0x27 | 0x28 | 0x2D | 0x2E | 0x5B | 0x5C
    )
}

#[cfg(windows)]
unsafe fn send_vk_combo(vks: &[u8]) {
    unsafe {
        for &vk in vks {
            let ext = if is_extended_vk(vk) { 0x0001 } else { 0 };
            keybd_event(vk, 0, ext, 0);
            std::thread::sleep(Duration::from_millis(10));
        }
        std::thread::sleep(Duration::from_millis(25));
        for &vk in vks.iter().rev() {
            let ext = if is_extended_vk(vk) { 0x0001 } else { 0 };
            keybd_event(vk, 0, ext | 0x0002, 0);
            std::thread::sleep(Duration::from_millis(10));
        }
    }
}

fn execute_win32_remote_cmd(
    inner_arc: &Arc<Mutex<P2pInner>>,
    jitter_cancel: &Arc<AtomicBool>,
    pkt: &P2pWirePacket,
) -> Result<String, String> {
    let cmd_type = pkt.cmd_type.clone().unwrap_or_default();
    let x_norm = pkt.x_norm.unwrap_or(0.5).clamp(0.0, 1.0);
    let y_norm = pkt.y_norm.unwrap_or(0.5).clamp(0.0, 1.0);

    #[cfg(windows)]
    unsafe {
        let sw = GetSystemMetrics(0).max(800);
        let sh = GetSystemMetrics(1).max(600);
        let px = (x_norm * sw as f64).round() as i32;
        let py = (y_norm * sh as f64).round() as i32;

        match cmd_type.as_str() {
            "mouse_move" => {
                let _ = SetCursorPos(px, py);
                Ok(format!("Moved mouse to ({px}, {py})"))
            }
            "mouse_down" => {
                if pkt.x_norm.is_some() && pkt.y_norm.is_some() {
                    let _ = SetCursorPos(px, py);
                }
                let btn = pkt.button.as_deref().unwrap_or("left");
                match btn {
                    "right" => mouse_event(0x0008, 0, 0, 0, 0),
                    "middle" => mouse_event(0x0020, 0, 0, 0, 0),
                    _ => mouse_event(0x0002, 0, 0, 0, 0),
                }
                Ok(format!("Mouse down ({btn}) at ({px}, {py})"))
            }
            "mouse_up" => {
                if pkt.x_norm.is_some() && pkt.y_norm.is_some() {
                    let _ = SetCursorPos(px, py);
                }
                let btn = pkt.button.as_deref().unwrap_or("left");
                match btn {
                    "right" => mouse_event(0x0010, 0, 0, 0, 0),
                    "middle" => mouse_event(0x0040, 0, 0, 0, 0),
                    _ => mouse_event(0x0004, 0, 0, 0, 0),
                }
                Ok(format!("Mouse up ({btn}) at ({px}, {py})"))
            }
            "mouse_click" => {
                let _ = SetCursorPos(px, py);
                let btn = pkt.button.as_deref().unwrap_or("left");
                if btn == "right" {
                    mouse_event(0x0008, 0, 0, 0, 0);
                    mouse_event(0x0010, 0, 0, 0, 0);
                } else if btn == "middle" {
                    mouse_event(0x0020, 0, 0, 0, 0);
                    mouse_event(0x0040, 0, 0, 0, 0);
                } else {
                    mouse_event(0x0002, 0, 0, 0, 0);
                    mouse_event(0x0004, 0, 0, 0, 0);
                }
                Ok(format!("Remote {btn} click at ({px}, {py})"))
            }
            "mouse_dblclick" => {
                let _ = SetCursorPos(px, py);
                mouse_event(0x0002, 0, 0, 0, 0);
                mouse_event(0x0004, 0, 0, 0, 0);
                std::thread::sleep(Duration::from_millis(35));
                mouse_event(0x0002, 0, 0, 0, 0);
                mouse_event(0x0004, 0, 0, 0, 0);
                Ok(format!("Remote double-click at ({px}, {py})"))
            }
            "mouse_wheel" => {
                if pkt.x_norm.is_some() && pkt.y_norm.is_some() {
                    let _ = SetCursorPos(px, py);
                }
                let delta = pkt.wheel_delta.unwrap_or(-120).clamp(-600, 600);
                mouse_event(0x0800, 0, 0, delta as u32, 0);
                Ok(format!("Mouse wheel ({delta}) at ({px}, {py})"))
            }
            "key_down" => {
                if let Some(vk) = pkt.vk {
                    let ext = if is_extended_vk(vk) { 0x0001 } else { 0 };
                    keybd_event(vk, 0, ext, 0);
                    return Ok(format!("Key down VK 0x{vk:02X}"));
                }
                Ok("No vk code".to_string())
            }
            "key_up" => {
                if let Some(vk) = pkt.vk {
                    let ext = if is_extended_vk(vk) { 0x0001 } else { 0 };
                    keybd_event(vk, 0, ext | 0x0002, 0);
                    return Ok(format!("Key up VK 0x{vk:02X}"));
                }
                Ok("No vk code".to_string())
            }
            "key_press" => {
                if let Some(vk) = pkt.vk {
                    let ext = if is_extended_vk(vk) { 0x0001 } else { 0 };
                    keybd_event(vk, 0, ext, 0);
                    std::thread::sleep(Duration::from_millis(25));
                    keybd_event(vk, 0, ext | 0x0002, 0);
                    return Ok(format!("Pressed VK 0x{vk:02X}"));
                }
                Ok("No vk code".to_string())
            }
            "hotkey" => {
                let hk = pkt.text.as_deref().unwrap_or("");
                match hk {
                    "win_d" => send_vk_combo(&[0x5B, 0x44]),
                    "win_e" => send_vk_combo(&[0x5B, 0x45]),
                    "alt_tab" => send_vk_combo(&[0x12, 0x09]),
                    "task_mgr" => send_vk_combo(&[0x11, 0x10, 0x1B]),
                    "ctrl_c" => send_vk_combo(&[0x11, 0x43]),
                    "ctrl_v" => send_vk_combo(&[0x11, 0x56]),
                    "ctrl_a" => send_vk_combo(&[0x11, 0x41]),
                    "ctrl_z" => send_vk_combo(&[0x11, 0x5A]),
                    "ctrl_w" => send_vk_combo(&[0x11, 0x57]),
                    "alt_f4" => send_vk_combo(&[0x12, 0x73]),
                    "enter" => send_vk_combo(&[0x0D]),
                    "backspace" => send_vk_combo(&[0x08]),
                    "escape" => send_vk_combo(&[0x1B]),
                    "tab" => send_vk_combo(&[0x09]),
                    "space" => send_vk_combo(&[0x20]),
                    other => return Ok(format!("Unknown hotkey: {other}")),
                }
                Ok(format!("Sent hotkey {hk}"))
            }
            "minimize_all" => {
                send_vk_combo(&[0x5B, 0x44]);
                Ok("Sent Win+D minimize shortcut".to_string())
            }
            "type_text" | "open_notepad_taunt" => {
                let text = pkt
                    .text
                    .clone()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| "Duck AI Winner! May ban da bi kiem soat trong 60 giay!".to_string());
                let open_np = cmd_type == "open_notepad_taunt";
                let escaped = text
                    .replace('\'', "''")
                    .replace('{', "{{}")
                    .replace('}', "{}}")
                    .replace('+', "{+}")
                    .replace('^', "{^}")
                    .replace('%', "{%}")
                    .replace('~', "{~}")
                    .replace('(', "{(}")
                    .replace(')', "{)}")
                    .replace('[', "{[}")
                    .replace(']', "{]}");

                std::thread::spawn(move || {
                    if open_np {
                        let mut cmd = std::process::Command::new("cmd.exe");
                        cmd.args(["/C", "start", "notepad.exe"]);
                        apply_no_window(&mut cmd);
                        let _ = cmd.spawn();
                        std::thread::sleep(Duration::from_millis(700));
                    }
                    let ps_script = format!(
                        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{escaped}')"
                    );
                    let mut ps = std::process::Command::new("powershell.exe");
                    ps.args(["-NoProfile", "-NonInteractive", "-Command", &ps_script]);
                    apply_no_window(&mut ps);
                    let _ = ps.output();
                });
                Ok(format!("Typed remote text: {text}"))
            }
            "jitter_mouse" => {
                jitter_cancel.store(false, Ordering::Relaxed);
                let cancel_flag = jitter_cancel.clone();
                let state_ref = inner_arc.clone();
                std::thread::spawn(move || {
                    let cx = sw / 2;
                    let cy = sh / 2;
                    let start = Instant::now();
                    let mut angle: f64 = 0.0;
                    while start.elapsed() < Duration::from_secs(4) {
                        if cancel_flag.load(Ordering::Relaxed) {
                            break;
                        }
                        if let Ok(guard) = state_ref.lock() {
                            if guard.victim_control_until.is_none() {
                                break;
                            }
                        }
                        let rx = cx + (angle.cos() * 210.0) as i32;
                        let ry = cy + (angle.sin() * 140.0) as i32;
                        let _ = SetCursorPos(rx, ry);
                        angle += 0.35;
                        std::thread::sleep(Duration::from_millis(24));
                    }
                });
                Ok("Activated 4s remote mouse swirl".to_string())
            }
            "block_input" => {
                let dur = pkt.duration_sec.unwrap_or(8).clamp(1, 10);
                let res = BlockInput(1);
                let block_gen = {
                    if let Ok(mut guard) = inner_arc.lock() {
                        guard.block_generation = guard.block_generation.wrapping_add(1);
                        guard.block_generation
                    } else {
                        0
                    }
                };
                let state_ref = inner_arc.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(dur));
                    if let Ok(guard) = state_ref.lock() {
                        if guard.block_generation == block_gen {
                            release_win32_block_input();
                        }
                    } else {
                        release_win32_block_input();
                    }
                });
                if res == 0 {
                    // Fallback if Windows UAC blocks BlockInput without admin: briefly pull mouse center for feedback
                    Ok("Requested BlockInput (Windows UAC fallback active)".to_string())
                } else {
                    Ok(format!("Locked victim mouse/keyboard for {dur}s"))
                }
            }
            other => Ok(format!("Unknown remote command: {other}")),
        }
    }

    #[cfg(not(windows))]
    {
        let _ = (inner_arc, jitter_cancel, x_norm, y_norm, cmd_type);
        Err("Chỉ hỗ trợ điều khiển trên Windows".to_string())
    }
}

fn spawn_peer_reader(
    stream: TcpStream,
    inner_arc: Arc<Mutex<P2pInner>>,
    jitter_cancel: Arc<AtomicBool>,
) {
    let _ = stream.set_read_timeout(None);
    std::thread::spawn(move || {
        let reader = BufReader::new(stream);
        for line_res in reader.lines() {
            let line = match line_res {
                Ok(l) => l,
                Err(_) => break,
            };
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let pkt: P2pWirePacket = match serde_json::from_str(trimmed) {
                Ok(p) => p,
                Err(_) => continue,
            };

            match pkt.kind.as_str() {
                "handshake_accept" => {
                    if let Ok(mut guard) = inner_arc.lock() {
                        guard.phase = "connected".to_string();
                        if let Some(ref name) = pkt.peer_name {
                            guard.peer_name = name.clone();
                        }
                        if let Some(ref bc) = pkt.body_color {
                            guard.peer_body_color = bc.clone();
                        }
                        if let Some(ref ac) = pkt.accent_color {
                            guard.peer_accent_color = ac.clone();
                        }
                        emit_p2p(
                            &guard,
                            "handshake_accepted",
                            Some(pkt.clone()),
                            Some(format!("Đối thủ {} đã đồng ý Handshake!", guard.peer_name)),
                        );
                    }
                }
                "handshake_reject" => {
                    if let Ok(mut guard) = inner_arc.lock() {
                        guard.active_stream = None;
                        guard.phase = "hosting".to_string();
                        let reason = pkt
                            .reason
                            .clone()
                            .unwrap_or_else(|| "Đối thủ đã từ chối kết nối.".to_string());
                        emit_p2p(&guard, "handshake_rejected", Some(pkt.clone()), Some(reason));
                    }
                    break;
                }
                "migrate_enter" => {
                    if let Ok(mut guard) = inner_arc.lock() {
                        if let Some(ref name) = pkt.peer_name {
                            guard.peer_name = name.clone();
                        }
                        if let Some(ref bc) = pkt.body_color {
                            guard.peer_body_color = bc.clone();
                        }
                        if let Some(ref ac) = pkt.accent_color {
                            guard.peer_accent_color = ac.clone();
                        }
                        emit_p2p(&guard, "peer_migrated_in", Some(pkt.clone()), None);
                    }
                }
                "migrate_return" => {
                    if let Ok(guard) = inner_arc.lock() {
                        emit_p2p(&guard, "peer_migrated_return", Some(pkt.clone()), None);
                    }
                }
                "state_sync" => {
                    if let Ok(mut guard) = inner_arc.lock() {
                        if let Some(ref wj) = pkt.windows_json {
                            guard.host_windows_json = wj.clone();
                        }
                        emit_p2p(&guard, "peer_state_sync", Some(pkt.clone()), None);
                    }
                }
                "map_request" => {
                    if let Ok(guard) = inner_arc.lock() {
                        emit_p2p(&guard, "map_request", Some(pkt.clone()), None);
                    }
                }
                "map_windows" => {
                    if let Ok(mut guard) = inner_arc.lock() {
                        if let Some(ref wj) = pkt.windows_json {
                            guard.host_windows_json = wj.clone();
                        }
                        emit_p2p(&guard, "host_map_sync", Some(pkt.clone()), None);
                    }
                }
                "remote_frame" => {
                    if let Ok(mut guard) = inner_arc.lock() {
                        if let Some(ref b64) = pkt.frame_b64 {
                            guard.remote_frame_b64 = b64.clone();
                        }
                        if let Some(fw) = pkt.frame_w {
                            guard.remote_frame_w = fw;
                        }
                        if let Some(fh) = pkt.frame_h {
                            guard.remote_frame_h = fh;
                        }
                        guard.remote_frame_seq = pkt.frame_seq.unwrap_or_else(|| guard.remote_frame_seq.wrapping_add(1));
                        if let Some(cx) = pkt.x_ratio {
                            guard.remote_cursor_x = cx;
                        }
                        if let Some(cy) = pkt.y_ratio {
                            guard.remote_cursor_y = cy;
                        }
                        emit_p2p(&guard, "remote_frame", Some(pkt.clone()), None);
                    }
                }
                "blackhole_hide" => {
                    if let Ok(guard) = inner_arc.lock() {
                        emit_p2p(&guard, "peer_blackhole_hide", Some(pkt.clone()), None);
                    }
                }
                "pk_foods_sync" => {
                    if let Ok(mut guard) = inner_arc.lock() {
                        if let Some(ref fj) = pkt.foods_json {
                            guard.pk_foods_json = fj.clone();
                        }
                        emit_p2p(&guard, "pk_foods_sync", Some(pkt.clone()), None);
                    }
                }
                "pk_food_pickup" => {
                    if let Ok(guard) = inner_arc.lock() {
                        emit_p2p(&guard, "pk_food_pickup", Some(pkt.clone()), None);
                    }
                }
                "pk_start" => {
                    if let Ok(mut guard) = inner_arc.lock() {
                        guard.phase = "pk_duel".to_string();
                        guard.pc_energy = 100;
                        guard.peer_energy = 100;
                        guard.pk_foods_json = "[]".to_string();
                        if let Some(ref wj) = pkt.windows_json {
                            guard.host_windows_json = wj.clone();
                        }
                        guard.remote_frame_b64.clear();
                        guard.remote_frame_w = 0;
                        guard.remote_frame_h = 0;
                        guard.remote_frame_seq = 0;
                        guard.winner_control_until = None;
                        guard.victim_control_until = None;
                        emit_p2p(&guard, "pk_started", Some(pkt.clone()), None);
                    }
                }
                "pk_attack" => {
                    if let Ok(guard) = inner_arc.lock() {
                        emit_p2p(&guard, "pk_attack", Some(pkt.clone()), None);
                    }
                }
                "pk_finish" => {
                    let winner_is_sender = pkt.winner_is_sender.unwrap_or(false);
                    let mut should_stream_screen = false;
                    if let Ok(mut guard) = inner_arc.lock() {
                        guard.remote_frame_b64.clear();
                        guard.remote_frame_w = 0;
                        guard.remote_frame_h = 0;
                        guard.remote_frame_seq = 0;
                        if winner_is_sender {
                            guard.phase = "victim_controlled".to_string();
                            guard.victim_control_until =
                                Some(Instant::now() + Duration::from_secs(60));
                            guard.winner_control_until = None;
                            should_stream_screen = !guard.is_sim_mode && !guard.is_web_peer;
                        } else {
                            guard.phase = "winner_control".to_string();
                            guard.winner_control_until =
                                Some(Instant::now() + Duration::from_secs(60));
                            guard.victim_control_until = None;
                        }
                        emit_p2p(&guard, "pk_finished", Some(pkt.clone()), None);
                    }
                    if should_stream_screen {
                        spawn_victim_screen_streamer(inner_arc.clone());
                    }
                }
                "remote_cmd" => {
                    let allowed = {
                        if let Ok(mut guard) = inner_arc.lock() {
                            if let Some(until) = guard.victim_control_until {
                                if Instant::now() < until {
                                    true
                                } else {
                                    guard.victim_control_until = None;
                                    guard.phase = "connected".to_string();
                                    false
                                }
                            } else {
                                false
                            }
                        } else {
                            false
                        }
                    };
                    if allowed {
                        let res_msg = execute_win32_remote_cmd(&inner_arc, &jitter_cancel, &pkt)
                            .unwrap_or_else(|e| e);
                        if let Ok(guard) = inner_arc.lock() {
                            emit_p2p(&guard, "remote_executed", Some(pkt.clone()), Some(res_msg));
                        }
                    }
                }
                "disconnect" => {
                    break;
                }
                _ => {}
            }
        }

        release_win32_block_input();
        jitter_cancel.store(true, Ordering::Relaxed);
        if let Ok(mut guard) = inner_arc.lock() {
            guard.active_stream = None;
            guard.is_room_host = false;
            guard.host_windows_json = "[]".to_string();
            guard.pk_foods_json = "[]".to_string();
            guard.remote_frame_b64.clear();
            guard.remote_frame_w = 0;
            guard.remote_frame_h = 0;
            guard.remote_frame_seq = 0;
            guard.pc_energy = 100;
            guard.peer_energy = 100;
            guard.pc_hidden = false;
            guard.pc_shielding = false;
            guard.pc_jetpack = false;
            guard.pc_sliding = false;
            guard.victim_control_until = None;
            guard.winner_control_until = None;
            if guard.phase != "hosting" {
                guard.phase = "hosting".to_string();
                guard.peer_name.clear();
                guard.peer_addr.clear();
                emit_p2p(
                    &guard,
                    "peer_disconnected",
                    None,
                    Some("Kết nối P2P đã đóng.".to_string()),
                );
            }
        }
    });
}

const MOBILE_WEB_HTML: &str = include_str!("mobile_web.html");
const MOBILE_DECK_HTML: &str = include_str!("mobile_deck.html");

fn extract_query_param(raw_path: &str, key: &str) -> Option<String> {
    let (_, qs) = raw_path.split_once('?')?;
    for pair in qs.split('&') {
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        if k == key {
            return Some(v.replace('+', " "));
        }
    }
    None
}

#[derive(Serialize, Clone, Debug)]
struct WebArenaStateJson {
    status: P2pStatus,
    host_windows_json: String,
    pc_x_ratio: f64,
    pc_y_ratio: f64,
    pc_walk_dir: i32,
    pc_state: String,
    pc_weapon: String,
    pc_hp: i32,
    peer_hp: i32,
    pc_energy: i32,
    peer_energy: i32,
    pk_foods_json: String,
    pc_migrated_out: bool,
    pc_hidden: bool,
    pc_shielding: bool,
    pc_jetpack: bool,
    pc_sliding: bool,
    last_pc_skill: String,
    last_pc_skill_seq: u64,
    last_pc_aim_x: f64,
    last_pc_aim_y: f64,
}

fn send_http_response(
    stream: &mut TcpStream,
    status_line: &str,
    content_type: &str,
    body: &str,
) {
    let bytes = body.as_bytes();
    let header = format!(
        "HTTP/1.1 {status_line}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nConnection: close\r\n\r\n",
        bytes.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(bytes);
    let _ = stream.flush();
}

fn handle_http_client(
    reader: &mut BufReader<TcpStream>,
    mut write_stream: TcpStream,
    first_line: &str,
    peer_addr_str: &str,
    inner_arc: &Arc<Mutex<P2pInner>>,
    jitter_cancel: &Arc<AtomicBool>,
) {
    let parts: Vec<&str> = first_line.trim().split_whitespace().collect();
    if parts.len() < 2 {
        return;
    }
    let method = parts[0];
    let raw_path = parts[1];
    let path = raw_path.split('?').next().unwrap_or(raw_path);

    let mut content_length: usize = 0;
    loop {
        let mut hline = String::new();
        match reader.read_line(&mut hline) {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let t = hline.trim();
                if t.is_empty() {
                    break;
                }
                if let Some((k, v)) = t.split_once(':') {
                    if k.trim().eq_ignore_ascii_case("Content-Length") {
                        content_length = v.trim().parse::<usize>().unwrap_or(0).min(131_072);
                    }
                }
            }
        }
    }

    if method == "OPTIONS" {
        send_http_response(&mut write_stream, "204 No Content", "text/plain", "");
        return;
    }

    let is_home_path = path == "/" || path == "/index.html" || path == "/mobile" || path == "/arena";

    if method == "HEAD" && is_home_path {
        let header = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
            MOBILE_WEB_HTML.len()
        );
        let _ = write_stream.write_all(header.as_bytes());
        let _ = write_stream.flush();
        return;
    }

    if method == "GET" && is_home_path {
        send_http_response(
            &mut write_stream,
            "200 OK",
            "text/html; charset=utf-8",
            MOBILE_WEB_HTML,
        );
        return;
    }

    if method == "GET" && path == "/deck" {
        send_http_response(
            &mut write_stream,
            "200 OK",
            "text/html; charset=utf-8",
            MOBILE_DECK_HTML,
        );
        return;
    }

    if path.starts_with("/api/deck/") {
        let mut body_buf = vec![0u8; content_length];
        if method == "POST" && content_length > 0 && reader.read_exact(&mut body_buf).is_err() {
            send_http_response(
                &mut write_stream,
                "400 Bad Request",
                "application/json; charset=utf-8",
                r#"{"ok":false,"error":"Body read error"}"#,
            );
            return;
        }
        let body_json: serde_json::Value = if !body_buf.is_empty() {
            serde_json::from_slice(&body_buf).unwrap_or_else(|_| serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        let supplied_pin = extract_query_param(raw_path, "pin")
            .or_else(|| {
                body_json
                    .get("pin")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_default();

        let (app_handle, expected_pin, host_name) = {
            let guard = inner_arc.lock().unwrap();
            (
                guard.app.clone(),
                guard.room_code.clone(),
                guard.local_name.clone(),
            )
        };

        if supplied_pin.trim() != expected_pin {
            send_http_response(
                &mut write_stream,
                "401 Unauthorized",
                "application/json; charset=utf-8",
                r#"{"ok":false,"error":"Mã PIN không đúng. Hãy quét lại mã QR trên máy tính."}"#,
            );
            return;
        }

        if method == "GET" && path == "/api/deck/status" {
            let hb = app_handle.state::<Arc<crate::core::hitbox::HitboxState>>();
            let peak = hb.audio_peak_milli.load(Ordering::Relaxed) as f32 / 1000.0;
            let bpm = hb.audio_bpm.load(Ordering::Relaxed);
            let resp = serde_json::json!({
                "ok": true,
                "host_name": host_name,
                "audio_peak": peak,
                "audio_bpm": bpm,
            });
            send_http_response(
                &mut write_stream,
                "200 OK",
                "application/json; charset=utf-8",
                &resp.to_string(),
            );
            return;
        }

        if method == "GET" && path == "/api/deck/screenshot" {
            let resp = match crate::backend::pc_control::deck_capture_jpeg_b64_sync() {
                Ok(b64) => serde_json::json!({ "ok": true, "image_base64": b64 }),
                Err(e) => serde_json::json!({ "ok": false, "error": e }),
            };
            send_http_response(
                &mut write_stream,
                "200 OK",
                "application/json; charset=utf-8",
                &resp.to_string(),
            );
            return;
        }

        if path == "/api/deck/vocab" {
            let mem_state = app_handle.state::<crate::backend::memory::MemoryState>();
            if method == "GET" {
                let items =
                    crate::backend::memory::vocab_list_words(mem_state, Some(60)).unwrap_or_default();
                let featured = items.first().cloned().unwrap_or_else(|| {
                    let idx = (SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_secs() as usize)
                        .unwrap_or(0))
                        % crate::backend::english_offline_deck::OFFLINE_ENGLISH_DECK.len();
                    crate::backend::english_offline_deck::OFFLINE_ENGLISH_DECK[idx].to_item()
                });
                let resp = serde_json::json!({
                    "ok": true,
                    "items": items,
                    "featured": featured,
                });
                send_http_response(
                    &mut write_stream,
                    "200 OK",
                    "application/json; charset=utf-8",
                    &resp.to_string(),
                );
                return;
            }

            let act = body_json
                .get("action")
                .and_then(|v| v.as_str())
                .unwrap_or("draw");
            let resp = match act {
                "draw" => {
                    let deck = crate::backend::english_offline_deck::OFFLINE_ENGLISH_DECK;
                    let nanos = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.subsec_nanos() as usize)
                        .unwrap_or(7);
                    let card = deck[nanos % deck.len()].to_item();
                    serde_json::json!({ "ok": true, "card": card })
                }
                "review" => {
                    let word = body_json
                        .get("word")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let quality = body_json
                        .get("quality")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(4) as i32;
                    if let Some(item_val) = body_json.get("item") {
                        if let Ok(parsed_item) = serde_json::from_value::<
                            crate::backend::telemetry::EnglishVocabItem,
                        >(item_val.clone())
                        {
                            let _ = crate::backend::memory::vocab_save_word(
                                app_handle.state::<crate::backend::memory::MemoryState>(),
                                parsed_item,
                            );
                        }
                    }
                    match crate::backend::memory::vocab_record_review(mem_state, word.clone(), quality)
                    {
                        Ok(updated) => {
                            let _ = app_handle.emit(
                                "desktop-mate://mobile-deck-cmd",
                                serde_json::json!({ "action": "vocab_updated", "word": word }),
                            );
                            serde_json::json!({
                                "ok": true,
                                "item": updated,
                                "message": format!("[SRS] Đã lưu điểm ôn tập ({quality}/5) cho '{word}'.")
                            })
                        }
                        Err(e) => serde_json::json!({ "ok": false, "error": e }),
                    }
                }
                "speak_pc" => {
                    let word = body_json
                        .get("word")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let _ = app_handle.emit(
                        "desktop-mate://mobile-deck-cmd",
                        serde_json::json!({ "action": "speak_word", "text": word }),
                    );
                    serde_json::json!({ "ok": true, "message": format!("[TTS PC] Vịt đang phát âm '{word}' trên máy tính.") })
                }
                _ => serde_json::json!({ "ok": false, "error": "Unsupported vocab action" }),
            };
            send_http_response(
                &mut write_stream,
                "200 OK",
                "application/json; charset=utf-8",
                &resp.to_string(),
            );
            return;
        }

        if method == "POST" && path == "/api/deck/action" {
            let act = body_json
                .get("action")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let text = body_json
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();

            let resp = match act {
                "push_clipboard" => match crate::backend::pc_control::deck_set_clipboard_sync(text) {
                    Ok(m) => serde_json::json!({ "ok": true, "message": m }),
                    Err(e) => serde_json::json!({ "ok": false, "error": e }),
                },
                "pull_clipboard" => match crate::backend::pc_control::deck_get_clipboard_sync() {
                    Ok(c) => serde_json::json!({ "ok": true, "clipboard": c }),
                    Err(e) => serde_json::json!({ "ok": false, "error": e }),
                },
                "open_url" => match crate::backend::pc_control::open_web_or_app(text.to_string()) {
                    Ok(m) => serde_json::json!({ "ok": true, "message": m }),
                    Err(e) => serde_json::json!({ "ok": false, "error": e }),
                },
                "beat_dance" | "send_chat" => {
                    let _ = app_handle.emit(
                        "desktop-mate://mobile-deck-cmd",
                        serde_json::json!({ "action": act, "text": text }),
                    );
                    let msg = if act == "beat_dance" {
                        "Đã bật chế độ Vịt Nhảy Theo Nhạc 3D trên máy tính!"
                    } else {
                        "Đã gửi tin nhắn sang Duck AI trên máy tính!"
                    };
                    serde_json::json!({ "ok": true, "message": msg })
                }
                _ => match crate::backend::pc_control::deck_system_action_sync(act) {
                    Ok(m) => serde_json::json!({ "ok": true, "message": m }),
                    Err(e) => serde_json::json!({ "ok": false, "error": e }),
                },
            };
            send_http_response(
                &mut write_stream,
                "200 OK",
                "application/json; charset=utf-8",
                &resp.to_string(),
            );
            return;
        }
    }

    if method == "GET" && path == "/favicon.ico" {
        send_http_response(&mut write_stream, "204 No Content", "image/x-icon", "");
        return;
    }

    if method == "GET" && path == "/api/ping" {
        send_http_response(
            &mut write_stream,
            "200 OK",
            "application/json; charset=utf-8",
            r#"{"ok":true}"#,
        );
        return;
    }

    if method == "GET" && path == "/api/state" {
        let snapshot = {
            let mut guard = inner_arc.lock().unwrap();
            refresh_expired_timers(&mut guard);
            WebArenaStateJson {
                status: build_status(&guard),
                host_windows_json: guard.host_windows_json.clone(),
                pc_x_ratio: guard.pc_x_ratio,
                pc_y_ratio: guard.pc_y_ratio,
                pc_walk_dir: guard.pc_walk_dir,
                pc_state: guard.pc_state.clone(),
                pc_weapon: guard.pc_weapon.clone(),
                pc_hp: guard.pc_hp,
                peer_hp: guard.peer_hp,
                pc_energy: guard.pc_energy,
                peer_energy: guard.peer_energy,
                pk_foods_json: guard.pk_foods_json.clone(),
                pc_migrated_out: guard.pc_migrated_out,
                pc_hidden: guard.pc_hidden,
                pc_shielding: guard.pc_shielding,
                pc_jetpack: guard.pc_jetpack,
                pc_sliding: guard.pc_sliding,
                last_pc_skill: guard.last_pc_skill.clone(),
                last_pc_skill_seq: guard.last_pc_skill_seq,
                last_pc_aim_x: guard.last_pc_aim_x,
                last_pc_aim_y: guard.last_pc_aim_y,
            }
        };
        let json = serde_json::to_string(&snapshot).unwrap_or_else(|_| "{}".to_string());
        send_http_response(
            &mut write_stream,
            "200 OK",
            "application/json; charset=utf-8",
            &json,
        );
        return;
    }

    if method == "POST" && path == "/api/p2p" {
        let mut body_buf = vec![0u8; content_length];
        if content_length > 0 && reader.read_exact(&mut body_buf).is_err() {
            send_http_response(
                &mut write_stream,
                "400 Bad Request",
                "application/json",
                r#"{"ok":false,"error":"Read body error"}"#,
            );
            return;
        }
        let body_str = String::from_utf8_lossy(&body_buf);
        let pkt: P2pWirePacket = match serde_json::from_str(body_str.trim()) {
            Ok(p) => p,
            Err(_) => {
                send_http_response(
                    &mut write_stream,
                    "400 Bad Request",
                    "application/json",
                    r#"{"ok":false,"error":"Invalid JSON"}"#,
                );
                return;
            }
        };

        let peer_ip = peer_addr_str.split(':').next().unwrap_or(peer_addr_str);
        match pkt.kind.as_str() {
            "handshake_req" => {
                let mut guard = inner_arc.lock().unwrap();
                let req_code = pkt.room_code.clone().unwrap_or_default();
                if req_code != guard.room_code {
                    send_http_response(
                        &mut write_stream,
                        "200 OK",
                        "application/json; charset=utf-8",
                        r#"{"ok":false,"error":"Sai ma phong (Room Code)!"}"#,
                    );
                    return;
                }
                let occupied_by_other = guard.active_stream.is_some()
                    || guard.pending_stream.is_some()
                    || (!guard.is_web_peer
                        && (guard.phase == "connected"
                            || guard.phase == "pk_duel"
                            || guard.phase == "winner_control"
                            || guard.phase == "victim_controlled"));
                if occupied_by_other {
                    send_http_response(
                        &mut write_stream,
                        "200 OK",
                        "application/json; charset=utf-8",
                        r#"{"ok":false,"error":"Phong nay dang co nguoi ket noi!"}"#,
                    );
                    return;
                }
                guard.is_web_peer = true;
                guard.is_sim_mode = false;
                guard.pending_peer_name = pkt
                    .peer_name
                    .clone()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| "MobileDuck".to_string());
                guard.pending_peer_addr = format!("{peer_ip} (Mobile Web)");
                guard.pending_body_color = pkt
                    .body_color
                    .clone()
                    .unwrap_or_else(|| "#312e81".to_string());
                guard.pending_accent_color = pkt
                    .accent_color
                    .clone()
                    .unwrap_or_else(|| "#f43f5e".to_string());
                guard.pending_stream = None;
                guard.phase = "incoming_consent".to_string();

                let pname = guard.pending_peer_name.clone();
                let paddr = guard.pending_peer_addr.clone();
                emit_p2p(
                    &guard,
                    "incoming_handshake",
                    Some(pkt),
                    Some(format!("{pname} ({paddr}) muon ket noi vao phong PK!")),
                );
                send_http_response(
                    &mut write_stream,
                    "200 OK",
                    "application/json; charset=utf-8",
                    r#"{"ok":true,"phase":"incoming_consent"}"#,
                );
                return;
            }
            "migrate_enter" => {
                let mut guard = inner_arc.lock().unwrap();
                if let Some(ref name) = pkt.peer_name {
                    guard.peer_name = name.clone();
                }
                if let Some(ref bc) = pkt.body_color {
                    guard.peer_body_color = bc.clone();
                }
                if let Some(ref ac) = pkt.accent_color {
                    guard.peer_accent_color = ac.clone();
                }
                emit_p2p(&guard, "peer_migrated_in", Some(pkt), None);
                send_http_response(&mut write_stream, "200 OK", "application/json", r#"{"ok":true}"#);
                return;
            }
            "migrate_return" => {
                let guard = inner_arc.lock().unwrap();
                emit_p2p(&guard, "peer_migrated_return", Some(pkt), None);
                send_http_response(&mut write_stream, "200 OK", "application/json", r#"{"ok":true}"#);
                return;
            }
            "state_sync" => {
                let mut guard = inner_arc.lock().unwrap();
                if let Some(en) = pkt.energy {
                    guard.peer_energy = en;
                }
                emit_p2p(&guard, "peer_state_sync", Some(pkt), None);
                send_http_response(&mut write_stream, "200 OK", "application/json", r#"{"ok":true}"#);
                return;
            }
            "pk_start" => {
                let mut guard = inner_arc.lock().unwrap();
                guard.phase = "pk_duel".to_string();
                guard.winner_control_until = None;
                guard.victim_control_until = None;
                guard.pc_hp = 100;
                guard.peer_hp = 100;
                guard.pc_energy = 100;
                guard.peer_energy = 100;
                guard.pk_foods_json = "[]".to_string();
                emit_p2p(&guard, "pk_started", Some(pkt), None);
                send_http_response(&mut write_stream, "200 OK", "application/json", r#"{"ok":true}"#);
                return;
            }
            "pk_attack" => {
                let guard = inner_arc.lock().unwrap();
                emit_p2p(&guard, "pk_attack", Some(pkt), None);
                send_http_response(&mut write_stream, "200 OK", "application/json", r#"{"ok":true}"#);
                return;
            }
            "blackhole_hide" => {
                let guard = inner_arc.lock().unwrap();
                emit_p2p(&guard, "peer_blackhole_hide", Some(pkt), None);
                send_http_response(&mut write_stream, "200 OK", "application/json", r#"{"ok":true}"#);
                return;
            }
            "pk_food_pickup" => {
                let guard = inner_arc.lock().unwrap();
                emit_p2p(&guard, "pk_food_pickup", Some(pkt), None);
                send_http_response(&mut write_stream, "200 OK", "application/json", r#"{"ok":true}"#);
                return;
            }
            "remote_cmd" => {
                let allowed = {
                    let mut guard = inner_arc.lock().unwrap();
                    refresh_expired_timers(&mut guard);
                    guard.victim_control_until.is_some()
                };
                if allowed {
                    let res_msg = execute_win32_remote_cmd(inner_arc, jitter_cancel, &pkt)
                        .unwrap_or_else(|e| e);
                    if let Ok(guard) = inner_arc.lock() {
                        emit_p2p(&guard, "remote_executed", Some(pkt), Some(res_msg.clone()));
                    }
                    let resp = serde_json::json!({ "ok": true, "msg": res_msg }).to_string();
                    send_http_response(&mut write_stream, "200 OK", "application/json", &resp);
                } else {
                    send_http_response(
                        &mut write_stream,
                        "200 OK",
                        "application/json",
                        r#"{"ok":false,"error":"Het 60s quyen kiem soat hoac chua thang PK"}"#,
                    );
                }
                return;
            }
            "disconnect" => {
                release_win32_block_input();
                jitter_cancel.store(true, Ordering::Relaxed);
                let mut guard = inner_arc.lock().unwrap();
                guard.is_web_peer = false;
                guard.victim_control_until = None;
                guard.winner_control_until = None;
                guard.phase = "hosting".to_string();
                guard.peer_name.clear();
                guard.peer_addr.clear();
                emit_p2p(
                    &guard,
                    "peer_disconnected",
                    None,
                    Some("Thiet bi Mobile Web da ngat ket noi.".to_string()),
                );
                send_http_response(&mut write_stream, "200 OK", "application/json", r#"{"ok":true}"#);
                return;
            }
            _ => {
                send_http_response(&mut write_stream, "200 OK", "application/json", r#"{"ok":true}"#);
                return;
            }
        }
    }

    send_http_response(
        &mut write_stream,
        "404 Not Found",
        "text/plain",
        "Not Found",
    );
}

fn handle_incoming_tcp_connection(
    mut stream: TcpStream,
    inner_arc: Arc<Mutex<P2pInner>>,
    jitter_cancel: Arc<AtomicBool>,
) {
    let peer_addr_str = stream
        .peer_addr()
        .map(|a| a.to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let _ = stream.set_nodelay(true);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(4)));

    let cloned_read = match stream.try_clone() {
        Ok(c) => c,
        Err(_) => return,
    };
    let mut reader = BufReader::new(cloned_read);
    let mut first_buf: Vec<u8> = Vec::with_capacity(512);
    if reader.read_until(b'\n', &mut first_buf).is_err() || first_buf.is_empty() {
        return;
    }

    // Abort cleanly if a client accidentally initiates HTTPS/TLS ClientHello (0x16) on plain HTTP port
    if first_buf[0] == 0x16 {
        return;
    }

    let first_line = String::from_utf8_lossy(&first_buf).to_string();

    // Detect Mobile / Desktop Browser HTTP request on same port
    if first_line.starts_with("GET ")
        || first_line.starts_with("POST ")
        || first_line.starts_with("OPTIONS ")
        || first_line.starts_with("HEAD ")
    {
        handle_http_client(
            &mut reader,
            stream,
            &first_line,
            &peer_addr_str,
            &inner_arc,
            &jitter_cancel,
        );
        return;
    }

    let _ = stream.set_read_timeout(None);

    let pkt: P2pWirePacket = match serde_json::from_str(first_line.trim()) {
        Ok(p) => p,
        Err(_) => return,
    };

    if pkt.kind != "handshake_req" {
        return;
    }

    if let Ok(mut guard) = inner_arc.lock() {
        let req_code = pkt.room_code.clone().unwrap_or_default();
        if req_code != guard.room_code {
            let reject = P2pWirePacket {
                kind: "handshake_reject".to_string(),
                reason: Some("Sai mã phòng (Room Code)!".to_string()),
                ..Default::default()
            };
            let _ = send_json_line(&mut stream, &reject);
            return;
        }

        if guard.active_stream.is_some() || guard.pending_stream.is_some() || guard.is_web_peer {
            let reject = P2pWirePacket {
                kind: "handshake_reject".to_string(),
                reason: Some("Máy này đang ở trong phòng hoặc đang chờ xác nhận!".to_string()),
                ..Default::default()
            };
            let _ = send_json_line(&mut stream, &reject);
            return;
        }

        guard.is_web_peer = false;
        guard.pending_peer_name = pkt
            .peer_name
            .clone()
            .unwrap_or_else(|| "Duck Challenger".to_string());
        guard.pending_peer_addr = peer_addr_str.clone();
        guard.pending_body_color = pkt
            .body_color
            .clone()
            .unwrap_or_else(|| "#312e81".to_string());
        guard.pending_accent_color = pkt
            .accent_color
            .clone()
            .unwrap_or_else(|| "#f43f5e".to_string());
        guard.pending_stream = Some(stream);
        guard.phase = "incoming_consent".to_string();

        let pname = guard.pending_peer_name.clone();
        emit_p2p(
            &guard,
            "incoming_handshake",
            Some(pkt),
            Some(format!("{pname} ({peer_addr_str}) muốn kết nối vào phòng PK!")),
        );
    }
}

fn spawn_tcp_server(inner_arc: Arc<Mutex<P2pInner>>, jitter_cancel: Arc<AtomicBool>) {
    let mut bound_listener: Option<TcpListener> = None;
    let mut chosen_port: u16 = 39282;

    for port in 39282..=39290 {
        if let Ok(l) = TcpListener::bind(("0.0.0.0", port)) {
            chosen_port = port;
            bound_listener = Some(l);
            break;
        }
    }

    if let Ok(mut guard) = inner_arc.lock() {
        guard.listen_port = chosen_port;
        guard.phase = if bound_listener.is_some() {
            "hosting".to_string()
        } else {
            "disconnected".to_string()
        };
    }

    let listener = match bound_listener {
        Some(l) => l,
        None => return,
    };

    std::thread::spawn(move || {
        for stream_res in listener.incoming() {
            let stream = match stream_res {
                Ok(s) => s,
                Err(_) => continue,
            };
            let inner_c = inner_arc.clone();
            let jc_c = jitter_cancel.clone();
            std::thread::spawn(move || {
                handle_incoming_tcp_connection(stream, inner_c, jc_c);
            });
        }
    });
}

impl P2pState {
    pub fn new(app: AppHandle) -> Self {
        let lan_ips = detect_lan_ipv4_candidates();
        let local_ip = lan_ips
            .first()
            .cloned()
            .unwrap_or_else(|| "127.0.0.1".to_string());
        let room_code = generate_room_code();
        let local_name = get_pc_username();

        let inner = Arc::new(Mutex::new(P2pInner {
            app,
            local_ip,
            lan_ips,
            listen_port: 39282,
            local_name,
            room_code,
            phase: "hosting".to_string(),
            peer_name: String::new(),
            peer_addr: String::new(),
            peer_body_color: "#312e81".to_string(),
            peer_accent_color: "#f43f5e".to_string(),
            pending_peer_name: String::new(),
            pending_peer_addr: String::new(),
            pending_body_color: "#312e81".to_string(),
            pending_accent_color: "#f43f5e".to_string(),
            pending_stream: None,
            active_stream: None,
            winner_control_until: None,
            victim_control_until: None,
            is_sim_mode: false,
            is_web_peer: false,
            is_room_host: false,
            host_windows_json: "[]".to_string(),
            pc_x_ratio: 0.5,
            pc_y_ratio: 0.9,
            pc_walk_dir: 1,
            pc_state: "IDLE".to_string(),
            pc_weapon: "none".to_string(),
            pc_hp: 100,
            peer_hp: 100,
            pc_energy: 100,
            peer_energy: 100,
            pk_foods_json: "[]".to_string(),
            pc_migrated_out: false,
            pc_hidden: false,
            pc_shielding: false,
            pc_jetpack: false,
            pc_sliding: false,
            last_pc_skill: String::new(),
            last_pc_skill_seq: 0,
            last_pc_aim_x: 0.5,
            last_pc_aim_y: 0.5,
            block_generation: 0,
            remote_frame_b64: String::new(),
            remote_frame_w: 0,
            remote_frame_h: 0,
            remote_frame_seq: 0,
            remote_cursor_x: 0.5,
            remote_cursor_y: 0.5,
        }));

        let jitter_cancel = Arc::new(AtomicBool::new(false));
        spawn_tcp_server(inner.clone(), jitter_cancel.clone());

        Self {
            inner,
            jitter_cancel,
        }
    }
}

#[tauri::command]
pub fn p2p_get_status(state: State<'_, P2pState>) -> P2pStatus {
    let mut guard = state.inner.lock().unwrap();
    if guard.local_ip == "127.0.0.1" || guard.lan_ips.is_empty() {
        let lan_ips = detect_lan_ipv4_candidates();
        if let Some(first) = lan_ips.first().cloned() {
            guard.local_ip = first;
        }
        guard.lan_ips = lan_ips;
    }
    refresh_expired_timers(&mut guard);
    build_status(&guard)
}

#[tauri::command]
pub fn p2p_regenerate_room(state: State<'_, P2pState>) -> P2pStatus {
    let mut guard = state.inner.lock().unwrap();
    let lan_ips = detect_lan_ipv4_candidates();
    if let Some(first) = lan_ips.first().cloned() {
        guard.local_ip = first;
    }
    guard.lan_ips = lan_ips;
    guard.room_code = generate_room_code();
    build_status(&guard)
}

#[tauri::command]
pub fn p2p_scan_local_peers(state: State<'_, P2pState>) -> Vec<LanPeerInfo> {
    let (local_ip, my_port) = {
        let guard = state.inner.lock().unwrap();
        (guard.local_ip.clone(), guard.listen_port)
    };

    let mut found = Vec::new();
    let mut hosts = vec!["127.0.0.1".to_string()];
    if local_ip != "127.0.0.1" {
        hosts.push(local_ip);
    }

    for host in hosts {
        for port in 39282..=39286 {
            if (host == "127.0.0.1" || host == state.inner.lock().unwrap().local_ip) && port == my_port {
                continue;
            }
            if let Ok(addr) = format!("{host}:{port}").parse::<SocketAddr>() {
                if TcpStream::connect_timeout(&addr, Duration::from_millis(85)).is_ok() {
                    found.push(LanPeerInfo {
                        name: format!("DuckMate @{host}:{port}"),
                        addr: format!("{host}:{port}"),
                        port,
                    });
                }
            }
        }
    }
    found
}

#[tauri::command]
pub fn p2p_request_handshake(
    state: State<'_, P2pState>,
    target_addr: String,
    room_code: String,
    local_name: String,
    body_color: String,
    accent_color: String,
) -> Result<P2pStatus, String> {
    let cleaned_addr = target_addr.trim().to_string();
    let full_addr = if cleaned_addr.contains(':') {
        cleaned_addr
    } else {
        format!("{cleaned_addr}:39282")
    };

    let sock_addr: SocketAddr = full_addr
        .parse()
        .map_err(|_| format!("Địa chỉ IP:Port không hợp lệ: {full_addr}"))?;

    let mut stream = TcpStream::connect_timeout(&sock_addr, Duration::from_secs(4))
        .map_err(|e| format!("Không thể kết nối tới {full_addr}: {e}"))?;

    let pkt = P2pWirePacket {
        kind: "handshake_req".to_string(),
        room_code: Some(room_code.trim().to_string()),
        peer_name: Some(local_name.trim().to_string()),
        body_color: Some(body_color),
        accent_color: Some(accent_color),
        ..Default::default()
    };
    send_json_line(&mut stream, &pkt)?;

    let reader_stream = stream.try_clone().map_err(|e| format!("Clone TCP err: {e}"))?;
    let status_out = {
        let mut guard = state.inner.lock().unwrap();
        guard.is_sim_mode = false;
        guard.is_web_peer = false;
        guard.is_room_host = false;
        guard.active_stream = Some(stream);
        guard.peer_addr = full_addr.clone();
        guard.peer_name = format!("Peer ({full_addr})");
        guard.phase = "waiting_consent".to_string();
        build_status(&guard)
    };

    spawn_peer_reader(
        reader_stream,
        state.inner.clone(),
        state.jitter_cancel.clone(),
    );
    Ok(status_out)
}

#[tauri::command]
pub fn p2p_respond_handshake(
    state: State<'_, P2pState>,
    accept: bool,
    local_name: String,
    body_color: String,
    accent_color: String,
) -> Result<P2pStatus, String> {
    let mut guard = state.inner.lock().unwrap();

    if guard.is_sim_mode || guard.is_web_peer {
        let is_web = guard.is_web_peer;
        if accept {
            guard.phase = "connected".to_string();
            guard.is_room_host = true;
            guard.peer_name = guard.pending_peer_name.clone();
            guard.peer_addr = guard.pending_peer_addr.clone();
            guard.peer_body_color = guard.pending_body_color.clone();
            guard.peer_accent_color = guard.pending_accent_color.clone();
            guard.pending_peer_name.clear();
            guard.pending_peer_addr.clear();
            emit_p2p(
                &guard,
                "handshake_accepted",
                None,
                Some(format!(
                    "{} Đã bắt tay thành công với {}!",
                    if is_web { "[MOBILE WEB]" } else { "[SIM MODE]" },
                    guard.peer_name
                )),
            );
        } else {
            guard.is_sim_mode = false;
            guard.is_web_peer = false;
            guard.phase = "hosting".to_string();
            guard.pending_peer_name.clear();
            guard.pending_peer_addr.clear();
            emit_p2p(
                &guard,
                "handshake_rejected",
                None,
                Some("Đã từ chối yêu cầu kết nối.".to_string()),
            );
        }
        return Ok(build_status(&guard));
    }

    let mut stream = guard
        .pending_stream
        .take()
        .ok_or_else(|| "Không có yêu cầu Handshake nào đang chờ.".to_string())?;

    if accept {
        let accept_pkt = P2pWirePacket {
            kind: "handshake_accept".to_string(),
            peer_name: Some(local_name),
            body_color: Some(body_color),
            accent_color: Some(accent_color),
            ..Default::default()
        };
        send_json_line(&mut stream, &accept_pkt)?;

        let reader_stream = stream.try_clone().map_err(|e| format!("Clone err: {e}"))?;
        guard.active_stream = Some(stream);
        guard.peer_name = guard.pending_peer_name.clone();
        guard.peer_addr = guard.pending_peer_addr.clone();
        guard.peer_body_color = guard.pending_body_color.clone();
        guard.peer_accent_color = guard.pending_accent_color.clone();
        guard.pending_peer_name.clear();
        guard.pending_peer_addr.clear();
        guard.is_room_host = true;
        guard.phase = "connected".to_string();

        emit_p2p(
            &guard,
            "handshake_accepted",
            None,
            Some(format!("Handshake thành công! Đã kết nối với {}.", guard.peer_name)),
        );
        let st = build_status(&guard);
        drop(guard);

        spawn_peer_reader(
            reader_stream,
            state.inner.clone(),
            state.jitter_cancel.clone(),
        );
        Ok(st)
    } else {
        let reject_pkt = P2pWirePacket {
            kind: "handshake_reject".to_string(),
            reason: Some("Chủ phòng đã từ chối yêu cầu Handshake.".to_string()),
            ..Default::default()
        };
        let _ = send_json_line(&mut stream, &reject_pkt);
        guard.pending_peer_name.clear();
        guard.pending_peer_addr.clear();
        guard.phase = "hosting".to_string();
        Ok(build_status(&guard))
    }
}

#[tauri::command]
pub fn p2p_send_packet(state: State<'_, P2pState>, packet: P2pWirePacket) -> Result<(), String> {
    let mut guard = state.inner.lock().unwrap();

    if let Some(xr) = packet.x_ratio {
        guard.pc_x_ratio = xr;
    }
    if let Some(yr) = packet.y_ratio {
        guard.pc_y_ratio = yr;
    }
    if let Some(wd) = packet.walk_dir {
        guard.pc_walk_dir = wd;
    }
    if let Some(ref st) = packet.char_state {
        guard.pc_state = st.clone();
    }
    if let Some(ref w) = packet.weapon {
        guard.pc_weapon = w.clone();
    }
    if let Some(hp) = packet.hp {
        guard.pc_hp = hp;
    }
    if let Some(php) = packet.peer_hp {
        guard.peer_hp = php;
    }
    if let Some(en) = packet.energy {
        guard.pc_energy = en;
    }
    if let Some(pen) = packet.peer_energy {
        guard.peer_energy = pen;
    }
    if let Some(ref fj) = packet.foods_json {
        guard.pk_foods_json = fj.clone();
    }
    if let Some(h) = packet.is_hidden {
        guard.pc_hidden = h;
    }
    if let Some(sh) = packet.is_shielding {
        guard.pc_shielding = sh;
    }
    if let Some(jp) = packet.is_jetpack {
        guard.pc_jetpack = jp;
    }
    if let Some(sl) = packet.is_sliding {
        guard.pc_sliding = sl;
    }
    if let Some(ref wj) = packet.windows_json {
        guard.host_windows_json = wj.clone();
    }

    if packet.kind == "migrate_enter" {
        guard.pc_migrated_out = true;
    } else if packet.kind == "migrate_return" {
        guard.pc_migrated_out = false;
    } else if packet.kind == "pk_start" {
        guard.phase = "pk_duel".to_string();
        guard.winner_control_until = None;
        guard.victim_control_until = None;
        guard.remote_frame_b64.clear();
        guard.remote_frame_w = 0;
        guard.remote_frame_h = 0;
        guard.remote_frame_seq = 0;
        guard.pc_hp = 100;
        guard.peer_hp = 100;
        guard.pc_energy = 100;
        guard.peer_energy = 100;
        guard.pk_foods_json = "[]".to_string();
        guard.pc_migrated_out = false;
        guard.pc_hidden = false;
        guard.pc_shielding = false;
        guard.pc_jetpack = false;
        guard.pc_sliding = false;
    } else if packet.kind == "pk_attack" {
        if let Some(ref sk) = packet.skill {
            guard.last_pc_skill = sk.clone();
            guard.last_pc_skill_seq = guard.last_pc_skill_seq.wrapping_add(1);
            if let Some(ax) = packet.aim_x {
                guard.last_pc_aim_x = ax;
            }
            if let Some(ay) = packet.aim_y {
                guard.last_pc_aim_y = ay;
            }
        }
    } else if packet.kind == "pk_finish" {
        guard.remote_frame_b64.clear();
        guard.remote_frame_w = 0;
        guard.remote_frame_h = 0;
        guard.remote_frame_seq = 0;
        if packet.winner_is_sender.unwrap_or(false) {
            guard.phase = "winner_control".to_string();
            guard.winner_control_until = Some(Instant::now() + Duration::from_secs(60));
            guard.victim_control_until = None;
        } else {
            guard.phase = "victim_controlled".to_string();
            guard.victim_control_until = Some(Instant::now() + Duration::from_secs(60));
            guard.winner_control_until = None;
        }
    }

    if guard.is_sim_mode || guard.is_web_peer {
        return Ok(());
    }

    let start_victim_stream =
        packet.kind == "pk_finish" && !packet.winner_is_sender.unwrap_or(false);

    if let Some(ref mut stream) = guard.active_stream {
        let res = send_json_line(stream, &packet);
        drop(guard);
        if res.is_ok() && start_victim_stream {
            spawn_victim_screen_streamer(state.inner.clone());
        }
        res
    } else {
        Err("Chưa thiết lập kết nối P2P với máy đối thủ.".to_string())
    }
}

#[tauri::command]
pub async fn p2p_poll_remote_frame(
    state: State<'_, P2pState>,
    max_width: Option<u32>,
) -> Result<P2pRemoteFrameSnapshot, String> {
    let (is_sim, phase, rem_sec, cached) = {
        let mut guard = state.inner.lock().unwrap();
        refresh_expired_timers(&mut guard);
        let rem = guard
            .winner_control_until
            .and_then(|t| t.checked_duration_since(Instant::now()))
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let snap = P2pRemoteFrameSnapshot {
            has_frame: !guard.remote_frame_b64.is_empty(),
            frame_b64: guard.remote_frame_b64.clone(),
            width: guard.remote_frame_w,
            height: guard.remote_frame_h,
            seq: guard.remote_frame_seq,
            cursor_x: guard.remote_cursor_x,
            cursor_y: guard.remote_cursor_y,
            remaining_sec: rem,
            is_sim_mode: guard.is_sim_mode,
        };
        (guard.is_sim_mode, guard.phase.clone(), rem, snap)
    };

    if is_sim && phase == "winner_control" {
        let cap_w = max_width.unwrap_or(680);
        let (b64, w, h, cx, cy) = tauri::async_runtime::spawn_blocking(move || {
            capture_desktop_frame_bmp_b64(cap_w)
        })
        .await
        .map_err(|e| format!("Lỗi luồng chụp màn hình Sim: {e}"))??;

        let mut guard = state.inner.lock().unwrap();
        guard.remote_frame_seq = guard.remote_frame_seq.wrapping_add(1);
        guard.remote_frame_b64 = b64.clone();
        guard.remote_frame_w = w;
        guard.remote_frame_h = h;
        let seq = guard.remote_frame_seq;
        return Ok(P2pRemoteFrameSnapshot {
            has_frame: true,
            frame_b64: b64,
            width: w,
            height: h,
            seq,
            cursor_x: cx,
            cursor_y: cy,
            remaining_sec: rem_sec,
            is_sim_mode: true,
        });
    }

    Ok(cached)
}

#[tauri::command]
pub fn p2p_send_remote_command(
    state: State<'_, P2pState>,
    cmd_type: String,
    x_norm: Option<f64>,
    y_norm: Option<f64>,
    button: Option<String>,
    vk: Option<u8>,
    wheel_delta: Option<i32>,
    text: Option<String>,
    duration_sec: Option<u64>,
) -> Result<String, String> {
    let mut guard = state.inner.lock().unwrap();
    let is_sim = guard.is_sim_mode;
    let is_web = guard.is_web_peer;

    if let Some(until) = guard.winner_control_until {
        if Instant::now() >= until {
            guard.winner_control_until = None;
            guard.phase = "connected".to_string();
            return Err("Đã hết 60 giây quyền kiểm soát máy thua!".to_string());
        }
    } else {
        return Err("Bạn chưa thắng trận PK để sử dụng Remote Control!".to_string());
    }

    if is_sim {
        if let Some(xn) = x_norm {
            guard.remote_cursor_x = xn.clamp(0.0, 1.0);
        }
        if let Some(yn) = y_norm {
            guard.remote_cursor_y = yn.clamp(0.0, 1.0);
        }
        if cmd_type == "mouse_move" {
            return Ok(String::new());
        }
        if button.as_deref() == Some("sim_preview") {
            return Ok(format!("[SIM PREVIEW] {cmd_type} ({:.2}, {:.2})", guard.remote_cursor_x, guard.remote_cursor_y));
        }
    }

    let pkt = P2pWirePacket {
        kind: "remote_cmd".to_string(),
        cmd_type: Some(cmd_type.clone()),
        x_norm,
        y_norm,
        button,
        vk,
        wheel_delta,
        text,
        duration_sec,
        ..Default::default()
    };

    if is_sim {
        drop(guard);
        let res = execute_win32_remote_cmd(&state.inner, &state.jitter_cancel, &pkt)?;
        return Ok(format!("[SIM TEST] {res}"));
    }

    if is_web {
        return Ok(format!(
            "[MOBILE WEB] Đã gửi hiệu ứng thắng '{cmd_type}' lên màn hình trình duyệt Mobile!"
        ));
    }

    if let Some(ref mut stream) = guard.active_stream {
        send_json_line(stream, &pkt)?;
        Ok(format!("Đã gửi lệnh '{cmd_type}' sang máy đối thủ!"))
    } else {
        Err("Mất kết nối P2P.".to_string())
    }
}

#[tauri::command]
pub fn p2p_start_sim_peer(state: State<'_, P2pState>) -> P2pStatus {
    let mut guard = state.inner.lock().unwrap();
    guard.is_sim_mode = true;
    guard.active_stream = None;
    guard.pending_stream = None;
    guard.pending_peer_name = "CyberDuck-MayB (Sim LAN)".to_string();
    guard.pending_peer_addr = "127.0.0.1:39283".to_string();
    guard.pending_body_color = "#312e81".to_string();
    guard.pending_accent_color = "#f43f5e".to_string();
    guard.phase = "incoming_consent".to_string();

    emit_p2p(
        &guard,
        "incoming_handshake",
        Some(P2pWirePacket {
            kind: "handshake_req".to_string(),
            room_code: Some(guard.room_code.clone()),
            peer_name: Some(guard.pending_peer_name.clone()),
            body_color: Some(guard.pending_body_color.clone()),
            accent_color: Some(guard.pending_accent_color.clone()),
            ..Default::default()
        }),
        Some("Máy B (Sim LAN) gửi yêu cầu Handshake! Bấm Đồng ý để bắt đầu.".to_string()),
    );

    build_status(&guard)
}

#[tauri::command]
pub fn p2p_disconnect(state: State<'_, P2pState>) -> P2pStatus {
    release_win32_block_input();
    state.jitter_cancel.store(true, Ordering::Relaxed);

    let mut guard = state.inner.lock().unwrap();
    if let Some(mut stream) = guard.active_stream.take() {
        let _ = send_json_line(
            &mut stream,
            &P2pWirePacket {
                kind: "disconnect".to_string(),
                ..Default::default()
            },
        );
    }
    guard.pending_stream = None;
    guard.is_sim_mode = false;
    guard.is_web_peer = false;
    guard.is_room_host = false;
    guard.host_windows_json = "[]".to_string();
    guard.pk_foods_json = "[]".to_string();
    guard.remote_frame_b64.clear();
    guard.remote_frame_w = 0;
    guard.remote_frame_h = 0;
    guard.remote_frame_seq = 0;
    guard.pc_energy = 100;
    guard.peer_energy = 100;
    guard.pc_migrated_out = false;
    guard.pc_hidden = false;
    guard.pc_shielding = false;
    guard.pc_jetpack = false;
    guard.pc_sliding = false;
    guard.phase = "hosting".to_string();
    guard.peer_name.clear();
    guard.peer_addr.clear();
    guard.pending_peer_name.clear();
    guard.pending_peer_addr.clear();
    guard.winner_control_until = None;
    guard.victim_control_until = None;
    emit_p2p(
        &guard,
        "peer_disconnected",
        None,
        Some("Đã ngắt kết nối phòng P2P.".to_string()),
    );
    build_status(&guard)
}

#[tauri::command]
pub fn p2p_emergency_release(state: State<'_, P2pState>) -> P2pStatus {
    release_win32_block_input();
    state.jitter_cancel.store(true, Ordering::Relaxed);
    let mut guard = state.inner.lock().unwrap();
    guard.block_generation = guard.block_generation.wrapping_add(1);
    guard.victim_control_until = None;
    guard.winner_control_until = None;
    guard.remote_frame_b64.clear();
    guard.remote_frame_w = 0;
    guard.remote_frame_h = 0;
    guard.remote_frame_seq = 0;
    if guard.phase == "victim_controlled" || guard.phase == "winner_control" {
        guard.phase = if guard.active_stream.is_some() || guard.is_sim_mode || guard.is_web_peer {
            "connected".to_string()
        } else {
            "hosting".to_string()
        };
    }
    emit_p2p(
        &guard,
        "status_changed",
        None,
        Some("[SAFE RELEASE] Đã khôi phục hoàn toàn chuột & bàn phím!".to_string()),
    );
    build_status(&guard)
}

#[tauri::command]
pub fn p2p_open_firewall_port(state: State<'_, P2pState>) -> Result<String, String> {
    let listen_port = {
        let guard = state.inner.lock().unwrap();
        guard.listen_port
    };

    #[cfg(windows)]
    {
        let ps_script = "$ErrorActionPreference='Stop'; $cmdText='netsh advfirewall firewall delete rule name=\"Duck AI Manager P2P Mobile\" *>$null; netsh advfirewall firewall add rule name=\"Duck AI Manager P2P Mobile\" dir=in action=allow protocol=TCP localport=39282-39290 profile=any enable=yes; exit $LASTEXITCODE'; $enc=[Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($cmdText)); $p=Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',$enc) -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode";
        let mut cmd = std::process::Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_script]);
        apply_no_window(&mut cmd);
        let out = cmd
            .output()
            .map_err(|e| format!("Không thể chạy PowerShell mở Firewall: {e}"))?;
        if !out.status.success() {
            return Err("Chưa cấp quyền Administrator (UAC) để thêm rule Windows Firewall cho cổng LAN 39282-39290.".to_string());
        }
        Ok(format!(
            "[SUCCESS] Đã mở Windows Firewall LAN TCP cổng 39282-39290 (cổng hiện tại: {listen_port}). Điện thoại cùng Wi-Fi có thể truy cập ngay!"
        ))
    }

    #[cfg(not(windows))]
    {
        let _ = listen_port;
        Err("Chỉ hỗ trợ mở Windows Firewall tự động trên Windows.".to_string())
    }
}
