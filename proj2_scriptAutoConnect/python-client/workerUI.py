import asyncio
import json
import platform
import threading
import tkinter as tk
from tkinter import messagebox
import customtkinter as ctk
import psutil
import requests
import torch
import websockets

# Thiết lập giao diện hiện đại (Dark/Light theo hệ thống)
ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

# Địa chỉ Core Server (Go)
SERVER_URI = "ws://localhost:8080/ws"


class WorkerApp(ctk.CTk):

  def __init__(self):
    super().__init__()

    self.title("AI Compute Worker - Trạm Chia Sẻ Tài Nguyên")
    self.geometry("480x600")
    self.resizable(False, False)

    self.is_running = False
    self.websocket = None

    # Quét phần cứng gốc của máy
    self.max_cpu = psutil.cpu_count(logical=True)
    self.max_ram = round(psutil.virtual_memory().total / (1024**3), 2)
    self.detect_gpu()

    self.create_widgets()

  def detect_gpu(self):
    self.has_gpu = False
    self.gpu_name = "None"
    self.vram_gb = 0
    if torch.cuda.is_available():
      self.has_gpu = True
      self.gpu_name = torch.cuda.get_device_name(0)
      vram_bytes = torch.cuda.get_device_properties(0).total_memory
      self.vram_gb = round(vram_bytes / (1024**3), 2)

  def create_widgets(self):
    # Tiêu đề ứng dụng
    title_label = ctk.CTkLabel(
        self, text="⚡ AI COMPUTE WORKER", font=("Segoe UI", 20, "bold")
    )
    title_label.pack(pady=15)

    # Khung Token
    token_frame = ctk.CTkFrame(self)
    token_frame.pack(fill="x", padx=20, pady=5)

    ctk.CTkLabel(
        token_frame, text="Mã Token định danh:", font=("Segoe UI", 12, "bold")
    ).pack(anchor="w", padx=15, pady=(10, 0))
    self.token_entry = ctk.CTkEntry(
        token_frame, width=420, height=35, font=("Segoe UI", 12)
    )
    self.token_entry.insert(0, "token_nguoi_dung_abc123")
    self.token_entry.pack(padx=15, pady=(5, 15))

    # Khung Thông tin phần cứng
    hw_frame = ctk.CTkFrame(self)
    hw_frame.pack(fill="x", padx=20, pady=5)

    hw_text = (
        f"💻 CPU: {self.max_cpu} Cores | RAM: {self.max_ram} GB\n"
        f"🎮 GPU: {self.gpu_name}\n"
        f"🚀 VRAM: {self.vram_gb} GB"
    )
    hw_label = ctk.CTkLabel(
        hw_frame,
        text=hw_text,
        justify="left",
        font=("Segoe UI", 12),
        text_color="#888888",
    )
    hw_label.pack(anchor="w", padx=15, pady=12)

    # Khung Cấu hình giới hạn cho thuê (Dùng Slider thay cho nút bấm thô)
    config_frame = ctk.CTkFrame(self)
    config_frame.pack(fill="x", padx=20, pady=5)

    # Slider chọn CPU Core
    default_cpu = max(1, self.max_cpu // 2)
    self.cpu_label = ctk.CTkLabel(
        config_frame,
        text=f"Chia sẻ số Core CPU: {default_cpu} / {self.max_cpu}",
        font=("Segoe UI", 12, "bold"),
    )
    self.cpu_label.pack(anchor="w", padx=15, pady=(10, 0))

    self.cpu_slider = ctk.CTkSlider(
        config_frame,
        from_=1,
        to=self.max_cpu,
        number_of_steps=self.max_cpu - 1,
        command=self.update_cpu_text,
    )
    self.cpu_slider.set(default_cpu)
    self.cpu_slider.pack(fill="x", padx=15, pady=(5, 10))

    # Slider chọn RAM
    default_ram = max(1, int(self.max_ram // 2))
    self.ram_label = ctk.CTkLabel(
        config_frame,
        text=f"Chia sẻ dung lượng RAM: {default_ram} GB / {self.max_ram} GB",
        font=("Segoe UI", 12, "bold"),
    )
    self.ram_label.pack(anchor="w", padx=15, pady=(5, 0))

    self.ram_slider = ctk.CTkSlider(
        config_frame,
        from_=1,
        to=int(self.max_ram),
        number_of_steps=int(self.max_ram) - 1,
        command=self.update_ram_text,
    )
    self.ram_slider.set(default_ram)
    self.ram_slider.pack(fill="x", padx=15, pady=(5, 15))

    # Nút Bắt đầu / Dừng (Bo tròn, hiện đại)
    self.btn_toggle = ctk.CTkButton(
        self,
        text="🟢 BẮT ĐẦU CHO THUÊ",
        font=("Segoe UI", 14, "bold"),
        fg_color="#27ae60",
        hover_color="#219653",
        command=self.toggle_worker,
        height=45,
    )
    self.btn_toggle.pack(fill="x", padx=20, pady=15)

    # Khung Log hoạt động
    self.log_box = ctk.CTkTextbox(
        self, height=120, font=("Consolas", 10), fg_color="#1e1e1e"
    )
    self.log_box.pack(fill="both", expand=True, padx=20, pady=(0, 15))

  def update_cpu_text(self, value):
    self.cpu_label.configure(
        text=f"Chia sẻ số Core CPU: {int(value)} / {self.max_cpu}"
    )

  def update_ram_text(self, value):
    self.ram_label.configure(
        text=f"Chia sẻ dung lượng RAM: {int(value)} GB / {self.max_ram} GB"
    )

  def log(self, message):
    self.log_box.insert("end", message + "\n")
    self.log_box.see("end")

  def toggle_worker(self):
    if not self.is_running:
      token = self.token_entry.get().strip()
      if not token:
        messagebox.showerror("Lỗi", "Vui lòng nhập Token định danh!")
        return

      self.is_running = True
      self.btn_toggle.configure(text="🔴 DỪNG CHO THUÊ", fg_color="#c0392b")
      self.token_entry.configure(state="disabled")
      self.cpu_slider.configure(state="disabled")
      self.ram_slider.configure(state="disabled")

      self.thread = threading.Thread(
          target=self.start_async_loop, daemon=True
      )
      self.thread.start()
    else:
      self.is_running = False
      self.btn_toggle.configure(text="🟢 BẮT ĐẦU CHO THUÊ", fg_color="#27ae60")
      self.token_entry.configure(state="normal")
      self.cpu_slider.configure(state="normal")
      self.ram_slider.configure(state="normal")
      self.log("⚠️ Đã ngắt kết nối theo yêu cầu.")

  def start_async_loop(self):
    asyncio.run(self.run_websocket_client())

  async def run_websocket_client(self):
    allocated_cpu = int(self.cpu_slider.get())
    allocated_ram = int(self.ram_slider.get())
    token = self.token_entry.get().strip()

    self.log(
        f"⚙️ Đã cấu hình: Chia sẻ {allocated_cpu} Cores CPU |"
        f" {allocated_ram}GB RAM."
    )

    while self.is_running:
      try:
        self.log("🔌 Đang kết nối tới Core Server...")
        async with websockets.connect(SERVER_URI) as websocket:
          self.websocket = websocket

          hw_info = {
              "os": platform.system(),
              "allocated_cpu_cores": allocated_cpu,
              "allocated_system_ram_gb": float(allocated_ram),
              "has_gpu": self.has_gpu,
              "gpu_name": self.gpu_name,
              "vram_gb": self.vram_gb,
          }

          register_payload = {
              "type": "REGISTER_WORKER",
              "token": token,
              "hardware": hw_info,
          }
          await websocket.send(json.dumps(register_payload))
          self.log("🟢 Kết nối thành công! Đang sẵn sàng nhận việc...")

          async for message in websocket:
            if not self.is_running:
              break
            data = json.loads(message)
            if data.get("type") == "RUN_TASK":
              task_id = data.get("task_id")
              prompt = data.get("prompt")
              self.log(
                  f"📥 Nhận task mới [ID: {task_id}] với prompt: '{prompt}'"
              )

              simulated_response = f"Đã xử lý xong bằng tài nguyên giới hạn ({allocated_cpu} Cores)."
              for word in simulated_response.split():
                if not self.is_running:
                  break
                chunk_payload = {
                    "type": "STREAM_CHUNK",
                    "task_id": task_id,
                    "chunk": word + " ",
                }
                await websocket.send(json.dumps(chunk_payload))
                await asyncio.sleep(0.05)

              done_payload = {"type": "TASK_DONE", "task_id": task_id}
              await websocket.send(json.dumps(done_payload))
              self.log(f"✅ Hoàn thành task [ID: {task_id}]")

      except Exception as e:
        if self.is_running:
          self.log(f"⚠️ Mất kết nối: {e}. Thử lại sau 5 giây...")
          await asyncio.sleep(5)
        else:
          break


if __name__ == "__main__":
  app = WorkerApp()
  app.mainloop()