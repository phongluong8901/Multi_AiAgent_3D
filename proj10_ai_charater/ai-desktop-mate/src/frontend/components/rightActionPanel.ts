export const rightActionPanelHtml = `
  <aside id="right-action-panel" class="glass-panel">
    <div class="panel-header">
      <div class="panel-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <span>Hành động &amp; Tương tác</span>
      </div>
      <button id="btn-close-right" class="icon-btn-tiny" type="button" title="Thu gọn bảng phải">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>

    <div class="status-strip">
      <span id="state-badge" class="badge">[IDLE]</span>
      <span id="timer-badge" class="badge badge-timer">25:00</span>
    </div>

    <div class="vitals-box">
      <div class="vital-row" title="Mức độ thân thiện">
        <span class="vital-label">Thân thiện</span>
        <div class="mood-bar">
          <div id="mood-bar-fill" class="mood-bar-fill"></div>
        </div>
        <span id="mood-value" class="mood-val">80%</span>
      </div>
      <div class="vital-row" title="Năng lượng vận động">
        <span class="vital-label">Năng lượng</span>
        <div class="mood-bar">
          <div id="energy-bar-fill" class="energy-bar-fill"></div>
        </div>
        <span id="energy-value" class="mood-val">90%</span>
      </div>
      <div class="vital-row" title="Độ no (giảm khi đi lại/nhảy)">
        <span class="vital-label">Độ no</span>
        <div class="mood-bar">
          <div id="hunger-bar-fill" class="hunger-bar-fill"></div>
        </div>
        <span id="hunger-value" class="mood-val">85%</span>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Cửa sổ đang Active</div>
      <div id="win-target-name" class="win-target-label">Chưa chọn cửa sổ nào</div>
      <div class="action-grid">
        <button id="btn-act-jump" class="action-btn" type="button">Nhảy lên mép</button>
        <button id="btn-win-min" class="action-btn" type="button">Hạ xuống</button>
        <button id="btn-act-enter-win" class="action-btn" type="button">Vào trong khung</button>
        <button id="btn-act-frame-key" class="action-btn" type="button">Tác động khung</button>
        <button id="btn-win-push-l" class="action-btn" type="button">Đẩy sang trái</button>
        <button id="btn-win-push-r" class="action-btn" type="button">Đẩy sang phải</button>
        <button id="btn-win-shrink" class="action-btn" type="button">Ép nhỏ lại</button>
        <button id="btn-win-expand" class="action-btn" type="button">Kéo to ra</button>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Tương tác Nhân vật</div>
      <div class="action-grid">
        <button id="btn-act-dance" class="action-btn" type="button">Nhảy Idol</button>
        <button id="btn-act-pat" class="action-btn" type="button">Xoa đầu</button>
        <button id="btn-act-flip" class="action-btn" type="button">Lộn nhào</button>
        <button id="btn-act-spin" class="action-btn" type="button">Xoay tít</button>
        <button id="btn-act-duck" class="action-btn" type="button">Đổi Vịt BDX</button>
        <button id="btn-act-timer" class="action-btn" type="button">Pomodoro 25p</button>
        <button id="btn-act-center" class="action-btn" type="button">Về giữa màn</button>
        <button id="btn-act-feed" class="action-btn" type="button">Thả đồ ăn</button>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Hỏi &amp; Kiểm tra Nhanh</div>
      <div class="action-grid">
        <button id="btn-act-hw" class="action-btn" type="button">Phần cứng</button>
        <button id="btn-act-net" class="action-btn" type="button">Mạng</button>
        <button id="btn-act-btc" class="action-btn" type="button">Giá BTC</button>
        <button id="btn-act-mem" class="action-btn" type="button">Trí nhớ</button>
        <button id="btn-act-suggest" class="action-btn" type="button" style="grid-column: span 2;">Show gợi ý</button>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Điều khiển Máy tính</div>
      <div class="action-grid" style="grid-template-columns: 1fr 1fr 1fr;">
        <button id="btn-pc-yt" class="action-btn" type="button">YouTube</button>
        <button id="btn-pc-shot" class="action-btn" type="button">Chụp ảnh</button>
        <button id="btn-pc-openshot" class="action-btn" type="button">Mở ảnh</button>
        <button id="btn-pc-note" class="action-btn" type="button">Notepad</button>
        <button id="btn-pc-cleanram" class="action-btn" type="button">Dọn RAM</button>
        <button id="btn-pc-play" class="action-btn" type="button">Nhạc</button>
        <button id="btn-pc-voldown" class="action-btn" type="button">Âm -</button>
        <button id="btn-pc-volup" class="action-btn" type="button">Âm +</button>
        <button id="btn-pc-brightdown" class="action-btn" type="button">Sáng -</button>
        <button id="btn-pc-brightup" class="action-btn" type="button">Sáng +</button>
        <button id="btn-pc-ocr" class="action-btn" type="button" style="grid-column: span 2;">OCR &amp; Tóm tắt</button>
      </div>
    </div>

    <div class="footer-grid">
      <button id="btn-open-studio" class="btn-footer" type="button">Studio 3D</button>
      <button id="btn-load-vrm" class="btn-footer" type="button">Chọn .VRM</button>
      <button id="btn-open-long-mem" class="btn-footer" type="button" style="grid-column: span 2;">Long Memory &amp; Tính cách</button>
    </div>
  </aside>
`;

