export const rightActionControlsInnerHtml = `
    <div class="status-strip">
      <span id="state-badge" class="badge">[IDLE]</span>
      <span id="active-clip-badge" class="badge badge-clip" style="display: none;"></span>
      <span id="timer-badge" class="badge badge-timer">25:00</span>
    </div>

    <div class="vitals-box">
      <div class="vital-row" title="Mức độ thân thiện">
        <span class="vital-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          <span>Thân thiện</span>
        </span>
        <div class="mood-bar">
          <div id="mood-bar-fill" class="mood-bar-fill"></div>
        </div>
        <span id="mood-value" class="mood-val">80%</span>
      </div>
      <div class="vital-row" title="Năng lượng vận động">
        <span class="vital-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Năng lượng</span>
        </span>
        <div class="mood-bar">
          <div id="energy-bar-fill" class="energy-bar-fill"></div>
        </div>
        <span id="energy-value" class="mood-val">90%</span>
      </div>
      <div class="vital-row" title="Độ no (giảm khi đi lại/nhảy)">
        <span class="vital-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
          <span>Độ no</span>
        </span>
        <div class="mood-bar">
          <div id="hunger-bar-fill" class="hunger-bar-fill"></div>
        </div>
        <span id="hunger-value" class="mood-val">85%</span>
      </div>
    </div>

    <div class="anim-actions-grid">
      <div class="section-block">
      <div class="section-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
        <span>Cửa sổ đang Active &amp; Chọn nhanh App</span>
      </div>
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
      <div class="section-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
        <span>Kéo &amp; Sắp xếp Icon Desktop</span>
      </div>
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
      <div class="section-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8L20 10l-5 3.6L16.8 20 12 16.6 7.2 20 9 13.6 4 10l6.1-1.2z"/></svg>
        <span>Tương tác Nhân vật</span>
      </div>
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
        <button id="btn-act-swing" class="action-btn" type="button" style="background: rgba(249, 115, 22, 0.16); border-color: rgba(251, 146, 60, 0.42); color: #fed7aa;">Đu Cửa Sổ (Tay Dài)</button>
        <button id="btn-act-paper-crash" class="action-btn" type="button" style="background: rgba(56, 189, 248, 0.2); border-color: rgba(56, 189, 248, 0.5); color: #e0f2fe;">Đâm Thủng Cửa Sổ</button>
        <button id="btn-act-hulk" class="action-btn" type="button" style="grid-column: span 2; background: rgba(34, 197, 94, 0.22); border-color: rgba(74, 222, 128, 0.52); color: #bbf7d0; font-weight: 700;">Hóa HULK Xanh Giận Dữ (Khổng Lồ)</button>
        <button id="btn-act-edge-peek" class="action-btn" type="button">Nấp Mép Màn (Alt+W)</button>
        <button id="btn-act-weather3d" class="action-btn" type="button">Thời Tiết &amp; Độ Ẩm</button>
        <button id="btn-act-random-fx" class="action-btn" type="button" style="grid-column: span 2; background: rgba(245, 158, 11, 0.18); border-color: rgba(251, 191, 36, 0.42); color: #fde68a;">Chạy Hiệu Ứng &amp; Tính Năng Random</button>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>Kho Hoạt Ảnh &amp; Hiệu Ứng 3D Mới</span>
      </div>
      <div class="action-grid" style="margin-bottom: 7px;">
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="ai_thinking_orbit">Suy Luận Hologram</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="chat_explain">Giảng Giải Vẫy Cánh</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="wing_flutter_joy">Vỗ Cánh Phấn Khích</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="poke_giggle">Khúc Khích Trái Tim</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="cyber_salute">Chào Quân Đội Cyber</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="dizzy_spin">Chóng Mặt Sao Bay</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="celebrate_backhop">Bật Nhảy Ăn Mừng</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="focus_guard">Canh Gác Tập Trung</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="gym_pump" style="background: rgba(249, 115, 22, 0.16); border-color: rgba(251, 146, 60, 0.42); color: #fed7aa;">Tập Tạ Thể Lực 3D</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="super_saiyan_charge" style="background: rgba(250, 204, 21, 0.16); border-color: rgba(250, 204, 21, 0.45); color: #fef08a;">Tụ Khí Sấm Sét 3D</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="paparazzi_pose" style="background: rgba(236, 72, 153, 0.16); border-color: rgba(244, 114, 182, 0.42); color: #fbcfe8;">Chụp Ảnh Flash 3D</button>
        <button class="action-btn quick-clip-btn" type="button" data-play-clip="love_serenade" style="background: rgba(244, 63, 94, 0.18); border-color: rgba(251, 113, 133, 0.45); color: #fecdd3;">Bắn Tim 3D</button>
      </div>
      <div style="display: flex; gap: 4px; margin-bottom: 5px;">
        <select id="select-quick-3d-clip" class="dash-mini-select" style="flex: 1; min-width: 0;"></select>
        <button id="btn-play-quick-3d-clip" class="btn-mini-action" type="button" style="flex: 0 0 auto; padding: 4px 8px;">Diễn 3D</button>
        <button id="btn-random-3d-clip" class="btn-mini-action" type="button" style="flex: 0 0 auto; padding: 4px 7px;" title="Chạy ngẫu nhiên 1 trong 48 hoạt ảnh 3D">Random</button>
      </div>
      <div style="display: flex; gap: 4px;">
        <select id="select-quick-3d-fx" class="dash-mini-select" style="flex: 1; min-width: 0;"></select>
        <button id="btn-play-quick-3d-fx" class="btn-mini-action" type="button" style="flex: 0 0 auto; padding: 4px 8px; border-color: rgba(56, 189, 248, 0.45); color: #bae6fd;">Bung FX 3D</button>
      </div>
    </div>

    <div class="section-block">
      <div class="section-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <span>Hỏi &amp; Kiểm tra Nhanh</span>
      </div>
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
    </div>

    <div class="footer-grid">
      <button id="btn-open-studio" class="btn-footer" type="button">Studio 3D</button>
      <button id="btn-load-vrm" class="btn-footer" type="button">Tải File VRM</button>
      <button id="btn-open-notif" class="btn-footer" type="button" style="background: rgba(14, 165, 233, 0.22); border-color: rgba(56, 189, 248, 0.45); color: #38bdf8;">Notification</button>
      <button id="btn-open-long-mem" class="btn-footer" type="button">Long Memory</button>
    </div>
`;

export const rightActionPanelHtml = `
  <aside id="right-action-panel" class="glass-panel" style="display: none;"></aside>
`;

