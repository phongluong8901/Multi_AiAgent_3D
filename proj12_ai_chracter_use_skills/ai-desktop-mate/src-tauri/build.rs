fn main() {
    tauri_build::build();
    #[cfg(target_os = "windows")]
    if let Ok(out_dir) = std::env::var("OUT_DIR") {
        let gnu_res = std::path::Path::new(&out_dir).join("libresource.a");
        let msvc_res = std::path::Path::new(&out_dir).join("resource.lib");
        if gnu_res.exists() {
            println!("cargo:rustc-link-arg-tests={}", gnu_res.display());
        } else if msvc_res.exists() {
            println!("cargo:rustc-link-arg-tests={}", msvc_res.display());
        }
    }
}
