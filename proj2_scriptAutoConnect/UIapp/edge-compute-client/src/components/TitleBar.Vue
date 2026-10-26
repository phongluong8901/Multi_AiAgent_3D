<script setup lang="ts">
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

const handleMinimize = () => appWindow.minimize();
const handleMaximize = () => appWindow.toggleMaximize();
const handleClose = () => appWindow.close();
</script>

<template>
  <div data-tauri-drag-region class="titlebar">
    <!-- Tiêu đề bên trái (cho phép kéo cửa sổ) -->
    <div data-tauri-drag-region class="title-left">
      <span class="title-text">EDGE COMPUTE CLIENT — DESKTOP WORKER</span>
    </div>

    <!-- Các nút điều khiển bên phải (Tách biệt hoàn toàn để bấm không bị lỗi) -->
    <div class="window-controls">
      <button @click="handleMinimize" class="control-btn" title="Thu nhỏ">&#x2013;</button>
      <button @click="handleMaximize" class="control-btn" title="Phóng to">&#x25A1;</button>
      <button @click="handleClose" class="control-btn close-btn" title="Đóng">&#x2715;</button>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  height: 36px;
  background: #090d16;
  border-bottom: 1px solid rgba(51, 65, 85, 0.6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
  padding-left: 14px;
  flex-shrink: 0;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  height: 100%;
}

.title-text {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.5px;
  pointer-events: none;
}

.window-controls {
  display: flex;
  height: 100%;
}

.control-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s, color 0.2s;
}

.control-btn:hover {
  background: rgba(51, 65, 85, 0.4);
  color: #ffffff;
}

.close-btn:hover {
  background: #dc2626 !important;
  color: #ffffff !important;
}
</style>