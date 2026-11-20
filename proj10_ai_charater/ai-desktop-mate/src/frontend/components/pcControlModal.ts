export const pcControlModalHtml = `
  <div id="pc-control-modal" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <span>Điều Khiển Máy Tính, Google &amp; OCR</span>
      </div>
      <button id="btn-close-pc-control" class="icon-btn-tiny" type="button" title="Đóng bảng Điều Khiển Máy Tính (Esc)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- PHẦN 1: GOOGLE & MỞ NHANH ỨNG DỤNG -->
    <div class="studio-section" style="margin-bottom: 10px;">
      <div class="studio-section-title">Google Search &amp; Mở Nhanh Web / Ứng Dụng</div>
      <div class="url-row" style="margin-bottom: 8px;">
        <input id="input-pc-google-query" class="studio-input" type="text" placeholder="Nhập từ khóa tìm kiếm trên Google..." />
        <button id="btn-pc-google-search" class="studio-btn-primary" type="button" style="white-space: nowrap;">Tìm Google</button>
      </div>
      <div class="action-grid" style="grid-template-columns: repeat(3, 1fr);">
        <button id="btn-pc-google" class="action-btn" type="button" style="background: rgba(56, 189, 248, 0.2); border-color: rgba(56, 189, 248, 0.5); color: #7dd3fc;">Mở Google</button>
        <button id="btn-pc-yt" class="action-btn" type="button">YouTube</button>
        <button id="btn-pc-note" class="action-btn" type="button">Notepad</button>
        <button id="btn-pc-shot" class="action-btn" type="button">Chụp ảnh</button>
        <button id="btn-pc-openshot" class="action-btn" type="button">Mở ảnh</button>
        <button id="btn-pc-macro" class="action-btn" type="button">Macro: Code</button>
      </div>
    </div>

    <!-- PHẦN 2: OCR CẮT VÙNG DỊCH THUẬT & THỊ GIÁC -->
    <div class="studio-section" style="margin-bottom: 10px;">
      <div class="studio-section-title">OCR Cắt Vùng Dịch Thuật &amp; AI Thị Giác</div>
      <button id="btn-pc-ocr-region" class="studio-btn-full" type="button" style="margin-bottom: 6px; background: rgba(14, 165, 233, 0.24); border-color: rgba(56, 189, 248, 0.6); color: #bae6fd;">
        Cắt Vùng Màn Hình -&gt; OCR &amp; Dịch Thuật
      </button>
      <div class="action-grid">
        <button id="btn-pc-ocr" class="action-btn" type="button">OCR &amp; Tóm tắt Toàn Màn</button>
        <button id="btn-pc-vision" class="action-btn" type="button">Gemini Vision Màn hình</button>
      </div>
      <button id="btn-pc-tool-forge" class="studio-btn-full" type="button" style="margin-top: 6px; margin-bottom: 0; background: rgba(16, 185, 129, 0.22); border-color: rgba(52, 211, 153, 0.55); color: #a7f3d0;">
        Xưởng Skill AI &amp; Sandbox (Tự Tạo / Tự Vá Tool)
      </button>
      <button id="btn-pc-mini-screen" class="studio-btn-full" type="button" style="margin-top: 6px; margin-bottom: 0; background: rgba(56, 189, 248, 0.2); border-color: rgba(56, 189, 248, 0.5); color: #bae6fd;">
        Màn Hình Mini (YouTube / Chiếu App &amp; Tab Live)
      </button>
    </div>

    <!-- PHẦN 3: HỆ THỐNG, ÂM THANH & DEV TOOLS -->
    <div class="studio-section" style="margin-bottom: 0;">
      <div class="studio-section-title">Hệ Thống, Âm Lượng, Độ Sáng &amp; Dev</div>
      <div class="action-grid" style="grid-template-columns: repeat(3, 1fr);">
        <button id="btn-pc-cleanram" class="action-btn" type="button">Dọn RAM</button>
        <button id="btn-pc-topproc" class="action-btn" type="button">Top Ngốn RAM</button>
        <button id="btn-pc-clipboard" class="action-btn" type="button">Đọc Clipboard</button>
        <button id="btn-pc-stickynote" class="action-btn" type="button">Ghim &amp; Lịch Hẹn</button>
        <button id="btn-pc-ports" class="action-btn" type="button">Quét Port Dev</button>
        <button id="btn-pc-git" class="action-btn" type="button">Check Git</button>
        <button id="btn-pc-play" class="action-btn" type="button">Phát / Tạm dừng</button>
        <button id="btn-pc-voldown" class="action-btn" type="button">Âm lượng -</button>
        <button id="btn-pc-volup" class="action-btn" type="button">Âm lượng +</button>
        <button id="btn-pc-brightdown" class="action-btn" type="button">Độ sáng -</button>
        <button id="btn-pc-brightup" class="action-btn" type="button">Độ sáng +</button>
      </div>
    </div>
  </div>
`;
