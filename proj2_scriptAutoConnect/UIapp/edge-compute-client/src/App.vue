<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { Command } from "@tauri-apps/plugin-shell";
import TitleBar from "./components/TitleBar.vue";

// --- Trạng thái quy trình ---
const hwScanned = ref(false);
const isScanning = ref(false);
const serverVerified = ref(false);
const isPinging = ref(false);
const pingLatency = ref<number | null>(null);
const isRunning = ref(false);

// --- Thông số phần cứng & cấu hình ---
const serverUri = ref("ws://localhost:8080/ws");
const token = ref("node_worker_01");
const maxCpu = ref(0);
const maxRam = ref(0);
const gpuInfo = ref("Not scanned");
const osInfo = ref("-");
const cpuCores = ref(1);
const ramGb = ref(2);
const supportedModels = ref<string[]>([]);

// --- Telemetry thời gian thực ---
const liveCpuPercent = ref(0);
const liveRamUsed = ref(0);
const connStatus = ref("Standby");
const uptime = ref(0);
let uptimeTimer: number | null = null;
let workerProcess: any = null;

// Kiểm tra điều kiện mở khóa Step 3
const canConfigure = computed(() => hwScanned.value && serverVerified.value);

// Định dạng thời gian Uptime (HH:MM:SS)
const formatUptime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

// --- BƯỚC 1: Quét phần cứng qua Python Sidecar (--scan) ---
const handleScanHardware = async () => {
  isScanning.value = true;
  try {
    const cmd = Command.sidecar("binaries/worker", ["--scan"]);
    const out = await cmd.execute();
    const lines = out.stdout.split("\n");
    for (const line of lines) {
      if (line.startsWith("HW_INFO:")) {
        const data = JSON.parse(line.replace("HW_INFO:", "").trim());
        const totalCpu = data.cpu_cores_total || 4;
        const totalRam = Math.max(2, Math.round(data.system_ram_total_gb || 8));
        
        maxCpu.value = totalCpu;
        maxRam.value = totalRam;
        osInfo.value = data.os || "Windows";
        cpuCores.value = Math.max(1, Math.floor(totalCpu / 2));
        ramGb.value = Math.max(1, Math.floor(totalRam / 2));
        supportedModels.value = data.supported_models || [];
        gpuInfo.value = data.has_gpu ? `${data.gpu_name} (${data.vram_gb} GB)` : "CPU Only (No Dedicated GPU)";
        hwScanned.value = true;
      }
    }
  } catch (err) {
    console.error("Scan failed:", err);
    alert("Không thể thực thi trình quét phần cứng.");
  } finally {
    isScanning.value = false;
  }
};

// --- BƯỚC 2: Kiểm tra kết nối Go Server qua Python Sidecar (--ping) ---
const handlePingServer = async () => {
  if (!serverUri.value.trim()) return;
  isPinging.value = true;
  serverVerified.value = false;
  pingLatency.value = null;

  try {
    const cmd = Command.sidecar("binaries/worker", ["--ping", serverUri.value.trim()]);
    const out = await cmd.execute();
    const lines = out.stdout.split("\n");
    let found = false;
    for (const line of lines) {
      if (line.startsWith("PING_RESULT:")) {
        found = true;
        const res = JSON.parse(line.replace("PING_RESULT:", "").trim());
        if (res.ok) {
          serverVerified.value = true;
          pingLatency.value = res.latency_ms;
          connStatus.value = "Server Verified";
        } else {
          serverVerified.value = false;
          connStatus.value = "Connection Refused";
        }
      }
    }
    if (!found) connStatus.value = "Ping Timeout";
  } catch (err) {
    console.error("Ping error:", err);
    connStatus.value = "Ping Error";
  } finally {
    isPinging.value = false;
  }
};

// --- BƯỚC 3 & CHẠY: Khởi chạy Worker & Stream Telemetry (--run) ---
const toggleWorker = async () => {
  if (!isRunning.value) {
    if (!hwScanned.value || !serverVerified.value) return;
    try {
      connStatus.value = "Connecting...";
      const command = Command.sidecar("binaries/worker", [
        "--run",
        serverUri.value.trim(),
        token.value.trim() || "default_token",
        cpuCores.value.toString(),
        ramGb.value.toString(),
      ]);

      command.stdout.on("data", (line: string) => {
        const clean = line.trim();
        if (clean.startsWith("STATUS:CONNECTED")) {
          connStatus.value = "Streaming Telemetry";
        } else if (clean.startsWith("STATUS:DISCONNECTED")) {
          connStatus.value = "Reconnecting...";
        } else if (clean.startsWith("METRICS:")) {
          try {
            const m = JSON.parse(clean.replace("METRICS:", ""));
            liveCpuPercent.value = m.cpu_usage_percent;
            liveRamUsed.value = m.ram_used_gb;
          } catch (e) {}
        }
      });

      command.on("close", () => {
        stopUptimeTimer();
        isRunning.value = false;
        workerProcess = null;
        connStatus.value = "Standby";
      });

      workerProcess = await command.spawn();
      isRunning.value = true;
      startUptimeTimer();
    } catch (error) {
      console.error("Spawn error:", error);
      connStatus.value = "Spawn Failed";
    }
  } else {
    if (workerProcess) {
      try {
        await workerProcess.kill();
      } catch (e) {}
    }
    stopUptimeTimer();
    workerProcess = null;
    isRunning.value = false;
    connStatus.value = "Server Verified";
  }
};

const startUptimeTimer = () => {
  uptime.value = 0;
  uptimeTimer = window.setInterval(() => {
    uptime.value += 1;
  }, 1000);
};

const stopUptimeTimer = () => {
  if (uptimeTimer) {
    clearInterval(uptimeTimer);
    uptimeTimer = null;
  }
};

onUnmounted(() => {
  stopUptimeTimer();
  if (workerProcess) workerProcess.kill();
});
</script>

<template>
  <div class="app-layout">
    <!-- Thanh tiêu đề tùy chỉnh -->
    <TitleBar />

    <!-- Khu vực nội dung chính -->
    <div class="main-content">
      <div class="card-container">
        
        <!-- Header Top -->
        <div class="header-box">
          <div class="logo-title">
            <div class="icon-wrapper">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <h2 class="app-title">EDGE COMPUTE CLIENT</h2>
              <p class="app-subtitle">Hardware Provisioning & Telemetry Node</p>
            </div>
          </div>

          <div class="status-badge">
            <span class="dot" :class="{ active: isRunning, ready: serverVerified && !isRunning }"></span>
            <span class="status-text">{{ isRunning ? "STREAMING" : serverVerified ? "READY" : "UNVERIFIED" }}</span>
          </div>
        </div>

        <!-- STEP 1: HARDWARE DIAGNOSTICS -->
        <div class="step-card" :class="{ completed: hwScanned }">
          <div class="step-header">
            <span class="step-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
              </svg>
              STEP 1: HARDWARE DIAGNOSTICS
            </span>
            <button @click="handleScanHardware" :disabled="isRunning || isScanning" class="action-btn">
              {{ isScanning ? "Scanning..." : hwScanned ? "Rescan Specs" : "Scan Hardware" }}
            </button>
          </div>

          <div class="specs-grid">
            <div>
              <span class="spec-title">OS / CPU Total</span>
              <strong>{{ hwScanned ? `${osInfo} / ${maxCpu} Cores` : "Pending scan..." }}</strong>
            </div>
            <div>
              <span class="spec-title">System Memory</span>
              <strong>{{ hwScanned ? `${maxRam} GB RAM` : "Pending scan..." }}</strong>
            </div>
            <div style="grid-column: span 2;">
              <span class="spec-title">Accelerator</span>
              <strong style="color: #38bdf8;">{{ gpuInfo }}</strong>
            </div>
            <div v-if="supportedModels.length > 0" style="grid-column: span 2;">
              <span class="spec-title">Supported Models</span>
              <div class="models-tags">
                <span v-for="m in supportedModels" :key="m" class="tag">{{ m }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- STEP 2: SERVER VERIFICATION -->
        <div class="step-card" :class="{ completed: serverVerified }">
          <div class="step-header">
            <span class="step-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              STEP 2: CORE SERVER VERIFICATION
            </span>
            <span v-if="pingLatency !== null" class="latency-text">Online ({{ pingLatency }} ms)</span>
          </div>

          <div class="input-row">
            <input 
              type="text" 
              v-model="serverUri" 
              @input="serverVerified = false"
              :disabled="isRunning" 
              placeholder="ws://localhost:8080/ws" 
              class="text-input font-mono"
            />
            <button @click="handlePingServer" :disabled="isRunning || isPinging" class="action-btn">
              {{ isPinging ? "Checking..." : serverVerified ? "Verified" : "Check Server" }}
            </button>
          </div>
        </div>

        <!-- STEP 3: RESOURCE ALLOCATION & TOKEN -->
        <div class="step-card" :style="{ opacity: canConfigure ? 1 : 0.45, pointerEvents: canConfigure ? 'auto' : 'none' }">
          <div class="step-header">
            <span class="step-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
              </svg>
              STEP 3: RESOURCE ALLOCATION & TOKEN
            </span>
          </div>

          <div style="margin-bottom: 12px;">
            <label class="input-label">NODE AUTHENTICATION TOKEN</label>
            <input type="text" v-model="token" :disabled="isRunning" class="text-input font-mono" />
          </div>

          <!-- CPU Slider -->
          <div class="slider-group">
            <div class="slider-info">
              <span>Allocated CPU Cores</span>
              <span class="highlight">{{ cpuCores }} / {{ maxCpu }} Cores</span>
            </div>
            <input type="range" min="1" :max="maxCpu || 1" v-model.number="cpuCores" :disabled="isRunning" class="custom-range" />
          </div>

          <!-- RAM Slider -->
          <div class="slider-group">
            <div class="slider-info">
              <span>Allocated RAM Limit</span>
              <span class="highlight">{{ ramGb }} / {{ maxRam }} GB</span>
            </div>
            <input type="range" min="1" :max="maxRam || 2" step="1" v-model.number="ramGb" :disabled="isRunning" class="custom-range" />
          </div>
        </div>

        <!-- REALTIME TELEMETRY PANEL -->
        <div class="telemetry-panel">
          <div>
            <span class="telemetry-title">UPTIME</span>
            <span class="telemetry-val font-mono">{{ formatUptime(uptime) }}</span>
          </div>
          <div>
            <span class="telemetry-title">LIVE LOAD</span>
            <span class="telemetry-val font-mono" style="color: #38bdf8;">
              {{ isRunning ? `${liveCpuPercent}% | ${liveRamUsed}GB` : "-" }}
            </span>
          </div>
          <div style="text-align: right;">
            <span class="telemetry-title">STATUS</span>
            <span class="telemetry-val" :style="{ color: isRunning ? '#4ade80' : '#94a3b8' }">{{ connStatus }}</span>
          </div>
        </div>

        <!-- START / STOP BUTTON -->
        <button 
          @click="toggleWorker" 
          :disabled="!canConfigure && !isRunning" 
          class="run-btn"
          :class="{ active: isRunning, locked: !canConfigure && !isRunning }"
        >
          <span v-if="isRunning">⏹ STOP TELEMETRY & DISCONNECT</span>
          <span v-else>▶ {{ canConfigure ? "START NODE & STREAM TELEMETRY" : "COMPLETE STEP 1 & 2 TO UNLOCK" }}</span>
        </button>

      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #060913;
  color: #f8fafc;
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
  user-select: none;
}

.main-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background-image: radial-gradient(circle at 50% 0%, #172554 0%, #060913 70%);
  padding: 16px;
  overflow-y: auto;
}

.card-container {
  width: 100%;
  max-width: 480px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(51, 65, 85, 0.6);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.7);
}

.header-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.logo-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-wrapper {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.app-subtitle {
  margin: 2px 0 0 0;
  font-size: 11px;
  color: #64748b;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(2, 6, 23, 0.8);
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(51, 65, 85, 0.7);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #64748b;
}
.dot.ready { background-color: #38bdf8; }
.dot.active { background-color: #22c55e; }

.status-text {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
}

.step-card {
  background: rgba(2, 6, 23, 0.55);
  border: 1px solid rgba(51, 65, 85, 0.6);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 12px;
  transition: border-color 0.2s;
}
.step-card.completed {
  border-color: rgba(34, 197, 94, 0.35);
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.step-label {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  background: #0284c7;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}
.action-btn:hover:not(:disabled) { background: #0369a1; }
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.specs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 11px;
  color: #cbd5e1;
}
.spec-title { color: #64748b; display: block; }

.models-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.tag {
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-family: monospace;
}

.input-row {
  display: flex;
  gap: 8px;
}

.text-input {
  flex: 1;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(51, 65, 85, 0.8);
  background: rgba(15, 23, 42, 0.8);
  color: #f8fafc;
  font-size: 12px;
  outline: none;
}
.text-input:focus { border-color: #38bdf8; }

.input-label {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  display: block;
  margin-bottom: 4px;
}

.slider-group {
  margin-top: 10px;
}
.slider-info {
  display: flex;
  justify-content: between;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 4px;
}
.slider-info span:last-child { margin-left: auto; color: #38bdf8; }

.custom-range {
  width: 100%;
  accent-color: #38bdf8;
  cursor: pointer;
}

.telemetry-panel {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  background: rgba(30, 41, 59, 0.45);
  border: 1px solid rgba(51, 65, 85, 0.5);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
  font-size: 11px;
}
.telemetry-title { color: #64748b; display: block; font-size: 10px; }
.telemetry-val { color: #f8fafc; font-weight: 700; }

.run-btn {
  background: #0284c7;
  color: #ffffff;
  border: none;
  padding: 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  border-radius: 10px;
  cursor: pointer;
  width: 100%;
  transition: background 0.2s;
}
.run-btn:hover:not(:disabled) { background: #0369a1; }
.run-btn.active { background: #dc2626; }
.run-btn.active:hover { background: #b91c1c; }
.run-btn.locked { background: #1e293b; color: #64748b; cursor: not-allowed; }

.font-mono { font-family: 'JetBrains Mono', monospace; }
.latency-text { font-size: 10px; color: #4ade80; font-weight: 700; }
</style>