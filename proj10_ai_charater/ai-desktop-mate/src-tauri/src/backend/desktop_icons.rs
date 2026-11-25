#![allow(unsafe_op_in_unsafe_fn)]
//! Desktop icon manipulation (Windows Explorer desktop listview).
//!
//! Uses the documented Shell COM path:
//!   IShellWindows::FindWindowSW(SWC_DESKTOP) -> IServiceProvider -> IShellBrowser
//!   -> IShellView -> IFolderView / IFolderView2
//! All COM objects live on one dedicated STA worker thread; Tauri commands talk to
//! it through a channel, so high-frequency move calls never block the UI thread.

use serde::Serialize;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

#[derive(Serialize, Clone, Debug)]
pub struct DesktopIcon {
    pub index: usize,
    pub name: String,
    /// Top-left of the icon cell in physical screen pixels.
    pub x: i32,
    pub y: i32,
}

#[derive(Serialize, Clone, Debug)]
pub struct DesktopIconList {
    pub icons: Vec<DesktopIcon>,
    /// Grid cell size of a desktop icon in physical pixels.
    pub spacing_x: i32,
    pub spacing_y: i32,
    pub auto_arrange: bool,
}

#[allow(dead_code)]
enum Cmd {
    List(Sender<Result<DesktopIconList, String>>),
    Move {
        index: usize,
        x: i32,
        y: i32,
        reply: Option<Sender<Result<(), String>>>,
    },
    BeginDrag(Sender<Result<bool, String>>),
    EndDrag(Sender<Result<(), String>>),
}

static WORKER: OnceLock<Mutex<Sender<Cmd>>> = OnceLock::new();

fn worker_sender() -> Result<Sender<Cmd>, String> {
    let lock = WORKER.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<Cmd>();
        std::thread::Builder::new()
            .name("desktop-icons-sta".into())
            .spawn(move || worker_loop(rx))
            .expect("spawn desktop icon worker");
        Mutex::new(tx)
    });
    lock.lock()
        .map(|g| g.clone())
        .map_err(|_| "[ERROR] Desktop icon worker lock poisoned".to_string())
}

fn request<T>(build: impl FnOnce(Sender<Result<T, String>>) -> Cmd) -> Result<T, String> {
    let tx = worker_sender()?;
    let (rtx, rrx) = mpsc::channel();
    tx.send(build(rtx))
        .map_err(|_| "[ERROR] Desktop icon worker stopped".to_string())?;
    rrx.recv_timeout(Duration::from_secs(6))
        .map_err(|_| "[ERROR] Desktop icon worker timeout".to_string())?
}

#[tauri::command]
pub async fn list_desktop_icons() -> Result<DesktopIconList, String> {
    request(Cmd::List)
}

/// Fire-and-forget move used for animation frames (does not wait for COM).
#[tauri::command]
pub fn move_desktop_icon(index: usize, x: i32, y: i32) -> Result<(), String> {
    let tx = worker_sender()?;
    tx.send(Cmd::Move { index, x, y, reply: None })
        .map_err(|_| "[ERROR] Desktop icon worker stopped".to_string())
}

/// Blocking move used for the final drop position.
#[tauri::command]
pub async fn place_desktop_icon(index: usize, x: i32, y: i32) -> Result<(), String> {
    request(|reply| Cmd::Move { index, x, y, reply: Some(reply) })
}

/// Disables auto-arrange and snap-to-grid while the character carries an icon.
/// Returns true when auto-arrange had been enabled (it stays disabled afterwards).
#[tauri::command]
pub async fn begin_desktop_icon_drag() -> Result<bool, String> {
    request(Cmd::BeginDrag)
}

/// Restores snap-to-grid (if it was enabled) after the drop.
#[tauri::command]
pub async fn end_desktop_icon_drag() -> Result<(), String> {
    request(Cmd::EndDrag)
}

#[cfg(not(windows))]
fn worker_loop(rx: Receiver<Cmd>) {
    for cmd in rx {
        let err = "[ERROR] Desktop icons are only supported on Windows".to_string();
        match cmd {
            Cmd::List(r) => {
                let _ = r.send(Err(err));
            }
            Cmd::Move { reply, .. } => {
                if let Some(r) = reply {
                    let _ = r.send(Err(err));
                }
            }
            Cmd::BeginDrag(r) => {
                let _ = r.send(Err(err));
            }
            Cmd::EndDrag(r) => {
                let _ = r.send(Err(err));
            }
        }
    }
}

#[cfg(windows)]
fn worker_loop(rx: Receiver<Cmd>) {
    use win::*;
    unsafe {
        let _ = windows::Win32::System::Com::CoInitializeEx(
            None,
            windows::Win32::System::Com::COINIT_APARTMENTTHREADED,
        );
    }
    let mut ctx = DesktopCtx::default();

    while let Ok(cmd) = rx.recv() {
        match cmd {
            Cmd::List(reply) => {
                let res = ctx.with_retry(|c| unsafe { c.list() });
                let _ = reply.send(res);
            }
            Cmd::Move { index, x, y, reply } => {
                // Coalesce queued animation frames: keep only the latest fire-and-forget move.
                let (mut idx, mut tx, mut ty, mut rep) = (index, x, y, reply);
                if rep.is_none() {
                    loop {
                        match rx.try_recv() {
                            Ok(Cmd::Move { index, x, y, reply }) => {
                                idx = index;
                                tx = x;
                                ty = y;
                                if reply.is_some() {
                                    rep = reply;
                                    break;
                                }
                            }
                            Ok(other) => {
                                let r = ctx.with_retry(|c| unsafe { c.move_item(idx, tx, ty) });
                                let _ = r;
                                ctx.handle_other(other);
                                idx = usize::MAX;
                                break;
                            }
                            Err(_) => break,
                        }
                    }
                }
                if idx != usize::MAX {
                    let r = ctx.with_retry(|c| unsafe { c.move_item(idx, tx, ty) });
                    if let Some(rep) = rep {
                        let _ = rep.send(r);
                    }
                }
            }
            other => ctx.handle_other(other),
        }
    }
}

#[cfg(windows)]
mod win {
    use super::{Cmd, DesktopIcon, DesktopIconList};
    use windows::core::{Interface, PWSTR, VARIANT};
    use windows::Win32::Foundation::{HWND, POINT, S_OK};
    use windows::Win32::Graphics::Gdi::ClientToScreen;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoTaskMemFree, IServiceProvider, CLSCTX_ALL,
    };
    use windows::Win32::UI::Shell::Common::{ITEMIDLIST, STRRET};
    use windows::Win32::UI::Shell::{
        IEnumIDList, IFolderView, IFolderView2, IShellBrowser, IShellFolder, IShellWindows,
        ShellWindows, StrRetToStrW, CSIDL_DESKTOP, FWF_AUTOARRANGE, FWF_SNAPTOGRID,
        SHGDN_NORMAL, SID_STopLevelBrowser, SVGIO_ALLVIEW, SVSI_POSITIONITEM, SWC_DESKTOP,
        SWFO_NEEDDISPATCH,
    };

    #[derive(Default)]
    pub struct DesktopCtx {
        view: Option<IFolderView>,
        defview_hwnd: HWND,
        pidls: Vec<*mut ITEMIDLIST>,
        saved_flags: Option<u32>,
    }

    impl Drop for DesktopCtx {
        fn drop(&mut self) {
            self.free_pidls();
        }
    }

    impl DesktopCtx {
        fn free_pidls(&mut self) {
            for p in self.pidls.drain(..) {
                if !p.is_null() {
                    unsafe { CoTaskMemFree(Some(p as *const _)) };
                }
            }
        }

        pub fn handle_other(&mut self, cmd: Cmd) {
            match cmd {
                Cmd::List(reply) => {
                    let _ = reply.send(self.with_retry(|c| unsafe { c.list() }));
                }
                Cmd::Move { index, x, y, reply } => {
                    let r = self.with_retry(|c| unsafe { c.move_item(index, x, y) });
                    if let Some(reply) = reply {
                        let _ = reply.send(r);
                    }
                }
                Cmd::BeginDrag(reply) => {
                    let _ = reply.send(self.with_retry(|c| unsafe { c.begin_drag() }));
                }
                Cmd::EndDrag(reply) => {
                    let _ = reply.send(self.with_retry(|c| unsafe { c.end_drag() }));
                }
            }
        }

        /// Runs `f`; if the cached Explorer view went stale (Explorer restarted), re-acquire once.
        pub fn with_retry<T>(
            &mut self,
            mut f: impl FnMut(&mut Self) -> Result<T, String>,
        ) -> Result<T, String> {
            if self.view.is_none() {
                unsafe { self.acquire()? };
            }
            match f(self) {
                Ok(v) => Ok(v),
                Err(_) => {
                    self.view = None;
                    unsafe { self.acquire()? };
                    f(self)
                }
            }
        }

        unsafe fn acquire(&mut self) -> Result<(), String> {
            let map = |stage: &str, e: windows::core::Error| format!("[ERROR] Desktop COM ({stage}): {e}");
            let shell_windows: IShellWindows =
                CoCreateInstance(&ShellWindows, None, CLSCTX_ALL).map_err(|e| map("ShellWindows", e))?;
            let loc = VARIANT::from(CSIDL_DESKTOP as i32);
            let root = VARIANT::default();
            let mut hwnd_val: i32 = 0;
            let disp = shell_windows
                .FindWindowSW(&loc, &root, SWC_DESKTOP, &mut hwnd_val, SWFO_NEEDDISPATCH)
                .map_err(|e| map("FindWindowSW", e))?;
            let provider: IServiceProvider = disp.cast().map_err(|e| map("IServiceProvider", e))?;
            let browser: IShellBrowser = provider
                .QueryService(&SID_STopLevelBrowser)
                .map_err(|e| map("IShellBrowser", e))?;
            let shell_view = browser.QueryActiveShellView().map_err(|e| map("IShellView", e))?;
            self.defview_hwnd = shell_view.GetWindow().unwrap_or_default();
            let view: IFolderView = shell_view.cast().map_err(|e| map("IFolderView", e))?;
            self.view = Some(view);
            self.free_pidls();
            Ok(())
        }

        /// Offset that converts listview client coordinates to screen coordinates.
        unsafe fn client_origin(&self) -> (i32, i32) {
            let mut pt = POINT { x: 0, y: 0 };
            if !self.defview_hwnd.0.is_null() {
                let _ = ClientToScreen(self.defview_hwnd, &mut pt);
            }
            (pt.x, pt.y)
        }

        pub unsafe fn list(&mut self) -> Result<DesktopIconList, String> {
            let view = self.view.clone().ok_or("[ERROR] Desktop view unavailable")?;
            let folder: IShellFolder = view.GetFolder().map_err(|e| format!("[ERROR] GetFolder: {e}"))?;
            let items: IEnumIDList = view
                .Items(SVGIO_ALLVIEW)
                .map_err(|e| format!("[ERROR] Items: {e}"))?;

            self.free_pidls();
            let (ox, oy) = self.client_origin();
            let mut icons = Vec::new();
            loop {
                let mut slot: [*mut ITEMIDLIST; 1] = [std::ptr::null_mut()];
                let mut fetched = 0u32;
                let hr = items.Next(&mut slot, Some(&mut fetched));
                if hr != S_OK || fetched == 0 || slot[0].is_null() {
                    break;
                }
                let pidl = slot[0];
                let pos = view.GetItemPosition(pidl).unwrap_or(POINT { x: 0, y: 0 });
                let mut sr = STRRET::default();
                let mut name = String::new();
                if folder.GetDisplayNameOf(pidl, SHGDN_NORMAL, &mut sr).is_ok() {
                    let mut out = PWSTR::null();
                    if StrRetToStrW(&mut sr, Some(pidl as *const _), &mut out).is_ok() && !out.is_null() {
                        name = out.to_string().unwrap_or_default();
                        CoTaskMemFree(Some(out.0 as *const _));
                    }
                }
                icons.push(DesktopIcon {
                    index: self.pidls.len(),
                    name,
                    x: pos.x + ox,
                    y: pos.y + oy,
                });
                self.pidls.push(pidl);
            }

            let mut spacing = POINT { x: 76, y: 92 };
            if view.GetSpacing(&mut spacing).is_err() {
                spacing = POINT { x: 76, y: 92 };
            }
            let auto_arrange = view
                .cast::<IFolderView2>()
                .ok()
                .and_then(|v2| v2.GetCurrentFolderFlags().ok())
                .map(|f| f & FWF_AUTOARRANGE.0 as u32 != 0)
                .unwrap_or(false);

            Ok(DesktopIconList {
                icons,
                spacing_x: spacing.x.max(40),
                spacing_y: spacing.y.max(40),
                auto_arrange,
            })
        }

        pub unsafe fn move_item(&mut self, index: usize, x: i32, y: i32) -> Result<(), String> {
            let view = self.view.clone().ok_or("[ERROR] Desktop view unavailable")?;
            let pidl = *self
                .pidls
                .get(index)
                .ok_or("[ERROR] Icon index out of range, refresh the icon list first")?;
            let (ox, oy) = self.client_origin();
            let pt = POINT { x: x - ox, y: y - oy };
            let arr: [*const ITEMIDLIST; 1] = [pidl as *const _];
            view.SelectAndPositionItems(1, arr.as_ptr(), Some(&pt), SVSI_POSITIONITEM.0 as u32)
                .map_err(|e| format!("[ERROR] SelectAndPositionItems: {e}"))
        }

        pub unsafe fn begin_drag(&mut self) -> Result<bool, String> {
            let view = self.view.clone().ok_or("[ERROR] Desktop view unavailable")?;
            let v2: IFolderView2 = view.cast().map_err(|e| format!("[ERROR] IFolderView2: {e}"))?;
            let flags = v2.GetCurrentFolderFlags().map_err(|e| format!("[ERROR] Flags: {e}"))?;
            if self.saved_flags.is_none() {
                self.saved_flags = Some(flags);
            }
            let mask = (FWF_AUTOARRANGE.0 | FWF_SNAPTOGRID.0) as u32;
            v2.SetCurrentFolderFlags(mask, 0)
                .map_err(|e| format!("[ERROR] SetCurrentFolderFlags: {e}"))?;
            Ok(flags & FWF_AUTOARRANGE.0 as u32 != 0)
        }

        pub unsafe fn end_drag(&mut self) -> Result<(), String> {
            let Some(saved) = self.saved_flags.take() else {
                return Ok(());
            };
            let view = self.view.clone().ok_or("[ERROR] Desktop view unavailable")?;
            let v2: IFolderView2 = view.cast().map_err(|e| format!("[ERROR] IFolderView2: {e}"))?;
            // Restore snap-to-grid only; auto-arrange would undo the move.
            let snap = saved & FWF_SNAPTOGRID.0 as u32;
            v2.SetCurrentFolderFlags(FWF_SNAPTOGRID.0 as u32, snap)
                .map_err(|e| format!("[ERROR] SetCurrentFolderFlags: {e}"))
        }
    }
}
