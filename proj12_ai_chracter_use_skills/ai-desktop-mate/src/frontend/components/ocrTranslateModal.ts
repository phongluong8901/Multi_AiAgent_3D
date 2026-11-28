export const ocrTranslateModalHtml = `
  <!-- LỚP PHỦ KÉO CHỌN VÙNG MÀN HÌNH ĐỂ OCR & DỊCH -->
  <div id="ocr-snip-overlay" style="display: none;">
    <div id="ocr-snip-banner">
      <span>[OCR CẮT VÙNG] Kéo chuột khoanh vùng văn bản trên màn hình để OCR &amp; Dịch | Nhấn Esc để hủy</span>
    </div>
    <div id="ocr-snip-rect" style="display: none;">
      <span id="ocr-snip-dims">0 x 0 px</span>
    </div>
  </div>

  <!-- HỘP THOẠI KẾT QUẢ OCR & DỊCH THUẬT ĐA NGÔN NGỮ -->
  <div id="ocr-translate-modal" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 7V4h3"></path>
          <path d="M17 4h3v3"></path>
          <path d="M4 17v3h3"></path>
          <path d="M17 20h3v-3"></path>
          <line x1="7" y1="12" x2="17" y2="12"></line>
        </svg>
        <span>OCR Cắt Vùng &amp; Dịch Thuật</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button id="btn-ocr-resnip" class="btn-expand-history" type="button" title="Kéo cắt vùng mới trên màn hình">Cắt Vùng Khác</button>
        <button id="btn-close-ocr-modal" class="icon-btn-tiny" type="button" title="Đóng bảng OCR (Esc)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <div id="ocr-preview-wrap">
      <img id="ocr-preview-img" alt="Ảnh vùng cắt OCR" />
      <div id="ocr-meta-info" class="fd-meta">Sẵn sàng cắt vùng màn hình...</div>
    </div>

    <div class="url-row" style="margin: 8px 0; align-items: center;">
      <select id="select-ocr-target-lang" class="studio-input" style="flex: 1; background: rgba(15, 23, 42, 0.9); color: #f8fafc;">
        <option value="vi">Dịch sang: Tiếng Việt (VI)</option>
        <option value="en">Dịch sang: English (EN)</option>
        <option value="ja">Dịch sang: Tiếng Nhật (JA)</option>
        <option value="ko">Dịch sang: Tiếng Hàn (KO)</option>
        <option value="zh-CN">Dịch sang: Tiếng Trung (ZH)</option>
        <option value="fr">Dịch sang: Tiếng Pháp (FR)</option>
      </select>
      <button id="btn-ocr-retranslate" class="studio-btn-primary" type="button">Dịch Nhanh</button>
      <button id="btn-ocr-ai-translate" class="action-btn" type="button" style="border-color: rgba(167, 139, 250, 0.5); color: #ddd6fe;">Dịch AI</button>
      <span id="ocr-engine-badge" class="badge" style="font-size: 9.5px;">--</span>
    </div>

    <div class="ocr-grid">
      <div class="ocr-col">
        <div class="fd-sec-label">VĂN BẢN OCR QUÉT ĐƯỢC (CÓ THỂ CHỈNH SỬA)</div>
        <textarea id="ocr-source-text" class="ocr-textarea" rows="6" placeholder="Văn bản quét từ ảnh vùng cắt..."></textarea>
      </div>
      <div class="ocr-col">
        <div class="fd-sec-label" style="color: #6ee7b7;">BẢN DỊCH THUẬT</div>
        <textarea id="ocr-translated-text" class="ocr-textarea" rows="6" placeholder="Kết quả dịch thuật sẽ hiển thị ở đây..."></textarea>
      </div>
    </div>

    <div class="fd-footer" style="margin-top: 8px; flex-wrap: wrap;">
      <button id="btn-ocr-copy-src" class="btn-footer" type="button">Copy Gốc</button>
      <button id="btn-ocr-copy-dst" class="btn-footer" type="button" style="background: rgba(16, 185, 129, 0.2); border-color: rgba(52, 211, 153, 0.45); color: #6ee7b7;">Copy Bản Dịch</button>
      <button id="btn-ocr-speak-dst" class="btn-footer" type="button">Đọc To</button>
      <button id="btn-ocr-save-vocab" class="btn-footer" type="button" style="background: rgba(99, 102, 241, 0.24); border-color: rgba(129, 140, 248, 0.5); color: #c7d2fe;">Lưu Từ TA</button>
      <button id="btn-ocr-send-chat" class="btn-footer" type="button" style="background: rgba(56, 189, 248, 0.2); border-color: rgba(56, 189, 248, 0.45); color: #7dd3fc;">Đưa Vào Chat</button>
    </div>
  </div>
`;
