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
      <div class="section-label">Cửa sổ đang Active &amp; Chọn nhanh App</div>
      <select id="select-active-win" class="win-target-select" style="width: 100%; margin-bottom: 6px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.35); color: #bae6fd; border-radius: 6px; padding: 5px 8px; font-size: 11px; outline: none; cursor: pointer;">
        <option value="0">Tự động theo cửa sổ click gần nhất...</option>
      </select>
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
        <button id="btn-win-split" class="action-btn" type="button" style="background: rgba(56, 189, 248, 0.14); border-color: rgba(56, 189, 248, 0.35); color: #bae6fd;">Chia Đôi 2 App</button>
        <button id="btn-win-grid" class="action-btn" type="button" style="background: rgba(56, 189, 248, 0.14); border-color: rgba(56, 189, 248, 0.35); color: #bae6fd;">Xếp Lưới 4 App</button>
        <button id="btn-win-cascade" class="action-btn" type="button">Xếp Tầng App</button>
        <button id="btn-win-center" class="action-btn" type="button">Căn Giữa App</button>
        <button id="btn-act-climb" class="action-btn" type="button" style="grid-column: span 2;">Rocket Bay &amp; Nhảy Dù Nóc</button>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Kéo &amp; Sắp xếp Icon Desktop</div>
      <div style="display: flex; gap: 5px; margin-bottom: 6px; align-items: center;">
        <select id="select-desktop-icon" class="win-target-select" style="flex: 1; margin-bottom: 0; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.35); color: #bae6fd; border-radius: 6px; padding: 5px 8px; font-size: 11px; outline: none; cursor: pointer;">
          <option value="">Ngẫu nhiên Icon ngoài Desktop...</option>
        </select>
        <button id="btn-icon-refresh" class="icon-btn-tiny" type="button" title="Quét danh sách Icon Desktop">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>
      <div class="action-grid">
        <button id="btn-icon-drag" class="action-btn" type="button" style="background: rgba(14, 165, 233, 0.16); border-color: rgba(56, 189, 248, 0.38); color: #bae6fd;">Kéo Icon Đi Dạo</button>
        <button id="btn-icon-circle" class="action-btn" type="button">Xếp Vòng Tròn</button>
        <button id="btn-icon-grid" class="action-btn" type="button">Xếp Lưới Icon</button>
        <button id="btn-icon-restore" class="action-btn" type="button">Trả Vị Trí Cũ</button>
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
        <button id="btn-act-wheel" class="action-btn" type="button">Gập Lướt Xe</button>
        <button id="btn-act-radar" class="action-btn" type="button">Quét Radar</button>
        <button id="btn-act-sleep" class="action-btn" type="button">Ngủ Đông</button>
        <button id="btn-act-blackhole" class="action-btn" type="button" style="background: rgba(139, 92, 246, 0.25); border-color: rgba(168, 85, 247, 0.45); color: #e9d5ff;">Hố Đen Vũ Trụ</button>
        <button id="btn-act-hat" class="action-btn" type="button">Đổi Phụ Kiện 3D</button>
        <button id="btn-act-beat" class="action-btn" type="button" style="background: rgba(236, 72, 153, 0.2); border-color: rgba(244, 114, 182, 0.42); color: #fbcfe8;">Nhảy Theo Nhạc</button>
        <button id="btn-act-goose" class="action-btn" type="button" style="grid-column: span 2; background: rgba(249, 115, 22, 0.22); border-color: rgba(251, 146, 60, 0.45); color: #fed7aa;">Vịt Tinh Nghịch (Goose Mode)</button>
        <button id="btn-act-defend" class="action-btn" type="button" style="grid-column: span 2; background: rgba(239, 68, 68, 0.22); border-color: rgba(248, 113, 113, 0.5); color: #fecaca;">Bảo Vệ Lãnh Thổ (Đấu Kiếm 3D)</button>
        <button id="btn-act-swim" class="action-btn" type="button" style="grid-column: span 2; background: rgba(14, 165, 233, 0.22); border-color: rgba(56, 189, 248, 0.45); color: #bae6fd;">Hồ Bơi 3D &amp; Đi Bơi Ra Xa</button>
        <button id="btn-act-swing" class="action-btn" type="button" style="grid-column: span 2; background: rgba(249, 115, 22, 0.16); border-color: rgba(251, 146, 60, 0.42); color: #fed7aa;">Đu Cửa Sổ (Tay Dài &amp; Dập Mông)</button>
        <button id="btn-act-edge-peek" class="action-btn" type="button">Nấp Mép Màn (Alt+W)</button>
        <button id="btn-act-weather3d" class="action-btn" type="button">Thời Tiết &amp; Độ Ẩm</button>
        <button id="btn-act-random-fx" class="action-btn" type="button" style="grid-column: span 2; background: rgba(245, 158, 11, 0.18); border-color: rgba(251, 191, 36, 0.42); color: #fde68a;">Chạy Hiệu Ứng &amp; Tính Năng Random</button>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">Hỏi &amp; Kiểm tra Nhanh</div>
      <div class="action-grid">
        <button id="btn-act-hw" class="action-btn" type="button">Phần cứng</button>
        <button id="btn-act-net" class="action-btn" type="button">Mạng</button>
        <button id="btn-act-btc" class="action-btn" type="button">Giá BTC</button>
        <button id="btn-act-mem" class="action-btn" type="button">Trí nhớ</button>
        <button id="btn-act-news" class="action-btn" type="button" style="background: rgba(16, 185, 129, 0.16); border-color: rgba(52, 211, 153, 0.38); color: #6ee7b7;">Đọc Tin Mới</button>
        <button id="btn-act-english" class="action-btn" type="button" style="background: rgba(139, 92, 246, 0.18); border-color: rgba(167, 139, 250, 0.42); color: #ddd6fe;">Học Tiếng Anh</button>
        <button id="btn-act-app-metrics" class="action-btn" type="button" style="grid-column: span 2; background: rgba(56, 189, 248, 0.16); border-color: rgba(56, 189, 248, 0.4); color: #bae6fd;">Hiệu năng App Này</button>
        <button id="btn-act-smart-support" class="action-btn" type="button" style="grid-column: span 2; background: rgba(52, 211, 153, 0.16); border-color: rgba(52, 211, 153, 0.4); color: #a7f3d0;">Trợ Lý DB &amp; Workspace</button>
        <button id="btn-act-suggest" class="action-btn" type="button" style="grid-column: span 2;">Show gợi ý</button>
      </div>
    </div>

    <div class="footer-grid">
      <button id="btn-open-studio" class="btn-footer" type="button">Studio 3D</button>
      <button id="btn-load-vrm" class="btn-footer" type="button">Tải File VRM</button>
      <button id="btn-open-notif" class="btn-footer" type="button" style="background: rgba(14, 165, 233, 0.22); border-color: rgba(56, 189, 248, 0.45); color: #38bdf8;">Notification</button>
      <button id="btn-open-long-mem" class="btn-footer" type="button">Long Memory</button>
    </div>
  </aside>
`;

