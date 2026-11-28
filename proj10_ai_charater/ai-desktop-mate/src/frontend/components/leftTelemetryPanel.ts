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

    <div id="card-group-app-metrics">
      <div class="dash-card" style="border-color: rgba(56, 189, 248, 0.42); background: linear-gradient(160deg, rgba(14, 165, 233, 0.14), rgba(15, 23, 42, 0.86));">
        <div class="dash-row-top">
          <span class="dash-label" style="color: #38bdf8; font-weight: 700;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>
            <span>Hiệu Năng App Này</span>
          </span>
          <span id="dash-app-pid" class="dash-value" style="font-size: 10px; color: #7dd3fc; background: rgba(56, 189, 248, 0.2); padding: 1px 6px; border-radius: 4px;">PID: --</span>
        </div>
        
        <div style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
          <span class="dash-label">RAM Tiêu thụ:</span>
          <span id="dash-app-ram" class="dash-value" style="color: #38bdf8;">-- MB</span>
        </div>
        <div id="dash-app-ram-sub" class="dash-sub" style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">Đỉnh: -- MB | Ảo: -- MB</div>
        <div class="progress-track" style="margin-bottom: 8px;">
          <div id="dash-app-ram-bar" class="progress-fill" style="background: linear-gradient(90deg, #38bdf8, #818cf8); width: 0%;"></div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
          <span class="dash-label">CPU Chiếm dụng:</span>
          <span id="dash-app-cpu" class="dash-value" style="color: #34d399;">--%</span>
        </div>
        <div id="dash-app-cpu-sub" class="dash-sub" style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">Trên -- CPU Cores | -- Handles</div>
        <div class="progress-track">
          <div id="dash-app-cpu-bar" class="progress-fill" style="background: linear-gradient(90deg, #34d399, #10b981); width: 0%;"></div>
        </div>

        <div style="margin-top: 7px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
          <span>Thời gian chạy: <b id="dash-app-uptime" style="color: #e2e8f0;">--</b></span>
          <span id="dash-app-status-badge" style="color: #34d399; font-weight: 600;">[RẤT NHẸ]</span>
        </div>
      </div>
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

    <div id="card-weather" class="dash-card" style="display: none; border-color: rgba(56, 189, 248, 0.35);">
      <div class="dash-row-top">
        <span class="dash-label" style="color: #7dd3fc;">Thời Tiết &amp; Môi Trường 3D</span>
        <span id="val-weather-temp" class="dash-value" style="color: #fbbf24;">-- °C</span>
      </div>
      <div class="dash-sub" id="val-weather-loc" style="font-weight: 600; color: #e2e8f0;">Đang lấy vị trí...</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: #cbd5e1; margin-bottom: 6px; background: rgba(2, 6, 23, 0.45); padding: 5px 7px; border-radius: 6px;">
        <span>Cảm giác: <b id="val-weather-feels" style="color: #fde68a;">-- °C</b></span>
        <span>Độ ẩm: <b id="val-weather-hum" style="color: #38bdf8;">--%</b></span>
        <span>Sức gió: <b id="val-weather-wind" style="color: #34d399;">-- km/h</b></span>
        <span>Trạng thái: <b id="val-weather-desc" style="color: #f1f5f9;">--</b></span>
      </div>
      <div style="display: flex; gap: 4px; margin-bottom: 5px;">
        <select id="select-weather-city" class="dash-mini-select" style="flex: 1;">
          <option value="auto">Tự động IP</option>
          <option value="Hanoi">Hà Nội</option>
          <option value="Ho Chi Minh">TP. Hồ Chí Minh</option>
          <option value="Da Nang">Đà Nẵng</option>
          <option value="Hai Phong">Hải Phòng</option>
          <option value="Da Lat">Đà Lạt</option>
          <option value="custom">Nhập tỉnh/thành...</option>
        </select>
        <button id="btn-weather-refresh" class="btn-mini-action" type="button" style="flex: 0 0 auto; padding: 3px 8px;">Cập nhật</button>
      </div>
      <input id="inp-weather-city" class="dash-mini-input" type="text" placeholder="VD: Tokyo, London, Hue..." style="display: none; margin-bottom: 5px;" />
      <select id="select-weather-fx" class="dash-mini-select" style="width: 100%;">
        <option value="auto">Hiệu ứng 3D: Tự động theo thời tiết</option>
        <option value="rain">Hiệu ứng 3D: Mưa + Mây Sấm Sét + Ô</option>
        <option value="hot">Hiệu ứng 3D: Nắng Nóng + Mặt Trời + Nón &amp; Kính Râm</option>
        <option value="cold">Hiệu ứng 3D: Tuyết Lạnh + Người Tuyết + Mũ Len</option>
        <option value="wind">Hiệu ứng 3D: Gió Xoáy 3D + Chong Chóng</option>
        <option value="night">Hiệu ứng 3D: Ban Đêm + Trăng Sao</option>
        <option value="clear">Hiệu ứng 3D: Trời Quang + Mây Trắng</option>
      </select>
    </div>

    <div id="card-news" class="dash-card" style="display: none; border-color: rgba(52, 211, 153, 0.35);">
      <div class="dash-row-top">
        <span class="dash-label" style="color: #6ee7b7;">Tin Tức Mới (Cấu hình nguồn)</span>
        <span id="val-news-badge" class="dash-value" style="font-size: 10px; color: #34d399;">LIVE RSS</span>
      </div>
      <div style="display: flex; gap: 4px; margin-bottom: 5px;">
        <select id="select-news-source" class="dash-mini-select" style="flex: 1;">
          <option value="multi_random">Ngẫu nhiên (Znews / CafeF / Money)</option>
          <option value="znews">Znews (znews.vn)</option>
          <option value="cafef">CafeF (cafef.vn)</option>
          <option value="money">Money / Tài Chính (VnEconomy)</option>
          <option value="vnexpress">VnExpress (Tin mới nhất)</option>
          <option value="dantri">Dân Trí (dantri.com.vn)</option>
          <option value="tuoitre">Tuổi Trẻ (tuoitre.vn)</option>
          <option value="hackernews">Hacker News (Tech)</option>
          <option value="custom">URL RSS / Web Tùy Chỉnh...</option>
        </select>
      </div>
      <input id="inp-news-custom-url" class="dash-mini-input" type="text" placeholder="Nhập link RSS hoặc web (VD: https://znews.vn)" style="margin-bottom: 5px;" />
      <div style="display: flex; gap: 4px; margin-bottom: 6px;">
        <button id="btn-news-refresh" class="btn-mini-action" type="button">Tải Tin Mới</button>
        <button id="btn-news-speak" class="btn-mini-action" type="button" style="color: #6ee7b7; border-color: rgba(52, 211, 153, 0.35);">Vịt Điểm Tin</button>
      </div>
      <div id="news-feed-list" class="dash-scroll-list">
        <div class="dash-sub" style="white-space: normal;">Bấm "Tải Tin Mới" để đọc bài từ Znews, CafeF, Money hoặc URL bạn cấu hình.</div>
      </div>
    </div>

    <div id="card-english" class="dash-card" style="display: none; border-color: rgba(167, 139, 250, 0.4);">
      <div class="dash-row-top">
        <span class="dash-label" style="color: #c4b5fd;">Học Tiếng Anh Vô Tận (Live API)</span>
        <span id="eng-saved-count" class="dash-value" style="font-size: 10px; color: #ddd6fe;">0 từ</span>
      </div>
      <div style="display: flex; gap: 4px; margin-bottom: 5px;">
        <select id="select-english-topic" class="dash-mini-select" style="flex: 1;">
          <option value="random">Chủ đề: Ngẫu nhiên vô tận</option>
          <option value="technology">Technology &amp; AI</option>
          <option value="business">Business &amp; Finance</option>
          <option value="ielts">IELTS / Academic</option>
          <option value="daily">Daily Communication</option>
          <option value="science">Science &amp; Engineering</option>
          <option value="custom">Tự nhập chủ đề tiếng Anh...</option>
        </select>
      </div>
      <input id="inp-english-topic" class="dash-mini-input" type="text" placeholder="VD: negotiation, startups, cloud..." style="display: none; margin-bottom: 5px;" />
      <div id="eng-card-box" style="background: rgba(2, 6, 23, 0.55); border: 1px solid rgba(167, 139, 250, 0.25); border-radius: 7px; padding: 7px 8px; margin-bottom: 6px;">
        <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 4px;">
          <span id="eng-word" style="font-size: 14px; font-weight: 800; color: #f8fafc;">Ready to learn</span>
          <span id="eng-pos" style="font-size: 10px; color: #a78bfa; font-weight: 600;">--</span>
        </div>
        <div id="eng-phonetic" style="font-size: 10.5px; color: #38bdf8; margin-bottom: 4px;">/live-api/</div>
        <div id="eng-meaning-vi" style="font-size: 11px; color: #fde68a; font-weight: 600; line-height: 1.35; margin-bottom: 4px;">Bấm "Từ Mới" để tải từ vựng thời gian thực từ Datamuse &amp; Dictionary API.</div>
        <div id="eng-def-en" style="font-size: 10px; color: #94a3b8; line-height: 1.3; margin-bottom: 4px;"></div>
        <div id="eng-example-en" style="font-size: 10px; color: #cbd5e1; line-height: 1.35; border-left: 2px solid #8b5cf6; padding-left: 5px; margin-bottom: 3px;"></div>
        <div id="eng-example-vi" style="font-size: 10px; color: #86efac; line-height: 1.35; border-left: 2px solid #22c55e; padding-left: 5px;"></div>
      </div>
      <div style="display: flex; gap: 4px; margin-bottom: 5px; flex-wrap: wrap;">
        <button id="btn-eng-next" class="btn-mini-action" type="button" style="color: #ddd6fe; border-color: rgba(167, 139, 250, 0.4);">Từ Mới</button>
        <button id="btn-eng-translate" class="btn-mini-action" type="button" style="color: #86efac; border-color: rgba(52, 211, 153, 0.45);" title="Dịch lại từ vựng, giải nghĩa và câu ví dụ sang tiếng Việt">Dịch TV</button>
        <button id="btn-eng-audio" class="btn-mini-action" type="button">Phát Âm</button>
        <button id="btn-eng-quiz" class="btn-mini-action" type="button">Đố Vui</button>
        <button id="btn-open-english-coach" class="btn-mini-action" type="button" style="color: #7dd3fc; border-color: rgba(56, 189, 248, 0.45);" title="Mở Duck English Coach 4 Tab (Flashcard Cloud, SRS, Quiz, Luyện Nói)">Studio TA</button>
      </div>
      <div id="eng-history-list" class="dash-scroll-list" style="max-height: 76px;"></div>
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

