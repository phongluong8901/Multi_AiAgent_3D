use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_shell::ShellExt;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Default)]
pub struct PythonServerState(pub Mutex<Option<Child>>);

#[tauri::command]
fn app_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn app_toggle_maximize(window: tauri::Window) -> bool {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
            false
        } else {
            let _ = window.maximize();
            true
        }
    } else {
        false
    }
}

#[tauri::command]
fn app_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn app_is_maximized(window: tauri::Window) -> bool {
    window.is_maximized().unwrap_or(false)
}

fn is_backend_ready() -> bool {
    TcpStream::connect("127.0.0.1:14200").is_ok()
}

fn try_spawn_backend(app: &AppHandle) -> Option<Child> {
    // 1. Kiểm tra nếu backend đang chạy sẵn trên port 14200
    if is_backend_ready() {
        eprintln!("[INFO] Python engine already running on 127.0.0.1:14200");
        return None;
    }

    // 2. Thử chạy bằng Tauri Sidecar plugin
    if let Ok(sidecar_cmd) = app.shell().sidecar("backend-engine") {
        if let Ok((_rx, child)) = sidecar_cmd.spawn() {
            eprintln!("[INFO] Spawned backend-engine via Tauri sidecar (PID {})", child.pid());
            for _ in 0..10 {
                std::thread::sleep(std::time::Duration::from_millis(200));
                if is_backend_ready() {
                    return None;
                }
            }
        }
    }

    // 3. Fallback: Tìm file binary backend-engine.exe trực tiếp
    let current_exe = std::env::current_exe().ok();
    let current_dir = current_exe.as_ref().and_then(|p| p.parent()).map(|p| p.to_path_buf());

    let mut candidate_paths: Vec<PathBuf> = Vec::new();
    if let Some(ref dir) = current_dir {
        candidate_paths.push(dir.join("backend-engine.exe"));
        candidate_paths.push(dir.join("backend-engine-x86_64-pc-windows-gnu.exe"));
    }
    candidate_paths.push(PathBuf::from("desktop-shell/binaries/backend-engine-x86_64-pc-windows-gnu.exe"));
    candidate_paths.push(PathBuf::from("backend/dist/backend-engine.exe"));
    candidate_paths.push(PathBuf::from("../backend/dist/backend-engine.exe"));

    for path in &candidate_paths {
        if path.exists() {
            eprintln!("[INFO] Attempting to spawn backend from binary: {:?}", path);
            let mut cmd = Command::new(path);
            if let Some(parent) = path.parent() {
                cmd.current_dir(parent);
            }
            #[cfg(windows)]
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            if let Ok(mut child) = cmd.spawn() {
                eprintln!("[INFO] Spawned backend binary PID {}", child.id());
                let mut ready = false;
                for _ in 0..12 {
                    std::thread::sleep(std::time::Duration::from_millis(250));
                    if is_backend_ready() {
                        ready = true;
                        break;
                    }
                    if let Ok(Some(status)) = child.try_wait() {
                        eprintln!("[WARN] Backend binary exited with status: {}", status);
                        break;
                    }
                }
                if ready {
                    return Some(child);
                }
            }
        }
    }

    // 4. Fallback đáng tin cậy: Chạy trực tiếp Python từ Virtualenv nếu binary gặp sự cố
    let venv_candidates = [
        "backend/.venv/Scripts/python.exe",
        "../backend/.venv/Scripts/python.exe",
        "backend/.venv/bin/python",
        "../backend/.venv/bin/python",
    ];

    for venv_path in &venv_candidates {
        if Path::new(venv_path).exists() {
            let working_dir = if venv_path.starts_with("../") { "../backend" } else { "backend" };
            eprintln!("[INFO] Spawning Python engine fallback from {:?} with cwd {:?}", venv_path, working_dir);
            let mut cmd = Command::new(venv_path);
            cmd.current_dir(working_dir);
            cmd.args(["main.py"]);
            #[cfg(windows)]
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            if let Ok(child) = cmd.spawn() {
                eprintln!("[INFO] Spawned Python engine successfully (PID {})", child.id());
                return Some(child);
            }
        }
    }

    eprintln!("[WARN] Could not find standalone backend binary or python virtualenv.");
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(PythonServerState::default())
        .invoke_handler(tauri::generate_handler![
            app_minimize,
            app_toggle_maximize,
            app_close,
            app_is_maximized
        ])
        .setup(|app| {
            let child_opt = try_spawn_backend(app.handle());
            if let Some(child) = child_opt {
                let state = app.state::<PythonServerState>();
                *state.0.lock().unwrap() = Some(child);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                let state = window.state::<PythonServerState>();
                let maybe_child = state.0.lock().unwrap().take();
                if let Some(mut child) = maybe_child {
                    let _ = child.kill();
                    eprintln!("[INFO] Terminated Python backend process");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
