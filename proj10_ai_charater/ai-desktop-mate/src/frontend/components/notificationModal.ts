export const notificationModalHtml = `
  <div id="notification-panel" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title" style="flex-wrap: wrap;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span>Quản lý Notification Ứng dụng &amp; Web</span>
        <span class="badge" style="background: rgba(52, 211, 153, 0.16); color: #6ee7b7; border-color: rgba(52, 211, 153, 0.35); font-size: 9.5px; text-transform: none;">[SQLite: mate_memory.db]</span>
      </div>
      <button id="btn-close-notif" class="icon-btn-tiny" type="button" title="Đóng bảng Notification">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- Master Controls -->
    <div class="studio-section" style="margin-bottom: 8px; padding: 9px 11px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; cursor: pointer;">
          <input id="notif-master-toggle" type="checkbox" checked />
          <span style="font-weight: 600; color: #f8fafc;">Bật Hệ thống Notification</span>
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; cursor: pointer;">
          <input id="notif-tts-toggle" type="checkbox" checked />
          <span style="color: #cbd5e1;">Đọc to TTS</span>
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; cursor: pointer;">
          <input id="notif-react-toggle" type="checkbox" checked />
          <span style="color: #cbd5e1;">Nhân vật nhảy Alert</span>
        </label>
      </div>
    </div>

    <!-- Tab navigation -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px;">
      <button id="tab-btn-win-notif" class="btn-mini-action active" type="button">Ứng dụng (Apps)</button>
      <button id="tab-btn-web-notif" class="btn-mini-action" type="button">Web &amp; Webhook</button>
      <button id="tab-btn-hist-notif" class="btn-mini-action" type="button">Lịch sử (SQLite)</button>
    </div>

    <!-- Tab 1: Apps Content -->
    <div id="tab-content-win-notif" class="studio-section" style="margin-bottom: 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; gap: 6px; flex-wrap: wrap;">
        <span class="studio-section-title" style="margin: 0;">Ứng dụng được phép</span>
        <div style="display: flex; gap: 4px;">
          <button id="btn-scan-win-apps" class="action-btn" type="button" style="padding: 3px 8px; font-size: 10px;">Quét App đang mở</button>
          <button id="btn-test-win-notif" class="action-btn" type="button" style="padding: 3px 8px; font-size: 10px; background: rgba(56, 189, 248, 0.2);">Test Thông báo App</button>
        </div>
      </div>

      <div class="url-row" style="margin-bottom: 8px;">
        <input id="input-new-win-app" class="studio-input" type="text" placeholder="Nhập tên App mới (vd: Zalo, Telegram.exe, Notion)..." />
        <button id="btn-add-win-app" class="studio-btn-primary" type="button" style="padding: 4px 10px; font-size: 11px;">Thêm</button>
      </div>

      <div id="container-win-apps" style="max-height: 230px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; padding-right: 2px;">
        <div class="dash-sub">Đang tải danh sách ứng dụng từ SQLite...</div>
      </div>
    </div>

    <!-- Tab 2: Web & Webhook Content -->
    <div id="tab-content-web-notif" class="studio-section" style="display: none; margin-bottom: 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span class="studio-section-title" style="margin: 0;">Webhook &amp; Web Push</span>
        <button id="btn-test-web-notif" class="action-btn" type="button" style="padding: 2px 8px; font-size: 10px; background: rgba(168, 85, 247, 0.2);">Gửi Test Web</button>
      </div>

      <!-- Webhook URL Box -->
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; font-size: 11px;">
        <div style="color: #94a3b8; margin-bottom: 3px; display: flex; justify-content: space-between;">
          <span>Local Webhook Endpoint (POST):</span>
          <span id="webhook-status-badge" style="color: #34d399; font-weight: 600;">[RUNNING]</span>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <code id="webhook-url-display" style="color: #38bdf8; font-family: monospace; flex: 1; word-break: break-all;">http://127.0.0.1:39281/notify</code>
          <button id="btn-copy-webhook-url" class="action-btn" type="button" style="padding: 2px 6px; font-size: 10px;">Copy URL</button>
          <button id="btn-copy-curl-cmd" class="action-btn" type="button" style="padding: 2px 6px; font-size: 10px;">Copy cURL</button>
        </div>
      </div>

      <div class="url-row" style="margin-bottom: 8px;">
        <input id="input-new-web-origin" class="studio-input" type="text" placeholder="Nhập domain mới (vd: gitlab.com, dev.to, localhost)..." />
        <button id="btn-add-web-origin" class="studio-btn-primary" type="button" style="padding: 4px 10px; font-size: 11px;">Thêm</button>
      </div>

      <div id="container-web-origins" style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; padding-right: 2px;">
        <div class="dash-sub">Đang tải danh sách Web Origins...</div>
      </div>
    </div>

    <!-- Tab 3: History Content -->
    <div id="tab-content-hist-notif" class="studio-section" style="display: none; margin-bottom: 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span class="studio-section-title" style="margin: 0;">Lịch sử Thông báo Nhận được</span>
        <button id="btn-clear-notif-history" class="action-btn" type="button" style="padding: 2px 8px; font-size: 10px; background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5;">Xóa lịch sử</button>
      </div>

      <div id="container-notif-history" style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 2px;">
        <div class="dash-sub">Chưa có thông báo nào được ghi nhận.</div>
      </div>
    </div>
  </div>
`;
