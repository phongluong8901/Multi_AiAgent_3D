export const studioModalHtml = `
  <div id="studio-panel" class="glass-panel">
    <div class="panel-header">
      <div class="panel-title" style="flex-wrap: wrap;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
        <span>3D Studio &amp; Cấu Hình Hệ Thống</span>
        <span class="badge" style="background: rgba(52, 211, 153, 0.16); color: #6ee7b7; border-color: rgba(52, 211, 153, 0.35); font-size: 9.5px; text-transform: none;">[SQLite: mate_memory.db]</span>
      </div>
      <button id="btn-close-studio" class="icon-btn-tiny" type="button" title="Đóng Studio (Esc)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- Tab Navigation -->
    <div class="studio-tabs-bar">
      <button id="tab-btn-studio-system" class="studio-tab-btn active" type="button">Hệ Thống</button>
      <button id="tab-btn-studio-avatar" class="studio-tab-btn" type="button">Nhân Vật</button>
      <button id="tab-btn-studio-physics" class="studio-tab-btn" type="button">Vật Lý 3D</button>
      <button id="tab-btn-studio-llm" class="studio-tab-btn" type="button">AI &amp; Cảnh Báo</button>
    </div>

    <!-- TAB 1: HỆ THỐNG, LỊCH TRÌNH, THỜI TIẾT & ÂM THANH -->
    <div id="studio-tab-system" class="studio-tab-pane">
      <div class="studio-section" style="margin-bottom: 10px;">
        <div class="studio-section-title">Giao Diện, Âm Thanh &amp; Thông Báo</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
          <button id="btn-cfg-hide-all" class="action-btn" type="button">Ẩn Hết Bảng &amp; Chat</button>
          <button id="btn-cfg-show-ui" class="action-btn" type="button" style="border-color: rgba(56, 189, 248, 0.42); color: #bae6fd;">Hiện Lại Giao Diện</button>
        </div>
        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
          <button id="btn-cfg-open-notif" class="studio-btn-primary" type="button" style="flex: 1; background: rgba(14, 165, 233, 0.25); border: 1px solid rgba(56, 189, 248, 0.45); color: #7dd3fc;">Quản Lý Notification (Windows &amp; Web)</button>
        </div>
        <div class="url-row" style="margin-bottom: 8px; align-items: center;">
          <span style="font-size: 11px; color: #cbd5e1; white-space: nowrap;">Vị trí Cửa sổ Chat:</span>
          <select id="select-chat-dock-side" class="studio-input" style="flex: 1; background: rgba(15, 23, 42, 0.88); color: #f8fafc;">
            <option value="right">Theo nhân vật (bên Phải)</option>
            <option value="left">Theo nhân vật (bên Trái)</option>
          </select>
        </div>

        <div class="studio-subcard" style="margin-top: 4px; margin-bottom: 6px;">
          <div class="studio-subcard-title">Hiệu Năng &amp; Tiết Kiệm Tài Nguyên (WebView2)</div>
          <label class="toggle-row" style="margin-bottom: 0;">
            <span>Chế độ Tiết Kiệm Pin (Eco — Tắt mặc định để Vịt chạy mượt Native FPS)</span>
            <input id="chk-cfg-eco-mode" type="checkbox" />
          </label>
        </div>

        <div class="studio-subcard" style="margin-top: 4px;">
          <div class="studio-subcard-title">Âm Thanh (Sound &amp; Voice TTS)</div>
          <label class="toggle-row">
            <span>Giọng đọc Tiếng Việt của Vịt (Voice TTS)</span>
            <input id="chk-cfg-voice-tts" type="checkbox" checked />
          </label>
          <label class="toggle-row">
            <span>Âm thanh hiệu ứng vật lý (Spatial Sound FX)</span>
            <input id="chk-sound-fx" type="checkbox" checked />
          </label>
          <label class="toggle-row">
            <span style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span>Cảm ứng nhạc hệ thống &amp; Sóng Nhạc 3D (WASAPI Beat Sync)</span>
              <span id="studio-audio-live-badge" class="badge" style="font-size: 9px; padding: 1px 6px;">[AUDIO: NGHỈ]</span>
            </span>
            <input id="chk-cfg-audio-beat-3d" type="checkbox" checked />
          </label>
          <div class="slider-row" id="row-sound-volume" style="margin-top: 4px; margin-bottom: 0;">
            <div class="slider-label">
              <span>Âm lượng Sound FX</span>
              <span id="val-sound-volume" class="slider-val">70%</span>
            </div>
            <input id="slider-sound-volume" type="range" min="0" max="1" step="0.05" value="0.7" />
          </div>
        </div>
      </div>

      <div class="studio-section" style="margin-bottom: 10px;">
        <div class="studio-section-title">Lịch Tự Động Quét Radar &amp; Hiển Thị (Phút, nhập 0 để tắt)</div>
        <div class="cfg-schedule-row">
          <span style="font-size: 11px; color: #ddd6fe;">Học Tiếng Anh mỗi (phút):</span>
          <input id="input-cfg-english-min" class="studio-input" type="number" min="0" max="360" step="1" value="15" />
          <button id="btn-cfg-test-english" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;">Hiện ngay</button>
        </div>
        <div class="cfg-schedule-row">
          <span style="font-size: 11px; color: #6ee7b7;">Đọc Tin Mới mỗi (phút):</span>
          <input id="input-cfg-news-min" class="studio-input" type="number" min="0" max="360" step="1" value="20" />
          <button id="btn-cfg-test-news" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;">Đọc ngay</button>
        </div>
        <div class="cfg-schedule-row">
          <span style="font-size: 11px; color: #7dd3fc;">Thời Tiết &amp; Độ Ẩm mỗi (phút):</span>
          <input id="input-cfg-weather-min" class="studio-input" type="number" min="0" max="360" step="1" value="30" />
          <button id="btn-cfg-test-weather" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;">Xem ngay</button>
        </div>
        <div class="cfg-schedule-row">
          <span style="font-size: 11px; color: #fcd34d;">Hiệu Năng App (CPU/RAM) mỗi (phút):</span>
          <input id="input-cfg-app-metrics-min" class="studio-input" type="number" min="0" max="360" step="1" value="25" />
          <button id="btn-cfg-test-app-metrics" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;">Quét ngay</button>
        </div>
        <div class="cfg-schedule-row" style="margin-bottom: 0;">
          <span style="font-size: 11px; color: #fda4af;">Giá Bitcoin (BTC) mỗi (phút):</span>
          <input id="input-cfg-btc-min" class="studio-input" type="number" min="0" max="360" step="1" value="30" />
          <button id="btn-cfg-test-btc" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;">Quét ngay</button>
        </div>
      </div>

      <div class="studio-section" style="margin-bottom: 0;">
        <div class="studio-section-title">Thời Tiết &amp; Độ Ẩm (API / Custom)</div>
        <select id="select-cfg-weather-source" class="studio-input" style="width: 100%; margin-bottom: 7px; background: rgba(15, 23, 42, 0.88); color: #f8fafc;">
          <option value="api">Đồng bộ tự động theo API Thời tiết (wttr / Open-Meteo)</option>
          <option value="custom">Tự đặt Thời tiết &amp; Độ ẩm (Custom thủ công)</option>
        </select>

        <div id="studio-weather-live-preview" style="font-size: 10.5px; color: #bae6fd; background: rgba(2, 6, 23, 0.55); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 7px; padding: 6px 8px; margin-bottom: 7px;">
          [WEATHER] Chưa cập nhật dữ liệu thời tiết.
        </div>

        <div id="cfg-weather-api-box" class="url-row" style="margin-bottom: 0;">
          <input id="input-cfg-weather-city" class="studio-input" type="text" value="auto" placeholder="auto hoặc Hanoi, Ho Chi Minh, Da Nang..." />
          <button id="btn-cfg-sync-weather-api" class="studio-btn-primary" type="button" style="white-space: nowrap;">Lấy API Ngay</button>
        </div>

        <div id="cfg-weather-custom-box" style="display: none;">
          <select id="select-cfg-weather-custom-mode" class="studio-input" style="width: 100%; margin-bottom: 6px; background: rgba(15, 23, 42, 0.88); color: #f8fafc;">
            <option value="clear">Chế độ 3D: Trời quang đãng (Clear)</option>
            <option value="hot">Chế độ 3D: Nắng nóng + Mặt Trời (Hot)</option>
            <option value="rain">Chế độ 3D: Mưa + Mây Sấm Sét (Rain)</option>
            <option value="cold">Chế độ 3D: Tuyết rơi + Người Tuyết (Cold)</option>
            <option value="wind">Chế độ 3D: Gió xoáy 3D (Wind)</option>
            <option value="night">Chế độ 3D: Ban Đêm + Trăng Sao (Night)</option>
          </select>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
            <div>
              <div class="slider-label" style="margin-bottom: 3px;"><span>Nhiệt độ (°C)</span></div>
              <input id="input-cfg-weather-temp" class="studio-input" type="number" min="-30" max="55" step="0.5" value="28" />
            </div>
            <div>
              <div class="slider-label" style="margin-bottom: 3px;"><span>Độ ẩm (%)</span></div>
              <input id="input-cfg-weather-hum" class="studio-input" type="number" min="0" max="100" step="1" value="68" />
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 7px;">
            <input id="input-cfg-weather-loc" class="studio-input" type="text" value="Tùy chỉnh" placeholder="Khu vực (vd: Hà Nội)" />
            <input id="input-cfg-weather-desc" class="studio-input" type="text" value="Trời quang đãng" placeholder="Mô tả thời tiết..." />
          </div>
          <button id="btn-cfg-apply-weather-custom" class="studio-btn-full" type="button" style="margin-bottom: 0;">
            Áp Dụng Thời Tiết &amp; Độ Ẩm Custom
          </button>
        </div>
      </div>
    </div>

    <!-- TAB 2: NHÂN VẬT & SKIN -->
    <div id="studio-tab-avatar" class="studio-tab-pane" style="display: none;">
      <div class="studio-section" style="margin-bottom: 0;">
        <div class="studio-section-title">Kho Nhân Vật 3D &amp; VRM Thực Tế</div>
        <div class="preset-list">
          <button id="preset-microduck" class="preset-btn" type="button">
            <span>NVIDIA MicroDuck (BDX Droid 3D)</span>
            <span class="preset-tag">NVIDIA Robot</span>
          </button>
          <button id="preset-builtin" class="preset-btn" type="button">
            <span>Cyber Idol 3D (Built-in Anime Rig)</span>
            <span class="preset-tag">Offline 3D</span>
          </button>
          <button id="preset-alicia" class="preset-btn" type="button">
            <span>Alicia Solid (.VRM Chuẩn Anime)</span>
            <span class="preset-tag">CDN VRM 0.0</span>
          </button>
          <button id="preset-vrm1" class="preset-btn" type="button">
            <span>Avatar Sample A (.VRM 1.0)</span>
            <span class="preset-tag">CDN VRM 1.0</span>
          </button>
        </div>

        <div class="url-row">
          <input id="vrm-url-input" class="studio-input" type="text" placeholder="Dán link trực tiếp file .vrm hoặc .glb (https://...)" />
          <button id="btn-load-url" class="studio-btn-primary" type="button">Tải URL</button>
        </div>

        <button id="btn-studio-file" class="studio-btn-full" type="button">
          Mở File .VRM / .GLB từ Máy Tính (Hỗ trợ Draco nén)
        </button>

        <div class="studio-subcard">
          <div class="studio-subcard-title">Skin Tùy Biến MicroDuck</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div>
              <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 3px;">Màu Vỏ Đầu &amp; Thân</label>
              <input id="color-duck-body" type="color" value="#f4f4f6" style="width: 100%; height: 28px; border: 1px solid rgba(148,163,184,0.25); border-radius: 6px; cursor: pointer; background: rgba(15,23,42,0.7); padding: 2px;" />
            </div>
            <div>
              <label style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 3px;">Màu Mỏ &amp; Bàn Chân</label>
              <input id="color-duck-accent" type="color" value="#f97316" style="width: 100%; height: 28px; border: 1px solid rgba(148,163,184,0.25); border-radius: 6px; cursor: pointer; background: rgba(15,23,42,0.7); padding: 2px;" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: VẬT LÝ & ÂM THANH -->
    <div id="studio-tab-physics" class="studio-tab-pane" style="display: none;">
      <div class="studio-section" style="margin-bottom: 0;">
        <div class="studio-section-title">Tinh Chỉnh Vật Lý &amp; Hành Vi 3D</div>

        <div class="slider-row">
          <div class="slider-label">
            <span>Kích thước nhân vật (Scale)</span>
            <span id="val-scale" class="slider-val">1.00x</span>
          </div>
          <input id="slider-scale" type="range" min="0.6" max="1.8" step="0.05" value="1.0" />
        </div>

        <div class="slider-row">
          <div class="slider-label">
            <span>Trọng lực (Gravity)</span>
            <span id="val-gravity" class="slider-val">0.68</span>
          </div>
          <input id="slider-gravity" type="range" min="0.2" max="1.5" step="0.05" value="0.68" />
        </div>

        <div class="slider-row" style="margin-bottom: 0;">
          <div class="slider-label">
            <span>Độ nảy khi rơi/ném (Bounce)</span>
            <span id="val-bounce" class="slider-val">0.42</span>
          </div>
          <input id="slider-bounce" type="range" min="0.0" max="0.75" step="0.05" value="0.42" />
        </div>

        <div class="studio-subcard">
          <div class="studio-subcard-title">Hành Vi Tự Động &amp; Thời Gian Hiển Thị</div>
          <label class="toggle-row">
            <span>Bật Hành Vi Tự Động (Tổng)</span>
            <input id="chk-autoroam" type="checkbox" checked />
          </label>

          <label class="toggle-row">
            <span>Mắt &amp; đầu nhìn theo con trỏ chuột</span>
            <input id="chk-lookat" type="checkbox" checked />
          </label>

          <label class="toggle-row">
            <span>Cho phép tương tác vật lý &amp; đẩy cửa sổ lân cận</span>
            <input id="chk-win-interact" type="checkbox" checked />
          </label>

          <div class="auto-interval-row">
            <span style="font-size: 11px; color: #cbd5e1;">Thời gian giữa mỗi hành động (giây):</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <input id="input-auto-action-sec" class="studio-input" type="number" min="5" max="300" step="1" value="15" style="width: 68px; text-align: center;" />
              <span style="font-size: 10.5px; color: #94a3b8;">s/lần</span>
            </div>
          </div>

          <div class="auto-sec-preset-group">
            <button class="chat-chip auto-sec-preset-btn" type="button" data-sec="10">10s</button>
            <button class="chat-chip auto-sec-preset-btn active" type="button" data-sec="15">15s (Mặc định)</button>
            <button class="chat-chip auto-sec-preset-btn" type="button" data-sec="30">30s</button>
            <button class="chat-chip auto-sec-preset-btn" type="button" data-sec="60">60s</button>
          </div>

          <div class="auto-behavior-toolbar">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="studio-subcard-title" style="margin-bottom: 0;">Tương Tác &amp; Hoạt Ảnh 3D Tự Động</span>
              <span id="auto-behavior-count-badge" class="badge" style="font-size: 9.5px; text-transform: none;">76/77 đang bật</span>
            </div>
            <div class="auto-behavior-actions">
              <button id="btn-auto-beh-all" class="chat-chip" type="button">Bật tất cả</button>
              <button id="btn-auto-beh-default" class="chat-chip" type="button">Mặc định</button>
              <button id="btn-auto-beh-none" class="chat-chip" type="button">Tắt tất cả</button>
            </div>
          </div>

          <div id="auto-behaviors-list" class="auto-behavior-grid"></div>
        </div>
      </div>
    </div>

    <!-- TAB 3: AI ENGINE & CẢNH BÁO -->
    <div id="studio-tab-llm" class="studio-tab-pane" style="display: none;">
      <div class="studio-section" style="margin-bottom: 10px;">
        <div class="studio-section-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Local Ollama &amp; Gemini API</span>
          <div style="display: flex; gap: 4px;">
            <span id="studio-ollama-status" class="badge" style="font-size: 9px;">[OLLAMA: ...]</span>
            <span id="studio-gemini-status" class="badge" style="font-size: 9px;">[GEMINI: ...]</span>
          </div>
        </div>

        <div class="url-row" style="margin-bottom: 5px;">
          <input id="input-ollama-model" class="studio-input" type="text" value="qwen2.5:1.5b" placeholder="Tên model Ollama (vd: qwen2.5:1.5b)" />
          <button id="btn-scan-ollama-models" class="studio-btn-primary" type="button" style="white-space: nowrap;">Quét Model Ollama</button>
        </div>
        <div id="ollama-models-chips" class="studio-chip-group" style="margin-bottom: 8px;"></div>

        <div class="url-row" style="margin-bottom: 5px;">
          <input id="input-gemini-key" class="studio-input" type="password" placeholder="Gemini API Key (đọc &amp; lưu trực tiếp tại file .env)" />
          <button id="btn-toggle-gemini-key" class="action-btn" type="button" style="padding: 5px 8px; font-size: 10.5px; flex-shrink: 0;">Hiện Key</button>
          <input id="input-gemini-model" class="studio-input" type="text" value="gemini-3.5-flash" style="max-width: 125px;" title="Tên model Gemini (vd: gemini-3.5-flash)" />
        </div>
        <div class="studio-chip-group" style="margin-bottom: 5px;">
          <button class="chat-chip gemini-preset-chip" type="button" data-model="gemini-3.5-flash">gemini-3.5-flash</button>
          <button class="chat-chip gemini-preset-chip" type="button" data-model="gemini-2.5-flash">gemini-2.5-flash</button>
          <button class="chat-chip gemini-preset-chip" type="button" data-model="gemini-2.5-pro">gemini-2.5-pro</button>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 8px; line-height: 1.35;">
          API Key được đọc/lưu tại file <code>.env</code> (nằm trong <code>.gitignore</code>, không lưu vào SQLite hay push lên Git).
        </div>

        <div class="url-row" style="margin-bottom: 0;">
          <select id="select-llm-route" class="studio-input" style="width: 100%; background: rgba(15, 23, 42, 0.88); color: #f8fafc;">
            <option value="auto">Phân luồng Tự động (Local nhanh + Gemini tri thức)</option>
            <option value="colab">Ưu tiên Colab GPU Cloud (Cloudflare -> Fallback)</option>
            <option value="gemini">Ưu tiên Gemini API (Model lớn)</option>
            <option value="local">Chỉ dùng Local Ollama (Offline 100%)</option>
          </select>
        </div>
      </div>

      <div class="studio-section" style="margin-bottom: 10px;">
        <div class="studio-section-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Colab GPU Cloud (model_local_cloud / Cloudflare)</span>
          <span id="studio-colab-status" class="badge" style="font-size: 9px;">[COLAB: CHƯA QUÉT]</span>
        </div>
        <div class="url-row" style="margin-bottom: 5px;">
          <input id="input-colab-url" class="studio-input" type="text" placeholder="https://....trycloudflare.com" />
          <input id="input-colab-model" class="studio-input" type="text" value="qwen2.5-coder:14b" style="max-width: 145px;" placeholder="qwen2.5-coder:14b" />
          <button id="btn-scan-colab" class="studio-btn-primary" type="button" style="white-space: nowrap;">Quét GPU Colab</button>
        </div>
        <div id="colab-models-chips" class="studio-chip-group" style="margin-bottom: 4px;"></div>
        <div style="font-size: 10px; color: #94a3b8; line-height: 1.35;">
          Quét thấy tunnel đang bật thì dùng ngay model GPU L4; nếu tắt Colab app tự bỏ qua dùng Local/Gemini.
        </div>
      </div>

      <div class="studio-section" style="margin-bottom: 0;">
        <div class="studio-section-title">Cảnh Báo Tài Nguyên &amp; Tự Động Hỏi Thăm</div>
        <label class="toggle-row">
          <span>Tự động hỏi thăm &amp; kiểm tra hệ thống định kỳ</span>
          <input id="chk-autocheck" type="checkbox" checked />
        </label>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
          <div>
            <div class="slider-label" style="margin-bottom: 4px;">
              <span>Cảnh báo CPU &gt; (%)</span>
            </div>
            <input id="input-alert-cpu" class="studio-input" type="number" min="10" max="100" step="5" value="85" />
          </div>
          <div>
            <div class="slider-label" style="margin-bottom: 4px;">
              <span>Cảnh báo RAM &gt; (GB)</span>
            </div>
            <input id="input-alert-ram" class="studio-input" type="number" min="1" max="128" step="0.5" value="12" />
          </div>
        </div>
      </div>
    </div>
  </div>
`;
