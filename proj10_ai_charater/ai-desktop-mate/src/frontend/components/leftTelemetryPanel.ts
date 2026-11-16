export const leftTelemetryPanelHtml = `
  <aside id="left-telemetry-panel" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        <span id="left-panel-title">Thông số Hệ thống</span>
      </div>
      <button id="btn-close-left" class="icon-btn-tiny" type="button" title="Đóng bảng trái">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div id="card-group-hw" style="display: none;">
      <div class="dash-card">
        <div class="dash-row-top">
          <span class="dash-label">CPU</span>
          <span id="dash-cpu-pct" class="dash-value">--%</span>
        </div>
        <div id="dash-cpu-name" class="dash-sub">Đang quét vi xử lý...</div>
        <div class="progress-track">
          <div id="dash-cpu-bar" class="progress-fill"></div>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-row-top">
          <span class="dash-label">RAM</span>
          <span id="dash-ram-val" class="dash-value">-- / -- GB</span>
        </div>
        <div class="progress-track">
          <div id="dash-ram-bar" class="progress-fill"></div>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-row-top">
          <span class="dash-label">GPU &amp; Ổ đĩa C:</span>
          <span id="dash-disk-val" class="dash-value">-- GB trống</span>
        </div>
        <div id="dash-gpu-name" class="dash-sub">Đang quét GPU...</div>
      </div>

      <div class="dash-card">
        <div class="dash-row-top">
          <span class="dash-label">Pin &amp; Top Tiến trình</span>
          <span id="dash-bat-val" class="dash-value">--%</span>
        </div>
        <div id="dash-top-procs" class="dash-sub" style="white-space: normal; line-height: 1.35;">Đang quét tiến trình ngốn RAM...</div>
      </div>
    </div>

    <div id="card-net" class="dash-card" style="display: none;">
      <div class="dash-row-top">
        <span class="dash-label">Mạng &amp; Ollama LLM</span>
        <span id="dash-net-ping" class="dash-value">-- ms</span>
      </div>
      <div id="dash-net-detail" class="dash-sub">Đang kiểm tra kết nối...</div>
    </div>

    <div id="card-btc" class="dash-card" style="display: none;">
      <div class="dash-row-top">
        <span class="dash-label">Bitcoin (BTC/USDT)</span>
        <span id="dash-btc-change" class="btc-change">--%</span>
      </div>
      <div class="btc-price-row">
        <span id="dash-btc-price" class="btc-price">$--</span>
        <span id="dash-btc-src" class="dash-label" style="font-size: 10px;">Binance</span>
      </div>
    </div>

    <div id="card-alerts" class="alert-box" style="display: none;">
      <div class="alert-title">Cảnh báo Hệ thống</div>
      <div id="dash-alerts"></div>
    </div>

    <div id="card-memory" style="display: none;">
      <div class="dash-card">
        <div class="dash-row-top">
          <span class="dash-label">SQLite Trí nhớ Cá nhân</span>
          <span id="dash-mem-chats" class="dash-value">0 tin</span>
        </div>
        <div id="dash-mem-profile" class="dash-sub" style="white-space: normal; line-height: 1.4;">Chưa học được sở thích nào.</div>
      </div>
      <div class="dash-card">
        <div class="dash-row-top">
          <span class="dash-label">Thói quen Hôm nay</span>
          <span class="dash-value" style="font-size: 10px; color: #38bdf8;">Tự thu thập</span>
        </div>
        <div id="dash-mem-apps" class="dash-sub" style="white-space: normal; line-height: 1.4;">Đang thu thập dữ liệu sử dụng...</div>
      </div>
      <div class="dash-card">
        <div class="dash-row-top">
          <span class="dash-label">Tổng kết Ngày</span>
          <span class="dash-value" style="font-size: 10px; color: #a78bfa;">AI Summary</span>
        </div>
        <div id="dash-mem-summary" class="dash-sub" style="white-space: normal; line-height: 1.4;">Chưa có tổng kết hôm nay (nhắn "đánh giá hôm nay" để tạo).</div>
      </div>
      <button id="btn-clear-memory" class="btn-mini-action" type="button" style="width: 100%; margin-bottom: 6px; color: #fca5a5;">Xóa bộ nhớ SQLite</button>
    </div>

    <div class="dash-actions">
      <button id="btn-refresh-all" class="btn-mini-action" type="button">Quét lại toàn bộ</button>
    </div>
  </aside>
`;

