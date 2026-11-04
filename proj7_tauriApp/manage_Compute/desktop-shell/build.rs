fn main() {
    println!("cargo:rerun-if-changed=../frontend/dist");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=capabilities");
    tauri_build::build();
}
