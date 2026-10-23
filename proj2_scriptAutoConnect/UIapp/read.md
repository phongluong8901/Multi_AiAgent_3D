1. .exe worker
pip install pyinstaller torch psutil websockets

- dong goi
pyinstaller --onefile worker.py

2. dua vao tauri
Trong thư mục dự án Tauri của bạn (UIapp/tauri-app/src-tauri/), tạo một thư mục mới tên là binaries (src-tauri/binaries/).

Copy file worker.exe từ thư mục dist/ vào thư mục src-tauri/binaries/.

Đổi tên file theo đúng định dạng chuẩn kiến trúc của Tauri v2 trên Windows:

Đổi thành: worker-x86_64-pc-windows-msvc.exe

3. cau hinh src-tauri/tauri.conf.json