export const studioModalHtml = `
  <div id="studio-panel" class="glass-panel">
    <div class="panel-header">
      <div class="panel-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
        <span>3D Avatar &amp; Physics Studio</span>
      </div>
      <button id="btn-close-studio" class="icon-btn-tiny" type="button" title="Đóng Studio">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="studio-section">
      <div class="studio-section-title">Kho Nhân Vật 3D &amp; VRM Thực Tế</div>
      <div class="preset-list">
        <button id="preset-alicia" class="preset-btn" type="button">
          <span>Alicia Solid (.VRM Chuẩn Anime)</span>
          <span class="preset-tag">CDN VRM 0.0</span>
        </button>
        <button id="preset-vrm1" class="preset-btn" type="button">
          <span>Avatar Sample A (.VRM 1.0)</span>
          <span class="preset-tag">CDN VRM 1.0</span>
        </button>
        <button id="preset-builtin" class="preset-btn" type="button">
          <span>Cyber Idol 3D (Built-in Anime Rig)</span>
          <span class="preset-tag">Offline 3D</span>
        </button>
        <button id="preset-microduck" class="preset-btn" type="button">
          <span>NVIDIA MicroDuck (BDX Droid 3D)</span>
          <span class="preset-tag">NVIDIA Robot</span>
        </button>
      </div>

      <div class="url-row">
        <input id="vrm-url-input" class="studio-input" type="text" placeholder="Dán link trực tiếp file .vrm hoặc .glb (https://...)" />
        <button id="btn-load-url" class="studio-btn-primary" type="button">Tải URL</button>
      </div>

      <button id="btn-studio-file" class="studio-btn-full" type="button">
        Mở File .VRM / .GLB từ Máy Tính (Hoặc kéo thả)
      </button>
    </div>

    <div class="studio-section">
      <div class="studio-section-title">Tinh Chỉnh Vật Lý &amp; Hành Vi</div>

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

      <div class="slider-row">
        <div class="slider-label">
          <span>Độ nảy khi rơi/ném (Bounce)</span>
          <span id="val-bounce" class="slider-val">0.42</span>
        </div>
        <input id="slider-bounce" type="range" min="0.0" max="0.75" step="0.05" value="0.42" />
      </div>

      <label class="toggle-row">
        <span>Tự động đi dạo &amp; leo cửa sổ</span>
        <input id="chk-autoroam" type="checkbox" checked />
      </label>

      <label class="toggle-row">
        <span>Mắt &amp; đầu nhìn theo con trỏ chuột</span>
        <input id="chk-lookat" type="checkbox" checked />
      </label>

      <label class="toggle-row">
        <span>Tương tác vật lý &amp; đẩy cửa sổ lân cận</span>
        <input id="chk-win-interact" type="checkbox" checked />
      </label>
    </div>

    <div class="studio-section" style="margin-bottom: 0;">
      <div class="studio-section-title">LLM Phân Luồng (Local Ollama + Gemini API) &amp; Cảnh Báo</div>

      <div class="url-row">
        <input id="input-ollama-model" class="studio-input" type="text" value="qwen2.5:1.5b" placeholder="Tên model Ollama (vd: qwen2.5:1.5b)" />
      </div>

      <div class="url-row" style="margin-top: 6px;">
        <input id="input-gemini-key" class="studio-input" type="password" placeholder="Gemini API Key (AIzaSy...)" />
        <input id="input-gemini-model" class="studio-input" type="text" value="gemini-2.5-flash" style="max-width: 135px;" title="Tên model Gemini" />
      </div>

      <div class="url-row" style="margin-top: 6px;">
        <select id="select-llm-route" class="studio-input" style="width: 100%; background: rgba(15, 23, 42, 0.88); color: #f8fafc;">
          <option value="auto">Phân luồng Tự động (Local cá nhân + Gemini tri thức)</option>
          <option value="gemini">Ưu tiên Gemini API (Model lớn)</option>
          <option value="local">Chỉ dùng Local Ollama (Offline 100%)</option>
        </select>
      </div>

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
`;

