export const workspaceChatModalHtml = `
  <style>
    #duck-workspace-modal {
      position: fixed;
      top: 6vh;
      left: max(16px, calc(50vw - min(520px, 46vw)));
      width: min(1040px, 92vw);
      height: min(730px, 88vh);
      z-index: 10012;
      display: none;
      flex-direction: column;
      background: linear-gradient(165deg, rgba(15, 23, 42, 0.98) 0%, rgba(8, 12, 26, 0.99) 100%);
      border: 1px solid rgba(56, 189, 248, 0.42);
      border-radius: 15px;
      box-shadow: 0 26px 70px rgba(2, 6, 23, 0.82), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      color: #f1f5f9;
      overflow: hidden;
      pointer-events: auto;
    }
    #duck-workspace-modal.dws-maximized {
      top: 1.5vh !important;
      left: 1.5vw !important;
      width: 97vw !important;
      height: 95vh !important;
    }
    .dws-header {
      height: 46px;
      padding: 0 12px;
      background: rgba(22, 32, 54, 0.96);
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: nowrap;
      overflow: hidden;
      user-select: none;
      flex-shrink: 0;
    }
    .dws-brand {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex-shrink: 0;
    }
    .dws-brand-title {
      font-weight: 700;
      font-size: 12.5px;
      color: #f8fafc;
      white-space: nowrap;
    }
    .dws-tabs {
      display: flex;
      gap: 3px;
      background: rgba(8, 12, 26, 0.9);
      padding: 3px;
      border-radius: 9px;
      border: 1px solid rgba(129, 140, 248, 0.26);
      overflow-x: auto;
      scrollbar-width: none;
      min-width: 0;
      flex-shrink: 1;
    }
    .dws-tabs::-webkit-scrollbar {
      display: none;
    }
    .dws-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      white-space: nowrap;
      flex-shrink: 0;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #94a3b8;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .dws-tab-btn:hover {
      color: #e2e8f0;
      background: rgba(51, 65, 85, 0.45);
    }
    .dws-tab-btn.active {
      background: linear-gradient(135deg, #4f46e5, #0284c7);
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
    }
    .dws-view {
      display: none;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .dws-view.active {
      display: flex;
    }
    .dws-sidebar {
      width: clamp(190px, 23%, 245px);
      background: rgba(15, 23, 42, 0.85);
      border-right: 1px solid rgba(148, 163, 184, 0.16);
      padding: 11px;
      display: flex;
      flex-direction: column;
      gap: 11px;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .dws-sec-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #93c5fd;
      margin-bottom: 5px;
    }
    .dws-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 185px;
      overflow-y: auto;
    }
    .dws-list-item {
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 11.5px;
      color: #cbd5e1;
      background: rgba(15, 23, 42, 0.55);
      border: 1px solid rgba(148, 163, 184, 0.12);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .dws-list-item:hover {
      background: #1e293b;
      color: #ffffff;
    }
    .dws-list-item.active {
      background: rgba(37, 99, 235, 0.22);
      border-color: rgba(59, 130, 246, 0.5);
      color: #ffffff;
    }
    .dws-chat-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: rgba(9, 14, 28, 0.92);
    }
    .dws-messages {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-sizing: border-box;
      min-width: 0;
    }
    .dws-msg {
      max-width: min(780px, 88%);
      font-size: 13px;
      line-height: 1.6;
      box-sizing: border-box;
      overflow-wrap: anywhere;
      word-break: break-word;
      min-width: 0;
    }
    .dws-msg.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #4f46e5, #2563eb);
      color: #ffffff;
      padding: 9px 14px;
      border-radius: 14px 14px 3px 14px;
      box-shadow: 0 6px 18px rgba(37, 99, 235, 0.25);
      white-space: pre-wrap;
      user-select: text;
    }
    .dws-msg.assistant {
      align-self: flex-start;
      background: rgba(24, 34, 56, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.22);
      padding: 12px 16px;
      border-radius: 14px 14px 14px 3px;
      box-shadow: 0 8px 24px rgba(2, 6, 23, 0.35);
      max-width: min(840px, 94%);
      user-select: text;
    }
    .dws-msg.assistant.dws-streaming {
      border-color: rgba(56, 189, 248, 0.45);
    }
    .dws-stream-cursor {
      display: inline-block;
      width: 7px;
      height: 13px;
      margin-left: 3px;
      vertical-align: -2px;
      background: #38bdf8;
      border-radius: 1px;
      animation: dwsBlink 0.9s steps(2, start) infinite;
    }
    @keyframes dwsBlink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.15; }
    }
    .dws-raw-pack-details {
      margin: 8px 0;
      border: 1px solid rgba(56, 189, 248, 0.28);
      border-radius: 8px;
      background: rgba(8, 14, 28, 0.85);
      overflow: hidden;
    }
    .dws-raw-pack-details summary {
      cursor: pointer;
      padding: 6px 10px;
      font-size: 11.5px;
      font-weight: 600;
      color: #7dd3fc;
      user-select: none;
    }
    .dws-raw-pack-details pre {
      margin: 0;
      border: none;
      border-top: 1px solid rgba(51, 65, 85, 0.6);
      border-radius: 0;
      max-height: 220px;
      overflow: auto;
    }
    .dws-md p { margin: 0 0 7px 0; }
    .dws-md p:last-child { margin-bottom: 0; }
    .dws-md ul { margin: 5px 0 8px 18px; }
    .dws-md pre {
      background: #0b1120;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 8px 10px;
      overflow: auto;
      max-height: 260px;
      max-width: 100%;
      font-family: Consolas, monospace;
      font-size: 11.5px;
      margin: 6px 0;
    }
    .dws-md code {
      background: rgba(15, 23, 42, 0.75);
      padding: 1px 5px;
      border-radius: 4px;
      font-family: Consolas, monospace;
      font-size: 11.5px;
      color: #bae6fd;
    }
    .dws-table-wrap {
      margin: 8px 0;
      border: 1px solid #334155;
      border-radius: 8px;
      overflow: hidden;
      background: #0b1120;
    }
    .dws-table-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 10px;
      background: #162032;
      border-bottom: 1px solid #334155;
      font-size: 11px;
      color: #94a3b8;
    }
    .dws-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .dws-table th, .dws-table td {
      border-bottom: 1px solid #1e293b;
      padding: 6px 9px;
      text-align: left;
    }
    .dws-table th {
      background: rgba(30, 41, 59, 0.75);
      color: #7dd3fc;
      font-weight: 600;
    }
    .dws-img-grid {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .dws-img-card {
      background: #0b1120;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 7px;
      max-width: 320px;
    }
    .dws-img-card img {
      max-width: 100%;
      max-height: 190px;
      border-radius: 5px;
      cursor: zoom-in;
      display: block;
      margin-bottom: 6px;
    }
    .dws-suggest-box {
      margin-top: 10px;
      padding: 10px 12px;
      background: rgba(37, 99, 235, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.45);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .dws-trace-box {
      margin-top: 9px;
      background: #0b1120;
      border: 1px solid #334155;
      border-radius: 7px;
      padding: 7px 10px;
      font-size: 11.5px;
    }
    .dws-trace-box summary {
      cursor: pointer;
      color: #94a3b8;
      font-family: Consolas, monospace;
      font-size: 11px;
    }
    .dws-trace-row {
      margin-top: 7px;
      padding-top: 7px;
      border-top: 1px dashed #1e293b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .dws-quick-row {
      display: flex;
      gap: 6px;
      padding: 6px 16px 0;
      background: rgba(22, 32, 50, 0.95);
      border-top: 1px solid rgba(148, 163, 184, 0.15);
      overflow-x: auto;
      flex-shrink: 0;
    }
    .dws-input-bar {
      padding: 8px 16px 11px;
      background: rgba(22, 32, 50, 0.95);
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-shrink: 0;
    }
    /* TAB 2: UNIFIED SKILL & TOOL STUDIO */
    .dws-studio-shell {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
    .dws-engine-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 14px;
      background: rgba(15, 23, 42, 0.92);
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
      flex-wrap: wrap;
      flex-shrink: 0;
    }
    .dws-engine-seg {
      display: inline-flex;
      gap: 5px;
      background: rgba(4, 8, 20, 0.85);
      padding: 3px;
      border-radius: 8px;
      border: 1px solid rgba(129, 140, 248, 0.25);
    }
    .dws-engine-btn {
      padding: 5px 12px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .dws-engine-btn.active {
      background: rgba(56, 189, 248, 0.22);
      color: #e0f2fe;
      box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.5);
    }
    .dws-studio-split {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .dws-studio-left {
      width: clamp(275px, 36%, 385px);
      background: rgba(22, 32, 50, 0.85);
      border-right: 1px solid rgba(148, 163, 184, 0.16);
      padding: 13px;
      display: flex;
      flex-direction: column;
      gap: 9px;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .dws-studio-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 12px 15px;
      gap: 8px;
      min-width: 0;
      min-height: 0;
      overflow-y: auto;
      background: rgba(9, 14, 28, 0.94);
    }
    .dws-code-editor {
      flex: 1;
      min-height: 180px;
      background: #0b1120;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 7px;
      padding: 10px;
      font-family: Consolas, "JetBrains Mono", monospace;
      font-size: 12px;
      line-height: 1.5;
      resize: none;
      user-select: text;
    }
    .dws-terminal {
      height: 150px;
      background: #050811;
      border: 1px solid #334155;
      border-radius: 7px;
      padding: 8px 10px;
      font-family: Consolas, monospace;
      font-size: 11.5px;
      color: #cbd5e1;
      overflow-y: auto;
      white-space: pre-wrap;
      flex-shrink: 0;
      user-select: text;
    }
    /* TAB 3: SKILL HUB, CLOUD & AUTOMATION */
    .dws-hub-shell {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      min-height: 0;
      padding: 12px 16px;
      background: rgba(9, 14, 28, 0.94);
      overflow-y: auto;
    }
    .dws-hub-shell .tf-skills-list {
      max-height: none !important;
      flex: 1;
      min-height: 180px;
    }
    #duck-lightbox-modal {
      position: fixed;
      inset: 0;
      z-index: 10090;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(2, 6, 23, 0.86);
      padding: 24px;
      pointer-events: auto;
    }
    .dws-lightbox-shell {
      background: #1e293b;
      border: 1px solid #475569;
      border-radius: 12px;
      max-width: 94vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: min(420px, 90vw);
    }
  </style>

  <div id="duck-workspace-modal" style="display: none;">
    <div id="dws-drag-header" class="dws-header">
      <div class="dws-brand">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
          <rect x="4" y="4" width="16" height="16" rx="2"></rect>
          <rect x="9" y="9" width="6" height="6"></rect>
          <path d="M15 2v2M9 2v2M20 15h2M20 9h2M15 20v2M9 20v2M2 15h2M2 9h2"></path>
        </svg>
        <span class="dws-brand-title">Duck Workspace</span>
        <span id="dws-tools-pill" class="badge" style="background: rgba(16, 185, 129, 0.16); color: #6ee7b7; font-size: 9.5px; white-space: nowrap;">[250+ SKILLS]</span>
      </div>

      <div class="dws-tabs">
        <button id="dws-tab-btn-chat" class="dws-tab-btn active" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Hội Thoại</span>
        </button>
        <button id="dws-tab-btn-studio" class="dws-tab-btn" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
          <span>Xưởng Skill</span>
        </button>
        <button id="dws-tab-btn-hub" class="dws-tab-btn" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <span>Kho &amp; Tự Động</span>
        </button>
      </div>

      <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
        <button id="tf-auth-header-badge" class="badge tf-badge-warn" type="button" style="cursor: pointer; font-size: 9.5px; max-width: 138px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; text-align: left;" title="Mở tab Cộng Đồng Cloud &amp; Đăng nhập Google">[GUEST]</button>
        <button id="btn-dws-minimize" class="icon-btn-tiny" type="button" title="Tạm ẩn cửa sổ để thao tác ứng dụng bên dưới (Zalo, trình duyệt...)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button id="btn-dws-maximize" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px; white-space: nowrap;">Phóng To</button>
        <button id="btn-dws-close" class="icon-btn-tiny" type="button" title="Đóng Trung Tâm (Esc)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- TAB 1: CHAT WORKSPACE -->
    <div id="dws-view-chat" class="dws-view active">
      <aside class="dws-sidebar">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span class="dws-sec-label" style="margin: 0;">Phiên Chat (SQLite)</span>
            <button id="btn-dws-new-session" class="action-btn" type="button" style="padding: 2px 8px; font-size: 10.5px;">+ Mới</button>
          </div>
          <div id="dws-session-list" class="dws-list"></div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span class="dws-sec-label" style="margin: 0;">Tệp Xuất Ra (outputs/)</span>
            <button id="btn-dws-refresh-outputs" class="action-btn" type="button" style="padding: 2px 7px; font-size: 10px;">Làm mới</button>
          </div>
          <div id="dws-output-list" class="dws-list"></div>
        </div>

        <div>
          <div class="dws-sec-label">9Router Pool (Live)</div>
          <div id="dws-router-mini" class="dws-list" style="max-height: 135px;"></div>
        </div>

        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 6px;">
          <button id="btn-dws-open-web-sync" class="action-btn" type="button" style="width: 100%; border-color: rgba(56, 189, 248, 0.42); color: #7dd3fc;">
            Mở Web Chat Đồng Bộ
          </button>
        </div>
      </aside>

      <main class="dws-chat-main">
        <div id="dws-messages" class="dws-messages"></div>
        <div class="dws-quick-row">
          <button class="chat-chip dws-quick-chip" type="button" data-dws-cmd="Kiểm tra hiệu năng app này">Hiệu năng App</button>
          <button class="chat-chip dws-quick-chip" type="button" data-dws-cmd="Dọn RAM và kiểm tra tiến trình nặng">Dọn RAM</button>
          <button class="chat-chip dws-quick-chip" type="button" data-dws-cmd="Tổng kết hoạt động hôm nay">Tổng kết ngày</button>
          <button class="chat-chip" id="btn-dws-jump-create-skill" type="button" style="border-color: rgba(52, 211, 153, 0.5); color: #6ee7b7;">+ Tạo Tool / Skill Mới</button>
        </div>
        <div class="dws-input-bar">
          <textarea id="dws-chat-input" class="studio-input" rows="2" style="flex: 1; resize: none; min-height: 42px; font-size: 12.5px;" placeholder="Nhập yêu cầu cho Vịt AI (vd: phân tích file, vẽ biểu đồ, đọc mail, tạo tool kiểm tra port)... Enter để gửi"></textarea>
          <button id="btn-dws-send" class="studio-btn-primary" type="button" style="height: 42px; padding: 0 18px; font-weight: 600;">
            Gửi Lệnh
          </button>
        </div>
      </main>
    </div>

    <!-- TAB 2: UNIFIED SKILL & TOOL STUDIO (PYTHON EVOLVER + QUICK SANDBOX FORGE) -->
    <div id="dws-view-studio" class="dws-view">
      <div class="dws-studio-shell">
        <div class="dws-engine-bar">
          <div class="dws-engine-seg">
            <button id="btn-dws-engine-python" class="dws-engine-btn active" type="button">
              1. Python Skill Chuẩn (AST + Pytest + Hot-Reload)
            </button>
            <button id="btn-dws-engine-sandbox" class="dws-engine-btn" type="button">
              2. Script Nhanh &amp; Sandbox (PowerShell / Python)
            </button>
          </div>
          <span style="font-size: 11px; color: #94a3b8;">
            Tự sinh mã nguồn, kiểm thử tự động trước khi nạp vào bộ công cụ của Vịt AI
          </span>
        </div>

        <!-- ENGINE 1: PYTHON SKILL EVOLVER (PROJ11/12) -->
        <div id="dws-studio-python-wrap" class="dws-studio-split">
          <aside class="dws-studio-left">
            <div>
              <div class="dws-sec-label">Chế Độ Python Skill</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <button id="btn-dws-mode-create" class="studio-btn-primary" type="button" style="font-size: 11.5px; padding: 6px;">Tạo Skill Mới</button>
                <button id="btn-dws-mode-rewrite" class="action-btn" type="button" style="font-size: 11.5px; padding: 6px;">Sửa / Nâng Cấp</button>
              </div>
            </div>

            <div id="dws-new-skill-box">
              <div class="dws-sec-label">Tên Module Mới (skills/auto_skills/)</div>
              <input id="dws-new-mod-input" class="studio-input" type="text" placeholder="vd: skill_gold_price_sjc" />
            </div>

            <div id="dws-existing-skill-box" style="display: none;">
              <div class="dws-sec-label">Chọn Skill Cần Sửa / Nâng Cấp</div>
              <select id="dws-skill-select" class="studio-input" style="background: #0b1120; color: #f8fafc;"></select>
            </div>

            <div>
              <div class="dws-sec-label">Lỗi Gặp Phải / Ngữ Cảnh Trace (Tùy chọn)</div>
              <textarea id="dws-error-ctx" class="studio-input" rows="2" style="resize: vertical; font-size: 11.5px;" placeholder="Tự động điền khi bấm 'Sửa Skill' từ khung Chat..."></textarea>
            </div>

            <div>
              <div class="dws-sec-label">Yêu Cầu Chức Năng Cho Coder &amp; Fixer</div>
              <textarea id="dws-requirement" class="studio-input" rows="4" style="resize: vertical; font-size: 12px;" placeholder="Mô tả chi tiết hàm Python cần tạo/sửa. Hệ thống tự viết skill_*.py + test_skill_*.py, kiểm tra AST, chạy Pytest &amp; Live Smoke Probe..."></textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end;">
              <div>
                <div class="dws-sec-label">Số Vòng Tự Sửa</div>
                <input id="dws-max-rounds" class="studio-input" type="number" min="1" max="4" value="3" />
              </div>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #cbd5e1; cursor: pointer; padding-bottom: 6px;">
                <input id="dws-live-smoke" type="checkbox" checked />
                <span>Live Smoke Probe</span>
              </label>
            </div>

            <button id="btn-dws-run-evolve" class="studio-btn-primary" type="button" style="padding: 10px; font-weight: 700; font-size: 12px;">
              AI Tự Đẻ Code + Pytest + Hot-Reload
            </button>
          </aside>

          <main class="dws-studio-right">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div style="display: flex; gap: 6px;">
                <button id="btn-dws-code-skill" class="studio-btn-primary" type="button" style="padding: 4px 10px; font-size: 11.5px;">skill_*.py</button>
                <button id="btn-dws-code-test" class="action-btn" type="button" style="padding: 4px 10px; font-size: 11.5px;">test_skill_*.py</button>
              </div>

              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <select id="dws-version-select" class="studio-input" style="width: auto; min-width: 145px; padding: 4px 8px; font-size: 11px; background: #0b1120; color: #f8fafc;">
                  <option value="">Bản hiện tại</option>
                </select>
                <button id="btn-dws-activate-ver" class="action-btn" type="button" style="padding: 4px 9px; font-size: 11px;" disabled>Kích Hoạt Ver</button>
                <button id="btn-dws-manual-save" class="action-btn" type="button" style="padding: 4px 10px; font-size: 11px; border-color: rgba(16, 185, 129, 0.5); color: #6ee7b7;">Lưu Mới + Pytest</button>
                <button id="btn-dws-publish-cloud" class="action-btn" type="button" style="padding: 4px 10px; font-size: 11px; border-color: rgba(56, 189, 248, 0.5); color: #7dd3fc;">Đẩy lên MongoDB</button>
                <button id="btn-dws-hot-reload" class="action-btn" type="button" style="padding: 4px 9px; font-size: 11px;">Hot-Reload</button>
                <button id="btn-dws-delete-skill" class="action-btn" type="button" style="padding: 4px 9px; font-size: 11px; border-color: rgba(239, 68, 68, 0.45); color: #fca5a5;">Xóa Skill</button>
              </div>
            </div>

            <textarea id="dws-editor-skill" class="dws-code-editor" spellcheck="false" placeholder="# Mã nguồn skill_*.py sẽ hiển thị tại đây..."></textarea>
            <textarea id="dws-editor-test" class="dws-code-editor" spellcheck="false" style="display: none;" placeholder="# Mã nguồn unit test pytest (test_skill_*.py) sẽ hiển thị tại đây..."></textarea>

            <div>
              <div class="dws-sec-label">Terminal Kiểm Chứng (Coder / AST / Pytest / Smoke Probe)</div>
              <div id="dws-studio-log" class="dws-terminal">[READY] Nhập mô tả để AI tự đẻ Skill Python mới vào skills/auto_skills/ hoặc chọn 1 Skill có sẵn để nâng cấp.</div>
            </div>
          </main>
        </div>

        <!-- ENGINE 2: QUICK SCRIPT SANDBOX FORGE (POWERSHELL / PYTHON + SELF-HEAL) -->
        <div id="dws-studio-sandbox-wrap" class="dws-studio-split" style="display: none;">
          <aside class="dws-studio-left">
            <div id="tf-pane-forge">
              <div>
                <div class="dws-sec-label">1. Mô Tả Tool Nhanh (PowerShell / Python)</div>
                <textarea id="tf-request-input" class="studio-input" rows="4" style="resize: vertical; font-size: 12px; margin-bottom: 7px;" placeholder="Ví dụ: Tạo tool kiểm tra và đóng tiến trình đang chiếm port (vd Port 3000)..."></textarea>
                <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                  <select id="select-tf-lang" class="studio-input" style="width: 145px; background: #0b1120; color: #f8fafc;">
                    <option value="auto">Ngôn ngữ: Tự chọn</option>
                    <option value="powershell">PowerShell (.ps1)</option>
                    <option value="python">Python (.py)</option>
                  </select>
                  <button id="btn-tf-new-manual" class="action-btn" type="button" style="flex: 1;">Soạn Thủ Công</button>
                </div>
                <button id="btn-tf-generate" class="studio-btn-primary" type="button" style="width: 100%; padding: 9px; font-weight: 700;">
                  AI Viết Script &amp; Kiểm Nghiệm Sandbox
                </button>
              </div>

              <div style="margin-top: 10px;">
                <div class="dws-sec-label">Tiến Trình Kiến Trúc &amp; Sandbox</div>
                <div id="tf-pipeline-log" class="tf-pipeline-log" style="max-height: 180px;">
                  [READY] Nhập yêu cầu tạo script nhanh hoặc đóng gói từ lịch sử chạy của Agent. Script bắt buộc vượt qua Sandbox trước khi lưu.
                </div>
              </div>
            </div>
          </aside>

          <main class="dws-studio-right">
            <div id="tf-draft-section" style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span class="dws-sec-label" style="margin: 0;">2. Cấu Hình Script &amp; Cổng Kiểm Chứng Bắt Buộc</span>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span id="tf-draft-lang-tag" class="badge" style="color: #7dd3fc;">[POWERSHELL]</span>
                  <span id="tf-verify-badge" class="badge tf-badge-fail">[CHƯA KIỂM CHỨNG]</span>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <input id="tf-draft-name" class="studio-input" type="text" placeholder="Tên Skill (vd: Kiểm tra &amp; Dọn Port)" />
                <input id="tf-draft-id" class="studio-input" type="text" placeholder="Mã ID slug (vd: port_cleaner)" />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
                <input id="tf-draft-triggers" class="studio-input" type="text" placeholder="Từ khóa gọi (vd: port, dọn port)" />
                <input id="tf-draft-keywords" class="studio-input" type="text" placeholder="Output mong đợi (vd: PORT)" />
                <input id="tf-draft-test-args" class="studio-input" type="text" placeholder='Args Sandbox: {"port": 59999}' />
              </div>

              <textarea id="tf-code-editor" class="dws-code-editor" spellcheck="false" style="min-height: 155px;" placeholder="# Mã nguồn PowerShell / Python sẽ xuất hiện tại đây..."></textarea>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div id="tf-sandbox-report" class="tf-report-box" style="margin: 0; max-height: 105px; overflow-y: auto;">
                  [SANDBOX] Chưa có kết quả chạy kiểm nghiệm.
                </div>
                <div id="tf-live-test-box" class="tf-live-test-box" style="margin: 0; padding: 7px 9px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 5px;">
                    <span style="font-size: 10.5px; font-weight: 700; color: #6ee7b7;">Test Chạy Thật Trên Máy</span>
                    <span id="tf-live-test-badge" class="badge tf-badge-warn" style="font-size: 9px;">[CHƯA TEST]</span>
                  </div>
                  <div class="url-row" style="margin-bottom: 5px;">
                    <input id="tf-live-test-args" class="studio-input" type="text" style="padding: 4px 7px; font-size: 11px;" placeholder='JSON args thực tế, vd {"port": 3000}' />
                    <button id="btn-tf-run-live-test" class="action-btn" type="button" style="padding: 4px 8px; font-size: 10.5px; border-color: rgba(52, 211, 153, 0.55); color: #6ee7b7;">Test Thật</button>
                  </div>
                  <div id="tf-live-test-report" style="font-size: 10.5px; color: #cbd5e1; max-height: 48px; overflow-y: auto;">
                    Chưa chạy kiểm nghiệm thực tế.
                  </div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 8px;">
                <button id="btn-tf-run-sandbox" class="action-btn" type="button" style="border-color: rgba(56, 189, 248, 0.5); color: #bae6fd;">Chạy Sandbox</button>
                <button id="btn-tf-self-heal" class="action-btn" type="button" style="border-color: rgba(250, 204, 21, 0.5); color: #fde68a;">Tự Vá Lỗi (AI)</button>
                <button id="btn-tf-confirm-save" class="studio-btn-primary" type="button" disabled style="background: linear-gradient(135deg, #059669, #0284c7); opacity: 0.45;">
                  Xác Nhận &amp; Đóng Gói Skill
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>

    <!-- TAB 3: SKILL CATALOG, CLOUD COMMUNITY & AUTOMATION RULES -->
    <div id="dws-view-hub" class="dws-view">
      <div class="dws-hub-shell">
        <div class="studio-tabs-bar" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 10px; flex-shrink: 0;">
          <button id="tab-btn-tf-packs" class="studio-tab-btn active" type="button">
            <span>Kho 6 Pack (BM25)</span>
            <span id="tf-packs-count" class="badge" style="margin-left: 4px; font-size: 9px; padding: 1px 6px; background: rgba(56, 189, 248, 0.2); color: #7dd3fc;">209</span>
          </button>
          <button id="tab-btn-tf-skills" class="studio-tab-btn" type="button">
            <span>Skill Đã Đóng Gói</span>
            <span id="tf-skills-count" class="badge" style="margin-left: 4px; font-size: 9px; padding: 1px 6px;">0</span>
          </button>
          <button id="tab-btn-tf-cloud" class="studio-tab-btn" type="button">Cộng Đồng Cloud</button>
          <button id="tab-btn-tf-auto" class="studio-tab-btn" type="button">Tự Động Hóa &amp; CDP</button>
        </div>

        <!-- SUB-PANE 1: 209 PACK SKILLS -->
        <div id="tf-pane-packs" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
          <div class="studio-section" style="margin-bottom: 8px; flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
              <span class="studio-section-title" style="margin: 0;">Kho 6 Pack Skills (BM25 Sub-Goal Router)</span>
              <div style="display: flex; gap: 5px;">
                <span id="tf-pack-wm-badge" class="badge" style="font-size: 9px; background: rgba(16, 185, 129, 0.16); color: #6ee7b7;">[$mem: 0]</span>
                <button id="btn-tf-pack-reload" class="action-btn" type="button" style="padding: 3px 8px; font-size: 10px;">Quét Lại Pack</button>
              </div>
            </div>
            <div class="url-row" style="margin-bottom: 6px;">
              <input id="tf-pack-route-input" class="studio-input" type="text" placeholder="Nhập câu lệnh thử định tuyến BM25 hoặc lọc tên skill (vd: đọc mail gmail rồi tạo google sheet)..." />
              <button id="btn-tf-pack-route-test" class="studio-btn-primary" type="button" style="white-space: nowrap;">Test BM25</button>
            </div>
            <div id="tf-pack-meta-log" class="tf-pipeline-log" style="max-height: 62px; margin-bottom: 0; font-size: 10px;">
              [PACK ADAPTER] Đang nạp danh mục 6 pack skills...
            </div>
          </div>
          <div id="tf-pack-skills-list" class="tf-skills-list">
            <div class="dash-sub">Đang tải danh sách tools...</div>
          </div>
        </div>

        <!-- SUB-PANE 2: CUSTOM PACKAGED SKILLS -->
        <div id="tf-pane-skills" style="display: none; flex-direction: column; flex: 1; min-height: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-shrink: 0;">
            <span style="font-size: 11.5px; color: #94a3b8;">
              Danh sách Script nhanh đã kiểm chứng Sandbox trên máy này (tự động kích hoạt khi chat khớp từ khóa).
            </span>
            <button id="btn-tf-refresh-skills" class="action-btn" type="button" style="padding: 4px 9px; font-size: 10.5px; flex-shrink: 0;">Làm Mới</button>
          </div>
          <div id="tf-skills-list" class="tf-skills-list">
            <div class="dash-sub">Chưa có Skill tùy chỉnh nào được đóng gói.</div>
          </div>
        </div>

        <!-- SUB-PANE 3: CLOUD COMMUNITY -->
        <div id="tf-pane-cloud" style="display: none; flex-direction: column; flex: 1; min-height: 0;">
          <div class="studio-section" style="margin-bottom: 8px; flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div>
                <div class="studio-section-title" style="margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
                  <span>Tài Khoản Google &amp; Kho Cloud MongoDB</span>
                  <span id="tf-hub-health-badge" class="badge tf-badge-warn" style="font-size: 9px;">[HUB: ...]</span>
                </div>
                <div id="tf-cloud-auth-info" style="font-size: 11px; color: #cbd5e1;">
                  [GUEST] Đăng nhập Google để chia sẻ hoặc tải Skill từ kho cộng đồng.
                </div>
              </div>
              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <button id="btn-tf-google-login" class="studio-btn-primary" type="button" style="padding: 5px 11px; font-size: 11px;">Đăng Nhập Google</button>
                <button id="btn-tf-google-logout" class="action-btn" type="button" style="display: none; padding: 5px 10px; font-size: 11px; border-color: rgba(248, 113, 113, 0.45); color: #fca5a5;">Đăng Xuất</button>
                <button id="btn-tf-open-web-chat" class="action-btn" type="button" style="padding: 5px 10px; font-size: 11px; border-color: rgba(56, 189, 248, 0.45); color: #bae6fd;">Mở Web Chat</button>
                <button id="btn-tf-sync-cog-memory" class="action-btn" type="button" style="padding: 5px 10px; font-size: 11px; border-color: rgba(167, 139, 250, 0.5); color: #ddd6fe;">Đồng Bộ Trí Nhớ</button>
                <button id="btn-tf-toggle-cloud-cfg" class="action-btn" type="button" style="padding: 5px 10px; font-size: 11px;">Cấu Hình Cloud</button>
              </div>
            </div>

            <div id="tf-cloud-config-box" style="display: none; margin-top: 9px; padding-top: 9px; border-top: 1px solid rgba(148, 163, 184, 0.2);">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                <input id="tf-cfg-google-client-id" class="studio-input" type="text" placeholder="Google Client ID (xxxx.apps.googleusercontent.com)" />
                <input id="tf-cfg-google-secret" class="studio-input" type="password" placeholder="Google Client Secret (để trống nếu giữ nguyên)" />
              </div>
              <div style="display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center;">
                <input id="tf-cfg-hub-url" class="studio-input" type="text" placeholder="https://duck-ai-3p5a.onrender.com" />
                <button id="btn-tf-save-cloud-cfg" class="studio-btn-primary" type="button" style="padding: 6px 12px; font-size: 11px;">Lưu Cấu Hình</button>
              </div>
            </div>
          </div>

          <div class="url-row" style="margin-bottom: 8px; flex-shrink: 0;">
            <input id="tf-cloud-search" class="studio-input" type="text" placeholder="Tìm tool cộng đồng (tên, mô tả, tác giả, trigger)..." />
            <select id="tf-cloud-lang-filter" class="studio-input" style="max-width: 135px; background: rgba(15, 23, 42, 0.88); color: #f8fafc;">
              <option value="all">Tất cả</option>
              <option value="powershell">PowerShell</option>
              <option value="python">Python</option>
            </select>
            <button id="btn-tf-cloud-fetch" class="action-btn" type="button" style="flex-shrink: 0; border-color: rgba(56, 189, 248, 0.5); color: #bae6fd;">Tải Danh Sách</button>
          </div>

          <div id="tf-cloud-status-log" class="tf-pipeline-log" style="margin-bottom: 8px; max-height: 56px; flex-shrink: 0;">
            [CLOUD HUB] Sẵn sàng kết nối kho Skill cộng đồng.
          </div>

          <div id="tf-cloud-skills-list" class="tf-skills-list">
            <div class="dash-sub">Chưa tải danh sách Skill cộng đồng. Hãy đăng nhập Google và bấm "Tải Danh Sách".</div>
          </div>
        </div>

        <!-- SUB-PANE 4: AUTOMATION RULES & CHROME CDP -->
        <div id="tf-pane-auto" style="display: none; flex-direction: column; flex: 1; min-height: 0;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; flex-shrink: 0;">
            <div class="studio-section" style="margin-bottom: 0;">
              <div class="studio-section-title" style="margin-bottom: 4px;">Gợi Ý Nhanh (1-Click Thêm Trigger)</div>
              <div id="tf-auto-presets" class="studio-chip-group" style="margin-bottom: 0;"></div>
            </div>
            <div class="studio-section" style="margin-bottom: 0;">
              <div class="studio-section-title" style="margin-bottom: 4px;">Chrome DevTools Protocol (CDP Port 9222)</div>
              <div class="url-row" style="margin-bottom: 4px;">
                <button id="btn-tf-cdp-launch" class="studio-btn-primary" type="button" style="flex: 1; font-size: 11px;">Mở Chrome CDP</button>
                <button id="btn-tf-cdp-tabs" class="action-btn" type="button" style="font-size: 11px;">Quét Tab</button>
              </div>
              <div id="tf-cdp-status-log" style="font-size: 10.5px; color: #94a3b8;">
                [CDP] Hỗ trợ Agent đọc DOM thật, điền form và trích xuất bảng web.
              </div>
            </div>
          </div>

          <div class="studio-section" style="margin-bottom: 8px; flex-shrink: 0;">
            <div class="studio-section-title" style="margin-bottom: 5px;">Tạo Rule Tự Động (Sự Kiện X -&gt; Chạy Skill Y)</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 0.7fr 1.3fr; gap: 6px; margin-bottom: 6px;">
              <input id="tf-auto-name" class="studio-input" type="text" placeholder="Tên Rule (vd: Dọn RAM)" />
              <select id="tf-auto-trig-type" class="studio-input" style="background: rgba(15, 23, 42, 0.88); color: #f8fafc;">
                <option value="interval_min">Định kỳ mỗi N phút</option>
                <option value="daily_time">Giờ cố định (HH:MM)</option>
                <option value="app_focus">Khi mở App (tên cửa sổ)</option>
                <option value="cpu_high">Khi CPU &gt;= %</option>
                <option value="ram_high">Khi RAM &gt;= GB</option>
              </select>
              <input id="tf-auto-trig-val" class="studio-input" type="text" placeholder="Giá trị (30 / 08:30)" />
              <select id="tf-auto-skill-select" class="studio-input" style="background: rgba(15, 23, 42, 0.88); color: #f8fafc;"></select>
            </div>
            <div class="url-row" style="margin-bottom: 0;">
              <input id="tf-auto-args" class="studio-input" type="text" placeholder='Tham số JSON (vd: {})' />
              <button id="btn-tf-add-auto-rule" class="studio-btn-primary" type="button" style="flex-shrink: 0;">Thêm Rule</button>
            </div>
          </div>

          <div id="tf-auto-rules-list" class="tf-skills-list">
            <div class="dash-sub">Chưa có Rule tự động nào.</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- LIGHTBOX ZOOM MODAL FOR CHARTS, SCREENSHOTS & WIDE TABLES -->
  <div id="duck-lightbox-modal" style="display: none;">
    <div class="dws-lightbox-shell">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #334155; gap: 12px;">
        <span id="dws-lightbox-title" style="font-weight: 600; font-size: 13px; color: #e2e8f0;">Xem chi tiết</span>
        <div style="display: flex; gap: 6px; align-items: center;">
          <a id="dws-lightbox-download" class="studio-btn-primary" href="#" download style="display: none; padding: 4px 10px; font-size: 11px; text-decoration: none;">Tải Về</a>
          <button id="btn-dws-lightbox-close" class="action-btn" type="button" style="padding: 4px 10px; font-size: 11px;">Đóng (Esc)</button>
        </div>
      </div>
      <div id="dws-lightbox-body" style="padding: 14px; overflow: auto; background: #0b1120; max-height: 80vh;"></div>
    </div>
  </div>
`;
