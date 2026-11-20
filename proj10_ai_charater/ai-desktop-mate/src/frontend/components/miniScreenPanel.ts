export const miniScreenPanelHtml = `
  <div id="mini-screen-panel" class="glass-panel" style="display: none;">
    <div id="mini-screen-drag-handle" class="mini-screen-drag-handle" title="Kéo để di chuyển Màn Hình Mini">
      <div class="panel-title" style="gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="20" height="15" rx="2"></rect>
          <rect x="11" y="10" width="9" height="7" rx="1.2" fill="rgba(56, 189, 248, 0.35)"></rect>
        </svg>
        <span>Màn Hình Mini (PiP)</span>
        <span id="mini-screen-mode-badge" class="badge" style="font-size: 9px; padding: 1px 6px;">[LIVE]</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <button class="mini-size-chip" type="button" data-size="330" title="Cỡ Nhỏ">S</button>
        <button class="mini-size-chip active" type="button" data-size="430" title="Cỡ Vừa">M</button>
        <button class="mini-size-chip" type="button" data-size="560" title="Cỡ Lớn">L</button>
        <input id="mini-screen-opacity" type="range" min="0.45" max="1" step="0.05" value="0.96" title="Độ trong suốt Màn Hình Mini" style="width: 48px; accent-color: #38bdf8; cursor: pointer;" />
        <button id="btn-mini-collapse" class="icon-btn-tiny" type="button" title="Thu gọn / Mở rộng thân Màn Hình Mini">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button id="btn-close-mini-screen" class="icon-btn-tiny" type="button" title="Đóng Màn Hình Mini">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <div id="mini-screen-body">
      <div id="mini-resource-status" style="font-size: 10px; color: #94a3b8; background: rgba(2, 6, 23, 0.72); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 6px; padding: 4px 8px; margin-bottom: 7px;">
        WebView Mini: ĐÃ TẮT (0 MB RAM) | Chiếu App: TẮT
      </div>

      <div class="studio-tabs-bar" style="grid-template-columns: 1fr 1fr; margin-bottom: 8px;">
        <button id="tab-btn-mini-web" class="studio-tab-btn active" type="button">YouTube &amp; Web Mini</button>
        <button id="tab-btn-mini-mirror" class="studio-tab-btn" type="button">Chiếu App / Tab Live</button>
      </div>

      <!-- TAB 1: MỞ YOUTUBE / WEB MINI ALWAYS-ON-TOP -->
      <div id="mini-pane-web">
        <div class="url-row" style="margin-bottom: 7px;">
          <input id="mini-web-url-input" class="studio-input" type="text" placeholder="Dán link YouTube/Web hoặc gõ từ khóa..." />
          <button id="btn-mini-web-open" class="studio-btn-primary" type="button" style="white-space: nowrap;">Mở Mini</button>
        </div>

        <div class="mini-preset-grid">
          <button class="action-btn mini-web-preset" type="button" data-target="youtube" style="background: rgba(239, 68, 68, 0.2); border-color: rgba(248, 113, 113, 0.45); color: #fecaca;">YouTube</button>
          <button class="action-btn mini-web-preset" type="button" data-target="lofi">Lo-fi Chill</button>
          <button class="action-btn mini-web-preset" type="button" data-target="ytmusic">YT Music</button>
          <button class="action-btn mini-web-preset" type="button" data-target="tiktok">TikTok</button>
          <button class="action-btn mini-web-preset" type="button" data-target="google">Google</button>
          <button class="action-btn mini-web-preset" type="button" data-target="chatgpt">ChatGPT</button>
        </div>

        <div class="mini-web-ctrl-box">
          <div id="mini-web-status-text" class="dash-sub" style="margin-bottom: 6px; color: #bae6fd;">
            WebView Mini chưa khởi chạy (không tốn RAM/CPU nền). Nhấn YouTube hoặc dán link khi cần dùng.
          </div>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: #cbd5e1; margin-bottom: 6px; cursor: pointer;">
            <input id="chk-mini-web-autoclose" type="checkbox" checked style="accent-color: #38bdf8;" />
            <span>Tự đóng hẳn WebView khi tắt bảng Mini Screen (giải phóng 0 MB RAM)</span>
          </label>
          <div style="display: flex; flex-wrap: wrap; gap: 5px; align-items: center; justify-content: space-between;">
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button id="btn-mini-web-paste" class="action-btn" type="button" style="padding: 3px 7px; font-size: 10px;">Dán Clipboard</button>
              <button class="action-btn mini-web-size-btn" type="button" data-w="400" data-h="240" style="padding: 3px 7px; font-size: 10px;">400x240</button>
              <button class="action-btn mini-web-size-btn" type="button" data-w="520" data-h="310" style="padding: 3px 7px; font-size: 10px;">520x310</button>
              <button class="action-btn mini-web-size-btn" type="button" data-w="680" data-h="400" style="padding: 3px 7px; font-size: 10px;">680x400</button>
            </div>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 10.5px; color: #e2e8f0; cursor: pointer;">
              <input id="chk-mini-web-pin" type="checkbox" checked style="accent-color: #38bdf8;" />
              <span>Ghim nổi</span>
            </label>
          </div>
          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <button id="btn-mini-web-focus" class="action-btn" type="button" style="flex: 1; font-size: 10.5px;">Đưa Mini Web Lên</button>
            <button id="btn-mini-web-close" class="action-btn" type="button" style="flex: 1.25; font-size: 10.5px; border-color: rgba(248, 113, 113, 0.45); color: #fecaca;">Đóng Hẳn WebView (0 MB RAM)</button>
          </div>
        </div>
      </div>

      <!-- TAB 2: CHIẾU TRỰC TIẾP CỬA SỔ APP / TAB TRÌNH DUYỆT (BAO GỒM CỬA SỔ KHÔNG ACTIVE & XEM ẨN) -->
      <div id="mini-pane-mirror" style="display: none;">
        <div style="display: flex; gap: 5px; margin-bottom: 6px; align-items: center;">
          <select id="mini-mirror-win-select" class="win-target-select" style="flex: 1; margin-bottom: 0; background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(56, 189, 248, 0.35); color: #bae6fd; border-radius: 6px; padding: 5px 7px; font-size: 11px; outline: none;">
            <option value="0">Chọn app hoặc tab trình duyệt cần chiếu...</option>
          </select>
          <button id="btn-mini-mirror-refresh" class="icon-btn-tiny" type="button" title="Làm mới danh sách cửa sổ (gồm cả app đang thu nhỏ)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
          <select id="select-mini-mirror-fps" class="win-target-select" style="width: 68px; margin-bottom: 0; background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(148, 163, 184, 0.3); color: #e2e8f0; border-radius: 6px; padding: 5px 4px; font-size: 10.5px;">
            <option value="3">3 FPS</option>
            <option value="6" selected>6 FPS</option>
            <option value="10">10 FPS</option>
          </select>
        </div>

        <label style="display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: #a7f3d0; margin-bottom: 6px; cursor: pointer;">
          <input id="chk-mini-auto-stealth" type="checkbox" checked style="accent-color: #10b981;" />
          <span>Tự ẩn &amp; chiếu cả app đang thu nhỏ / nằm nền (Xem Ẩn)</span>
        </label>

        <div style="display: flex; gap: 6px; margin-bottom: 7px;">
          <button id="btn-mini-mirror-toggle" class="studio-btn-primary" type="button" style="flex: 1; font-size: 11px;">Bắt Đầu Chiếu App</button>
          <button id="btn-mini-display-media" class="action-btn" type="button" style="flex: 1; font-size: 11px; border-color: rgba(167, 139, 250, 0.45); color: #ddd6fe;">Bắt Tab / Màn 60 FPS</button>
        </div>

        <div class="mini-screen-viewport">
          <img id="mini-mirror-img" alt="Mini Screen Live Mirror" style="display: none;" />
          <video id="mini-display-video" autoplay playsinline muted style="display: none;"></video>
          <div id="mini-viewport-placeholder" class="mini-viewport-placeholder">
            Bắt được cả cửa sổ nền không active và cửa sổ thu nhỏ. Muốn xem 1 tab Chrome riêng (vd YouTube) khi duyệt tab khác: kéo tab đó ra cửa sổ riêng rồi bấm "Ẩn App (Vẫn Chiếu)".
          </div>
        </div>

        <div style="display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
          <button id="btn-mini-stealth-toggle" class="action-btn" type="button" style="flex: 1.3; font-size: 10.5px; border-color: rgba(52, 211, 153, 0.48); color: #a7f3d0;">Ẩn App (Vẫn Chiếu)</button>
          <button id="btn-mini-restore-all" class="action-btn" type="button" style="flex: 1; font-size: 10.5px; display: none;">Hiện Tất Cả App Ẩn</button>
        </div>

        <div class="mini-media-bar">
          <button id="btn-mini-focus-app" class="action-btn" type="button" style="flex: 1.2; font-size: 10.5px;">Đưa App Lên</button>
          <button id="btn-mini-media-prev" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;" title="Bài trước">Prev</button>
          <button id="btn-mini-media-play" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;" title="Phát / Tạm dừng">Play/Pause</button>
          <button id="btn-mini-media-next" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;" title="Bài tiếp">Next</button>
          <button id="btn-mini-vol-down" class="action-btn" type="button" style="padding: 4px 7px; font-size: 10.5px;" title="Giảm âm lượng">Vol-</button>
          <button id="btn-mini-vol-up" class="action-btn" type="button" style="padding: 4px 7px; font-size: 10.5px;" title="Tăng âm lượng">Vol+</button>
        </div>
      </div>
    </div>
  </div>
`;
