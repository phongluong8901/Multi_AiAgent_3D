const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let workerProcess = null;

function startPythonWorker() {
  const isDev = !app.isPackaged;

  // Trỏ tới file worker.exe tùy theo môi trường Dev hay Production
  const workerPath = isDev 
    ? path.join(__dirname, 'worker.exe')
    : path.join(process.resourcesPath, 'worker.exe');

  if (fs.existsSync(workerPath)) {
    // Khởi động Python Worker chạy ngầm ẩn cửa sổ dòng lệnh
    workerProcess = spawn(workerPath, [], { windowsHide: true });
    
    workerProcess.stdout.on('data', (data) => {
      console.log(`[Python Worker]: ${data}`);
    });
    
    workerProcess.stderr.on('data', (data) => {
      console.error(`[Python Error]: ${data}`);
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 650,
    frame: false, // Tắt khung viền mặc định để dùng Custom Title Bar giống Postman
    backgroundColor: '#181818',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
  }
}

// ==========================================
// LẮNG NGHE SỰ KIỆN ĐIỀU KHIỂN CỬA SỔ TỪ REACT
// ==========================================
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  startPythonWorker(); // Tự động chạy worker ngầm
  createWindow();      // Mở giao diện ứng dụng

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Khi đóng app Electron, tiêu diệt luôn tiến trình python đang chạy ngầm
app.on('will-quit', () => {
  if (workerProcess) {
    workerProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});