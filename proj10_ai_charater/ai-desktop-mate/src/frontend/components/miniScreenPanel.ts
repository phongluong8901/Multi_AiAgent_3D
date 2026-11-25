const mirrorTileSlotsHtml = [0, 1, 2, 3]
  .map(
    (slot) => `
      <div class="mini-mirror-tile${slot === 0 ? ' active-tile' : ''}" data-slot="${slot}">
        <div class="mini-tile-bar">
          <span class="mini-tile-index">#${slot + 1}</span>
          <select class="mini-tile-select" data-slot="${slot}" title="Chọn cửa sổ cho ô #${slot + 1}">
            <option value="0">Chưa chọn app...</option>
          </select>
          <button class="mini-tile-icon-btn mini-tile-stealth" data-slot="${slot}" type="button" title="Ẩn / Hiện cửa sổ này">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button class="mini-tile-icon-btn mini-tile-focus" data-slot="${slot}" type="button" title="Đưa cửa sổ ô #${slot + 1} lên trước">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
          <button class="mini-tile-icon-btn mini-tile-zoom" data-slot="${slot}" type="button" title="Phóng to riêng ô #${slot + 1} / Quay lại lưới">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
          </button>
        </div>
        <div class="mini-tile-stage" data-slot="${slot}" title="Click để chọn ô | Double-click để đưa app lên trước">
          <img class="mini-tile-img" data-slot="${slot}" alt="Mini Screen Tile ${slot + 1}" style="display: none;" />
          <div class="mini-tile-placeholder" data-slot="${slot}">
            Ô #${slot + 1}: Chọn ứng dụng cần giám sát ở thanh trên.
          </div>
        </div>
      </div>`
  )
  .join('');

export const miniScreenPanelHtml = `
  <div id="mini-screen-panel" class="glass-panel" style="display: none;">
    <div id="mini-screen-drag-handle" class="mini-screen-drag-handle" title="Kéo để di chuyển Màn Hình Mini">
      <div class="panel-title" style="gap: 6px; min-width: 0;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="20" height="15" rx="2"></rect>
          <rect x="11" y="10" width="9" height="7" rx="1.2" fill="rgba(56, 189, 248, 0.35)"></rect>
        </svg>
        <span>Màn Hình Mini (PiP)</span>
        <span id="mini-screen-mode-badge" class="badge" style="font-size: 9px; padding: 1px 6px;">[LIVE]</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
        <span id="mini-size-readout" class="mini-size-readout" title="Kéo cạnh hoặc góc khung để thay đổi kích thước tự do">460x390</span>
        <button id="btn-mini-reset-size" class="icon-btn-tiny" type="button" title="Đặt lại kích thước mặc định">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
        </button>
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
      <div id="mini-resource-status" style="font-size: 10px; color: #94a3b8; background: rgba(2, 6, 23, 0.72); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 6px; padding: 4px 8px; margin-bottom: 7px; flex-shrink: 0;">
        WebView Mini: ĐÃ TẮT (0 MB RAM) | Chiếu App: TẮT
      </div>

      <div class="studio-tabs-bar" style="grid-template-columns: 1fr 1fr; margin-bottom: 8px; flex-shrink: 0;">
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
            <input id="chk-mini-web-autoclose" type="checkbox" style="accent-color: #38bdf8;" />
            <span>Tự đóng hẳn WebView khi tắt bảng Mini Screen (giải phóng 0 MB RAM)</span>
          </label>
          <div style="display: flex; flex-wrap: wrap; gap: 5px; align-items: center; justify-content: space-between;">
            <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
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
          <div style="display: flex; gap: 4px; margin-top: 6px; align-items: center;">
            <span style="font-size: 10px; color: #94a3b8;">Cỡ tự do:</span>
            <input id="mini-web-custom-w" type="number" min="300" max="1280" value="480" style="width: 58px; padding: 2px 5px; border-radius: 5px; border: 1px solid rgba(148,163,184,0.3); background: rgba(15,23,42,0.85); color: #f8fafc; font-size: 10.5px;" />
            <span style="font-size: 10px; color: #94a3b8;">x</span>
            <input id="mini-web-custom-h" type="number" min="190" max="920" value="300" style="width: 58px; padding: 2px 5px; border-radius: 5px; border: 1px solid rgba(148,163,184,0.3); background: rgba(15,23,42,0.85); color: #f8fafc; font-size: 10.5px;" />
            <button id="btn-mini-web-apply-size" class="action-btn" type="button" style="padding: 3px 8px; font-size: 10px;">Áp dụng</button>
          </div>
          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <button id="btn-mini-web-focus" class="action-btn" type="button" style="flex: 1; font-size: 10.5px;">Đưa Mini Web Lên</button>
            <button id="btn-mini-web-close" class="action-btn" type="button" style="flex: 1.25; font-size: 10.5px; border-color: rgba(248, 113, 113, 0.45); color: #fecaca;">Đóng Hẳn WebView (0 MB RAM)</button>
          </div>
        </div>
      </div>

      <!-- TAB 2: CHIẾU TRỰC TIẾP 1 / 2 / 4 CỬA SỔ APP ĐỒNG THỜI -->
      <div id="mini-pane-mirror" style="display: none;">
        <div style="display: flex; gap: 4px; margin-bottom: 5px; align-items: center; flex-shrink: 0; flex-wrap: wrap;">
          <div style="display: flex; gap: 3px; align-items: center;">
            <button class="mini-layout-btn active" type="button" data-layout="1" title="Giám sát 1 cửa sổ">1 Ô</button>
            <button class="mini-layout-btn" type="button" data-layout="2" title="Chia đôi giám sát 2 cửa sổ cùng lúc">2 Ô</button>
            <button class="mini-layout-btn" type="button" data-layout="4" title="Chia lưới giám sát 4 cửa sổ cùng lúc">4 Ô</button>
          </div>
          <select id="mini-mirror-win-select" class="win-target-select" style="flex: 1; min-width: 110px; margin-bottom: 0; background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(56, 189, 248, 0.35); color: #bae6fd; border-radius: 6px; padding: 4px 6px; font-size: 11px; outline: none;">
            <option value="0">Chọn app cho ô đang chọn...</option>
          </select>
          <button id="btn-mini-mirror-refresh" class="icon-btn-tiny" type="button" title="Làm mới danh sách cửa sổ (gồm cả app đang thu nhỏ)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
          <select id="select-mini-mirror-fps" class="win-target-select" style="width: 66px; margin-bottom: 0; background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(148, 163, 184, 0.3); color: #e2e8f0; border-radius: 6px; padding: 4px; font-size: 10.5px;">
            <option value="2">2 FPS</option>
            <option value="4">4 FPS</option>
            <option value="6" selected>6 FPS</option>
            <option value="10">10 FPS</option>
          </select>
        </div>

        <label style="display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: #a7f3d0; margin-bottom: 5px; cursor: pointer; flex-shrink: 0;">
          <input id="chk-mini-auto-stealth" type="checkbox" checked style="accent-color: #10b981;" />
          <span>Tự ẩn &amp; chiếu cả app đang thu nhỏ / nằm nền (Xem Ẩn)</span>
        </label>

        <div style="display: flex; gap: 6px; margin-bottom: 6px; flex-shrink: 0;">
          <button id="btn-mini-mirror-toggle" class="studio-btn-primary" type="button" style="flex: 1; font-size: 11px;">Bắt Đầu Chiếu App</button>
          <button id="btn-mini-display-media" class="action-btn" type="button" style="flex: 1; font-size: 11px; border-color: rgba(167, 139, 250, 0.45); color: #ddd6fe;">Bắt Tab / Màn 60 FPS</button>
        </div>

        <div class="mini-screen-viewport">
          <div id="mini-mirror-grid" class="mini-mirror-grid layout-1">
            ${mirrorTileSlotsHtml}
          </div>
          <video id="mini-display-video" autoplay playsinline muted style="display: none;"></video>
        </div>

        <div style="display: flex; gap: 6px; margin-bottom: 5px; flex-wrap: wrap; flex-shrink: 0;">
          <button id="btn-mini-stealth-toggle" class="action-btn" type="button" style="flex: 1.3; font-size: 10.5px; border-color: rgba(52, 211, 153, 0.48); color: #a7f3d0;">Ẩn App (Vẫn Chiếu)</button>
          <button id="btn-mini-restore-all" class="action-btn" type="button" style="flex: 1; font-size: 10.5px; display: none;">Hiện Tất Cả App Ẩn</button>
        </div>

        <div class="mini-media-bar" style="flex-shrink: 0;">
          <button id="btn-mini-focus-app" class="action-btn" type="button" style="flex: 1.2; font-size: 10.5px;">Đưa App Lên</button>
          <button id="btn-mini-media-prev" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;" title="Bài trước">Prev</button>
          <button id="btn-mini-media-play" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;" title="Phát / Tạm dừng">Play/Pause</button>
          <button id="btn-mini-media-next" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px;" title="Bài tiếp">Next</button>
          <button id="btn-mini-vol-down" class="action-btn" type="button" style="padding: 4px 7px; font-size: 10.5px;" title="Giảm âm lượng">Vol-</button>
          <button id="btn-mini-vol-up" class="action-btn" type="button" style="padding: 4px 7px; font-size: 10.5px;" title="Tăng âm lượng">Vol+</button>
        </div>
      </div>
    </div>

    <div class="mini-resize-handle mini-resize-e" data-resize="e" title="Kéo cạnh phải thay đổi chiều rộng"></div>
    <div class="mini-resize-handle mini-resize-w" data-resize="w" title="Kéo cạnh trái thay đổi chiều rộng"></div>
    <div class="mini-resize-handle mini-resize-s" data-resize="s" title="Kéo cạnh dưới thay đổi chiều cao"></div>
    <div class="mini-resize-handle mini-resize-sw" data-resize="sw" title="Kéo góc trái dưới thay đổi kích thước"></div>
    <div class="mini-resize-handle mini-resize-se" data-resize="se" title="Kéo góc phải dưới thay đổi kích thước tự do">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <line x1="11" y1="4" x2="4" y2="11"></line>
        <line x1="11" y1="8" x2="8" y2="11"></line>
      </svg>
    </div>
  </div>
`;
