@echo off
chcp 65001 >nul
echo ==============================================================
echo 🔨 Bắt đầu build worker.exe cho Multi-Agent Distributed Service
echo ==============================================================

if not exist release mkdir release

echo [1/3] Kiểm tra dependencies...
python -m pip install -r requirements.txt

echo [2/3] Tiến hành đóng gói với PyInstaller...
python -m PyInstaller --clean --onefile --name "worker" --distpath "./release" worker.py

echo [3/3] Hoàn tất build!
if exist "release\worker.exe" (
    echo.
    echo ✅ File worker.exe đã được tạo thành công tại:
    echo    %~dp0release\worker.exe
    echo.
) else (
    echo ❌ Build thất bại! Vui lòng kiểm tra lại log bên trên.
)

pause
