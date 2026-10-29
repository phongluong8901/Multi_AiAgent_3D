const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');

let mainWindow = null;
let workerProcess = null;
let lastTelemetryData = null;

function getConfigPath() {
  const isDev = !app.isPackaged;
  return isDev
    ? path.join(__dirname, 'worker-config.json')
    : path.join(process.resourcesPath, 'worker-config.json');
}

function readConfigFile() {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (e) {
    console.error('Lỗi đọc config:', e);
  }
  return {
    serverWsUrl: 'ws://localhost:4000/api/v1/distributed/ws',
    authToken: '',
    nodeId: '',
    localEndpoint: 'http://localhost:11434',
    allocatedCores: 4,
    allocatedRAMGB: 8,
    enableGPU: true,
    gpuSharePercent: 80,
    maxTokens: 2048,
    contextLength: 4096,
    temperature: 0.7,
    defaultModel: 'qwen2.5-coder:1.5b',
    maxConcurrentTasks: 2,
  };
}

function writeConfigFile(cfg) {
  try {
    const p = getConfigPath();
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Lỗi ghi config:', e);
    return false;
  }
}

function findWorkerExecutable() {
  const isDev = !app.isPackaged;

  // Trong môi trường phát triển (hoặc khi source python có mặt), ưu tiên chạy worker.py
  if (isDev) {
    const searchPy = [
      path.join(__dirname, 'worker.py'),
      path.join(app.getAppPath(), 'worker.py'),
      path.join(__dirname, 'backend_worker', 'main.py'),
    ];
    for (const p of searchPy) {
      if (fs.existsSync(p)) {
        return { type: 'py', path: p, cwd: path.dirname(p) };
      }
    }
  }

  // Nếu là bản đóng gói release (installer), ưu tiên file exe đóng gói đi kèm
  const searchExe = [
    path.join(__dirname, 'worker.exe'),
    path.join(__dirname, 'release', 'worker.exe'),
    path.join(process.resourcesPath, 'worker.exe'),
    path.join(process.resourcesPath, 'release', 'worker.exe'),
    path.join(app.getAppPath(), 'worker.exe'),
    path.join(app.getAppPath(), 'release', 'worker.exe'),
  ];
  for (const p of searchExe) {
    if (fs.existsSync(p)) {
      return { type: 'exe', path: p, cwd: path.dirname(p) };
    }
  }

  const fallbackPy = [
    path.join(__dirname, 'worker.py'),
    path.join(app.getAppPath(), 'worker.py'),
    path.join(process.resourcesPath, 'worker.py'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'worker.py'),
  ];
  for (const p of fallbackPy) {
    if (fs.existsSync(p)) {
      return { type: 'py', path: p, cwd: path.dirname(p) };
    }
  }

  return null;
}

function startPythonWorker() {
  if (workerProcess) {
    try { workerProcess.kill(); } catch (e) {}
    workerProcess = null;
  }

  const target = findWorkerExecutable();
  if (!target) {
    const msg = '[Worker Error] Không tìm thấy worker.exe hoặc worker.py trên hệ thống!';
    console.error(msg);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('worker-log', msg);
    }
    return;
  }

  let cmd = '';
  let args = [];

  if (target.type === 'exe') {
    cmd = target.path;
    args = [];
    console.log(`[Worker Init] Chạy worker binary: ${cmd}`);
  } else {
    cmd = process.platform === 'win32' ? 'python' : 'python3';
    // -u là bắt buộc để Python flush stdout ngay lập tức không bị đọng buffer
    args = ['-u', target.path];
    console.log(`[Worker Init] Chạy worker script Python: ${cmd} ${args.join(' ')}`);
  }

  try {
    workerProcess = spawn(cmd, args, {
      cwd: target.cwd,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('worker-status-changed', true);
      mainWindow.webContents.send('worker-log', `[INIT] Khởi động tiến trình Worker (PID: ${workerProcess.pid})...`);
    }

    workerProcess.stdout.on('data', (buf) => {
      const text = buf.toString('utf-8');
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        // Bắt gói tin telemetry phát trực tiếp từ worker cục bộ
        if (line.includes('[LOCAL_TELEMETRY]')) {
          try {
            const jsonPart = line.substring(line.indexOf('[LOCAL_TELEMETRY]') + 17).trim();
            const telemData = JSON.parse(jsonPart);
            lastTelemetryData = telemData;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('local-telemetry', telemData);
            }
          } catch (e) {}
        } else {
          console.log(`[Python Worker]: ${line}`);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('worker-log', line);
          }
        }
      }
    });

    workerProcess.stderr.on('data', (buf) => {
      const text = buf.toString('utf-8').trim();
      if (!text) return;
      console.error(`[Python Error]: ${text}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('worker-log', `[STDERR] ${text}`);
      }
    });

    workerProcess.on('error', (err) => {
      console.error(`[Worker Spawn Error]: ${err.message}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('worker-log', `[ERROR] Không thể chạy worker: ${err.message}`);
        mainWindow.webContents.send('worker-status-changed', false);
      }
    });

    workerProcess.on('exit', (code, signal) => {
      console.log(`[Worker Exit] Mã: ${code}, tín hiệu: ${signal}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('worker-status-changed', false);
        mainWindow.webContents.send('worker-log', `[EXIT] Tiến trình Worker đã dừng (Mã: ${code})`);
      }
      workerProcess = null;
    });
  } catch (err) {
    console.error('[Worker Spawn Exception]:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('worker-log', `[ERROR] Exception: ${err.message}`);
    }
  }
}

function stopPythonWorker() {
  if (workerProcess) {
    const pid = workerProcess.pid;
    console.log(`[Worker Shutdown] Bắt buộc dừng cây tiến trình Worker PID: ${pid}`);
    try {
      if (process.platform === 'win32' && pid) {
        const { execSync } = require('child_process');
        try {
          // /t diệt toàn bộ cây tiến trình con, /f ép dừng ngay lập tức
          execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' });
        } catch (e) {
          try { workerProcess.kill('SIGKILL'); } catch (kErr) {}
        }
      } else {
        workerProcess.kill('SIGKILL');
      }
    } catch (e) {
      try { workerProcess.kill(); } catch (err) {}
    }
    workerProcess = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('worker-status-changed', false);
    mainWindow.webContents.send('worker-log', '[INFO] Đã ngắt và dừng hoàn toàn tiến trình Worker daemon');
  }
  return true;
}

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    frame: false, // Tắt khung viền mặc định để dùng Custom Title Bar
    backgroundColor: '#0e0e0e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const distHtmlPath = path.join(__dirname, 'frontend/dist/index.html');
  const isDev = !app.isPackaged;

  if (isDev && process.env.VITE_DEV === '1') {
    mainWindow.loadURL('http://localhost:5173');
  } else if (fs.existsSync(distHtmlPath)) {
    mainWindow.loadFile(distHtmlPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('worker-status-changed', Boolean(workerProcess && !workerProcess.killed));
    if (lastTelemetryData) {
      mainWindow.webContents.send('local-telemetry', lastTelemetryData);
    }
  });
}

// ==========================================
// IPC HANDLERS
// ==========================================
ipcMain.handle('get-worker-config', async () => {
  return readConfigFile();
});

ipcMain.handle('get-current-telemetry', async () => {
  return lastTelemetryData;
});

ipcMain.handle('save-worker-config', async (event, newConfig) => {
  const success = writeConfigFile(newConfig);
  if (success) {
    startPythonWorker(); // Khởi động lại worker với config mới
  }
  return success;
});

ipcMain.handle('get-worker-status', async () => {
  return {
    running: Boolean(workerProcess && !workerProcess.killed),
    pid: workerProcess ? workerProcess.pid : null,
  };
});

ipcMain.handle('start-worker', async () => {
  startPythonWorker();
  return { running: Boolean(workerProcess && !workerProcess.killed) };
});

ipcMain.handle('stop-worker', async () => {
  stopPythonWorker();
  return { running: false };
});

ipcMain.handle('test-ping', async (event, targetWsUrl) => {
  const startTime = Date.now();
  try {
    const rawUrl = targetWsUrl || 'ws://localhost:4000/api/v1/distributed/ws';
    const httpUrl = rawUrl.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
    const u = new URL(httpUrl);
    const client = u.protocol === 'https:' ? https : http;

    return await new Promise((resolve) => {
      // Ping endpoint /api/v1/distributed/nodes hoặc root endpoint
      const checkPath = u.pathname.includes('/ws') ? u.pathname.replace('/ws', '/nodes') : '/api/v1/distributed/nodes';
      const req = client.get(
        {
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: checkPath,
          timeout: 3000,
        },
        (res) => {
          const latency = Date.now() - startTime;
          resolve({ ok: true, latency, status: res.statusCode });
        }
      );

      req.on('error', (err) => {
        resolve({ ok: false, error: err.message, latency: Date.now() - startTime });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, error: 'Hết thời gian chờ (Timeout 3s)', latency: 3000 });
      });
    });
  } catch (err) {
    return { ok: false, error: err.message, latency: Date.now() - startTime };
  }
});

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

app.on('before-quit', () => {
  stopPythonWorker();
});

app.on('will-quit', () => {
  stopPythonWorker();
});

app.on('window-all-closed', () => {
  stopPythonWorker();
  if (process.platform !== 'darwin') app.quit();
});

process.on('exit', () => {
  stopPythonWorker();
});

process.on('SIGINT', () => {
  stopPythonWorker();
  process.exit();
});

process.on('SIGTERM', () => {
  stopPythonWorker();
  process.exit();
});
