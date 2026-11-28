export const pcControlModalHtml = `
  <div id="pc-control-modal" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <span>Điều Khiển Máy Tính, Màn Hình Mini &amp; OCR</span>
      </div>
      <button id="btn-close-pc-control" class="icon-btn-tiny" type="button" title="Đóng bảng Điều Khiển Máy Tính (Esc)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="studio-tabs-bar" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 10px;">
      <button id="tab-btn-pc-main" class="studio-tab-btn active" data-pc-tab="main" type="button">Công Cụ PC &amp; OCR</button>
      <button id="tab-btn-pc-mini" class="studio-tab-btn" data-pc-tab="mini" type="button">Màn Hình Mini</button>
      <button id="tab-btn-pc-qr" class="studio-tab-btn" data-pc-tab="qr" type="button">Mobile QR Deck</button>
    </div>

    <div id="pc-pane-main">
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

    <div id="pc-pane-mini" style="display: none;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span class="dash-sub" style="margin: 0;">Mở YouTube/Web nổi hoặc chiếu trực tiếp cửa sổ ngầm:</span>
        <button id="btn-pc-undock-mini" class="action-btn" type="button" style="white-space: nowrap; border-color: rgba(56, 189, 248, 0.48); color: #7dd3fc;">Tách Khung Nổi PiP</button>
      </div>
      <div id="pc-mini-dock-slot"></div>
    </div>

    <div id="pc-pane-qr" style="display: none;">
      <div class="studio-section" style="margin-bottom: 0; text-align: center;">
        <div class="studio-section-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Quét Mã QR Điều Khiển PC &amp; Học Từ Vựng Trên Điện Thoại</span>
          <span id="pc-qr-pin-badge" class="badge" style="color: #6ee7b7; border-color: rgba(52, 211, 153, 0.45);">PIN: ------</span>
        </div>
        <div class="dash-sub" style="margin-bottom: 8px;">
          Đảm bảo điện thoại bắt chung Wi-Fi với máy tính rồi mở Camera quét mã bên dưới (không cần cài thêm app):
        </div>
        <div id="pc-qr-svg-box" style="padding: 10px; display: inline-block; border-radius: 12px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(56, 189, 248, 0.35); margin-bottom: 8px;"></div>
        <div class="url-row" style="margin-bottom: 7px; align-items: center;">
          <span style="font-size: 11px; color: #94a3b8; white-space: nowrap;">IP Mạng LAN:</span>
          <select id="select-pc-qr-ip" class="studio-input" style="flex: 1; background: rgba(15, 23, 42, 0.9); color: #f8fafc;"></select>
        </div>
        <div id="pc-qr-url-label" style="font-size: 11px; font-family: ui-monospace, monospace; color: #7dd3fc; background: rgba(2, 6, 23, 0.72); border: 1px solid rgba(56, 189, 248, 0.24); border-radius: 7px; padding: 6px 8px; margin-bottom: 8px; word-break: break-all;">
          http://127.0.0.1:39282/deck?pin=------
        </div>
        <div class="action-grid" style="grid-template-columns: repeat(2, 1fr);">
          <button id="btn-pc-qr-copy" class="action-btn" type="button" style="border-color: rgba(56, 189, 248, 0.5); color: #7dd3fc;">Copy Link Mobile</button>
          <button id="btn-pc-qr-open" class="action-btn" type="button">Mở Thử Trên PC</button>
          <button id="btn-pc-qr-regen" class="action-btn" type="button">Đổi Mã PIN Mới</button>
          <button id="btn-pc-qr-firewall" class="action-btn" type="button" style="border-color: rgba(52, 211, 153, 0.45); color: #6ee7b7;">Mở Cổng Firewall LAN</button>
        </div>
      </div>
    </div>
  </div>
`;
