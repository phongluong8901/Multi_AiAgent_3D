export const longMemoryModalHtml = `
  <div id="long-memory-panel" class="glass-panel">
    <div class="panel-header">
      <div class="panel-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-1a3 3 0 0 0 0-6v-1a3 3 0 0 0-3-3V6a4 4 0 0 0-4-4z"></path>
        </svg>
        <span>Thiết lập Long Memory &amp; Tính cách</span>
      </div>
      <button id="btn-close-long-mem" class="icon-btn-tiny" type="button" title="Đóng Long Memory">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="studio-section">
      <div class="studio-section-title">1. Prompt Tính cách Nhân vật (Persona)</div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px;">
        <button id="lm-preset-cute" class="btn-mini-action" type="button">Đáng yêu</button>
        <button id="lm-preset-dev" class="btn-mini-action" type="button">Senior Dev</button>
        <button id="lm-preset-tsun" class="btn-mini-action" type="button">Tsundere</button>
      </div>
      <textarea
        id="lm-persona-input"
        class="studio-input"
        rows="3"
        style="width: 100%; resize: vertical; line-height: 1.4;"
        placeholder="Mô tả tính cách, cách xưng hô, giọng điệu của nhân vật..."
      ></textarea>
      <button id="btn-save-persona" class="studio-btn-primary" type="button" style="width: 100%; margin-top: 6px;">
        Lưu Prompt Tính Cách
      </button>
    </div>

    <div class="studio-section">
      <div class="studio-section-title">2. Thêm Rule Dài hạn / Kiến thức Cố định</div>
      <div class="url-row">
        <select
          id="lm-cat-select"
          class="studio-input"
          style="max-width: 145px; background: rgba(15, 23, 42, 0.9); color: #f8fafc;"
        >
          <option value="rule">Rule dài hạn</option>
          <option value="knowledge">Kiến thức cố định</option>
        </select>
        <input id="lm-title-input" class="studio-input" type="text" placeholder="Tiêu đề (vd: Khi code, Giờ nghỉ...)" />
      </div>
      <div class="url-row" style="margin-bottom: 0;">
        <input id="lm-content-input" class="studio-input" type="text" placeholder="Nội dung quy tắc hoặc kiến thức cần nhớ mãi..." />
        <button id="btn-add-long-mem" class="studio-btn-primary" type="button">Thêm</button>
      </div>
    </div>

    <div class="studio-section" style="margin-bottom: 0;">
      <div class="studio-section-title">3. Danh sách Đang Lưu (SQLite: long_memory)</div>
      <div id="lm-list-container" style="max-height: 175px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
        <div class="dash-sub">Đang tải danh sách Long Memory...</div>
      </div>
    </div>
  </div>
`;

