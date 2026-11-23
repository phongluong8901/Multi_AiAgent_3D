export const toolForgeModalHtml = `
  <div id="tool-forge-modal" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title" style="flex-wrap: wrap;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
        <span>Xưởng Skill AI &amp; Sandbox Kiểm Nghiệm</span>
        <span class="badge" style="background: rgba(16, 185, 129, 0.16); color: #6ee7b7; border-color: rgba(52, 211, 153, 0.35); font-size: 9.5px;">[VERIFIED ONLY + SELF-HEAL]</span>
        <button id="tf-auth-header-badge" class="badge tf-badge-warn" type="button" style="cursor: pointer; font-size: 9.5px;" title="Mở tab Kho Cộng Đồng &amp; Đăng nhập Google">[OFFLINE / GUEST]</button>
      </div>
      <button id="btn-close-tool-forge" class="icon-btn-tiny" type="button" title="Đóng Xưởng Skill (Esc)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="studio-tabs-bar" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 10px;">
      <button id="tab-btn-tf-forge" class="studio-tab-btn active" type="button">Tạo &amp; Sandbox</button>
      <button id="tab-btn-tf-skills" class="studio-tab-btn" type="button">
        <span>Kho Skill</span>
        <span id="tf-skills-count" class="badge" style="margin-left: 4px; font-size: 9px; padding: 1px 6px;">0</span>
      </button>
      <button id="tab-btn-tf-cloud" class="studio-tab-btn" type="button">Cộng Đồng</button>
      <button id="tab-btn-tf-auto" class="studio-tab-btn" type="button">Tự Động Hóa</button>
    </div>

    <!-- TAB 1: TẠO TOOL QUA GEMINI & KIỂM NGHIỆM SANDBOX -->
    <div id="tf-pane-forge">
      <div class="studio-section" style="margin-bottom: 9px;">
        <div class="studio-section-title">1. Mô tả Tool cần tạo (Local LLM -> Gemini Architect -> Sandbox)</div>
        <textarea id="tf-request-input" class="ocr-textarea" style="min-height: 58px; margin-bottom: 7px;" placeholder="Ví dụ: Tạo tool kiểm tra và đóng tiến trình đang chiếm port (vd Port 3000)..."></textarea>
        <div class="url-row" style="margin-bottom: 0;">
          <select id="select-tf-lang" class="studio-input" style="max-width: 155px; background: rgba(15, 23, 42, 0.88); color: #f8fafc;">
            <option value="auto">Ngôn ngữ: Tự chọn</option>
            <option value="powershell">PowerShell (.ps1)</option>
            <option value="python">Python (.py)</option>
          </select>
          <button id="btn-tf-generate" class="studio-btn-primary" type="button" style="flex: 1;">
            Nhờ Gemini Viết &amp; Kiểm Nghiệm Sandbox
          </button>
          <button id="btn-tf-new-manual" class="action-btn" type="button" title="Tự soạn thảo PowerShell / Python &amp; kiểm chứng Sandbox thủ công">
            Tự Viết Thủ Công
          </button>
        </div>
      </div>

      <div id="tf-pipeline-log" class="tf-pipeline-log">
        [READY] Nhập yêu cầu tạo tool mới hoặc hỏi trực tiếp vịt trong khung chat. Tool chỉ được đóng gói thành Skill khi đã vượt qua bài test trên Sandbox.
      </div>

      <div id="tf-draft-section" class="studio-section" style="display: none; margin-top: 9px; margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span class="studio-section-title" style="margin: 0;">2. Mã Nguồn &amp; Cổng Kiểm Chứng Bắt Buộc</span>
          <span id="tf-verify-badge" class="badge tf-badge-fail">[CHƯA KIỂM CHỨNG]</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
          <div>
            <div class="slider-label" style="margin-bottom: 2px;"><span>Tên Skill</span></div>
            <input id="tf-draft-name" class="studio-input" type="text" placeholder="Kiểm tra &amp; Dọn Port..." />
          </div>
          <div>
            <div class="slider-label" style="margin-bottom: 2px;"><span>Mã ID (slug)</span></div>
            <input id="tf-draft-id" class="studio-input" type="text" placeholder="port_process_cleaner" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
          <div>
            <div class="slider-label" style="margin-bottom: 2px;"><span>Từ khóa kích hoạt (cách nhau dấu phẩy)</span></div>
            <input id="tf-draft-triggers" class="studio-input" type="text" placeholder="port, kẹt port, dọn port..." />
          </div>
          <div>
            <div class="slider-label" style="margin-bottom: 2px;"><span>Từ khóa kiểm chứng Output (Expected)</span></div>
            <input id="tf-draft-keywords" class="studio-input" type="text" placeholder="PORT, 59999" />
          </div>
        </div>

        <div style="margin-bottom: 6px;">
          <div class="slider-label" style="margin-bottom: 2px;"><span>Tham số Test Sandbox (JSON)</span></div>
          <input id="tf-draft-test-args" class="studio-input" type="text" placeholder='{"port": 59999, "action": "check"}' />
        </div>

        <div class="slider-label" style="margin-bottom: 3px;">
          <span>Code Script (chỉnh sửa thủ công sẽ yêu cầu test Sandbox lại trước khi lưu)</span>
          <span id="tf-draft-lang-tag" style="color: #7dd3fc;">[POWERSHELL]</span>
        </div>
        <textarea id="tf-code-editor" class="tf-code-editor" spellcheck="false" placeholder="Mã nguồn sẽ xuất hiện ở đây..."></textarea>

        <div id="tf-sandbox-report" class="tf-report-box">
          [SANDBOX] Chưa có kết quả chạy kiểm nghiệm.
        </div>

        <div id="tf-live-test-box" class="tf-live-test-box">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 5px;">
            <span class="studio-section-title" style="margin: 0; color: #6ee7b7;">3. Kiểm Nghiệm Chạy Thật Bởi Người Dùng (DUCK_SANDBOX_MODE=0)</span>
            <span id="tf-live-test-badge" class="badge tf-badge-warn">[CHƯA TEST THẬT]</span>
          </div>
          <div class="url-row" style="margin-bottom: 6px;">
            <input id="tf-live-test-args" class="studio-input" type="text" placeholder='Tham số chạy thật (JSON), vd {"port": 3000}' />
            <button id="btn-tf-run-live-test" class="action-btn" type="button" style="flex-shrink: 0; border-color: rgba(52, 211, 153, 0.55); color: #6ee7b7;">Test Chạy Thật</button>
          </div>
          <div id="tf-live-test-report" class="tf-report-box" style="margin-top: 0;">
            [USER TEST] Chưa chạy kiểm nghiệm thực tế. Bấm "Test Chạy Thật" để thực thi trực tiếp trên máy (không mock Sandbox) và kiểm tra kết quả / hành động trước khi đóng gói.
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 6px; margin-top: 8px;">
          <button id="btn-tf-run-sandbox" class="action-btn" type="button" style="border-color: rgba(56, 189, 248, 0.5); color: #bae6fd;">Chạy Sandbox</button>
          <button id="btn-tf-self-heal" class="action-btn" type="button" style="border-color: rgba(250, 204, 21, 0.5); color: #fde68a;">Tự Vá (Gemini)</button>
          <button id="btn-tf-confirm-save" class="studio-btn-primary" type="button" disabled style="background: linear-gradient(135deg, #059669, #0284c7); opacity: 0.45;">
            Xác Nhận &amp; Đóng Gói Skill
          </button>
        </div>
      </div>
    </div>

    <!-- TAB 2: KHO SKILL ĐÃ ĐÓNG GÓI & TỰ VÁ -->
    <div id="tf-pane-skills" style="display: none;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px;">
        <span style="font-size: 11px; color: #94a3b8;">
          Local LLM tự động tái sử dụng các Skill đã kiểm chứng dưới đây khi chat khớp yêu cầu.
        </span>
        <button id="btn-tf-refresh-skills" class="action-btn" type="button" style="padding: 4px 9px; font-size: 10.5px; flex-shrink: 0;">Làm Mới</button>
      </div>
      <div id="tf-skills-list" class="tf-skills-list">
        <div class="dash-sub">Chưa có Skill tùy chỉnh nào được đóng gói.</div>
      </div>
    </div>

    <!-- TAB 3: KHO CỘNG ĐỒNG CLOUD (GOOGLE OAUTH 2.0 + MONGODB) -->
    <div id="tf-pane-cloud" style="display: none;">
      <div class="studio-section" style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div>
            <div class="studio-section-title" style="margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
              <span>Tài Khoản Google (OAuth 2.0 Web Callback)</span>
              <span id="tf-hub-health-badge" class="badge tf-badge-warn" style="font-size: 9px;">[HUB: ...]</span>
            </div>
            <div id="tf-cloud-auth-info" style="font-size: 11px; color: #cbd5e1;">
              [GUEST] App chạy bình thường không cần đăng nhập. Đăng nhập Google để đẩy lên / kéo xuống Skill từ MongoDB.
            </div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
            <button id="btn-tf-google-login" class="studio-btn-primary" type="button" style="padding: 5px 11px; font-size: 11px;">
              Đăng Nhập Google
            </button>
            <button id="btn-tf-google-logout" class="action-btn" type="button" style="display: none; padding: 5px 10px; font-size: 11px; border-color: rgba(248, 113, 113, 0.45); color: #fca5a5;">
              Đăng Xuất
            </button>
            <button id="btn-tf-open-web-chat" class="action-btn" type="button" style="padding: 5px 10px; font-size: 11px; border-color: rgba(56, 189, 248, 0.45); color: #bae6fd;">
              Mở Web Chat
            </button>
            <button id="btn-tf-toggle-cloud-cfg" class="action-btn" type="button" style="padding: 5px 10px; font-size: 11px;">
              Cấu Hình Cloud
            </button>
          </div>
        </div>

        <div id="tf-cloud-config-box" style="display: none; margin-top: 9px; padding-top: 9px; border-top: 1px solid rgba(148, 163, 184, 0.2);">
          <div style="font-size: 10.5px; color: #94a3b8; margin-bottom: 6px;">
            App chạy offline độc lập không cần backend online. Khi muốn đồng bộ Skill với MongoDB, khởi chạy <code>cloud-hub-backend</code> và trỏ URL bên dưới. Google OAuth dùng loopback tự động <code>http://127.0.0.1:&lt;port&gt;/callback</code>.
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
            <div>
              <div class="slider-label" style="margin-bottom: 2px;"><span>Google Client ID</span></div>
              <input id="tf-cfg-google-client-id" class="studio-input" type="text" placeholder="xxxx.apps.googleusercontent.com" />
            </div>
            <div>
              <div class="slider-label" style="margin-bottom: 2px;"><span>Google Client Secret (nếu có)</span></div>
              <input id="tf-cfg-google-secret" class="studio-input" type="password" placeholder="Để trống nếu giữ nguyên hoặc không dùng" />
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: end;">
            <div>
              <div class="slider-label" style="margin-bottom: 2px;"><span>Cloud Hub Backend URL (cloud-hub-backend)</span></div>
              <input id="tf-cfg-hub-url" class="studio-input" type="text" placeholder="http://127.0.0.1:8787" />
            </div>
            <button id="btn-tf-save-cloud-cfg" class="studio-btn-primary" type="button" style="padding: 6px 12px; font-size: 11px;">
              Lưu Cấu Hình
            </button>
          </div>
        </div>
      </div>

      <div class="url-row" style="margin-bottom: 8px;">
        <input id="tf-cloud-search" class="studio-input" type="text" placeholder="Tìm tool cộng đồng (tên, mô tả, tác giả, trigger)..." />
        <select id="tf-cloud-lang-filter" class="studio-input" style="max-width: 130px; background: rgba(15, 23, 42, 0.88); color: #f8fafc;">
          <option value="all">Tất cả</option>
          <option value="powershell">PowerShell</option>
          <option value="python">Python</option>
        </select>
        <button id="btn-tf-cloud-fetch" class="action-btn" type="button" style="flex-shrink: 0; border-color: rgba(56, 189, 248, 0.5); color: #bae6fd;">
          Tải Danh Sách
        </button>
      </div>

      <div id="tf-cloud-status-log" class="tf-pipeline-log" style="margin-bottom: 8px; max-height: 62px;">
        [CLOUD HUB] Cần kết nối Internet và đăng nhập Google để tải hoặc chia sẻ Skill trên MongoDB.
      </div>

      <div id="tf-cloud-skills-list" class="tf-skills-list" style="max-height: 300px;">
        <div class="dash-sub">Chưa tải danh sách Skill cộng đồng. Hãy đăng nhập Google và bấm "Tải Danh Sách".</div>
      </div>
    </div>

    <!-- TAB 4: TRIGGER TỰ ĐỘNG HÓA & CHROME CDP -->
    <div id="tf-pane-auto" style="display: none;">
      <div class="studio-section" style="margin-bottom: 8px;">
        <div class="studio-section-title" style="margin-bottom: 4px;">Gợi Ý Nhanh (1-Click Thêm Trigger)</div>
        <div id="tf-auto-presets" class="studio-chip-group" style="margin-bottom: 0;"></div>
      </div>

      <div class="studio-section" style="margin-bottom: 8px;">
        <div class="studio-section-title" style="margin-bottom: 4px;">Chrome DevTools Protocol (CDP - Tự động hóa Web theo DOM)</div>
        <div class="url-row" style="margin-bottom: 4px;">
          <button id="btn-tf-cdp-launch" class="studio-btn-primary" type="button" style="flex: 1; font-size: 11px;">
            Mở Chrome CDP (Port 9222)
          </button>
          <button id="btn-tf-cdp-tabs" class="action-btn" type="button" style="font-size: 11px;">
            Quét Tab Đang Mở
          </button>
        </div>
        <div id="tf-cdp-status-log" style="font-size: 10.5px; color: #94a3b8;">
          [CDP] Hỗ trợ Agent đọc DOM thật, điền form, click CSS selector và trích xuất bảng web.
        </div>
      </div>

      <div class="studio-section" style="margin-bottom: 8px;">
        <div class="studio-section-title" style="margin-bottom: 5px;">Tạo Rule Tự Động (Khi có sự kiện X -&gt; Chạy Skill Y)</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
          <input id="tf-auto-name" class="studio-input" type="text" placeholder="Tên Rule (vd: Dọn RAM định kỳ)" />
          <select id="tf-auto-trig-type" class="studio-input" style="background: rgba(15, 23, 42, 0.88); color: #f8fafc;">
            <option value="interval_min">Định kỳ mỗi N phút (interval_min)</option>
            <option value="daily_time">Giờ cố định hàng ngày (HH:MM)</option>
            <option value="app_focus">Khi mở/active App (tên cửa sổ)</option>
            <option value="cpu_high">Khi CPU &gt;= %</option>
            <option value="ram_high">Khi RAM đã dùng &gt;= GB</option>
          </select>
        </div>
        <div style="display: grid; grid-template-columns: 0.7fr 1.3fr; gap: 6px; margin-bottom: 6px;">
          <input id="tf-auto-trig-val" class="studio-input" type="text" placeholder="Giá trị (vd: 30 hoặc 08:30 hoặc code)" />
          <select id="tf-auto-skill-select" class="studio-input" style="background: rgba(15, 23, 42, 0.88); color: #f8fafc;"></select>
        </div>
        <div class="url-row" style="margin-bottom: 0;">
          <input id="tf-auto-args" class="studio-input" type="text" placeholder='Tham số JSON (vd: {})' />
          <button id="btn-tf-add-auto-rule" class="studio-btn-primary" type="button" style="flex-shrink: 0;">
            Thêm Rule
          </button>
        </div>
      </div>

      <div id="tf-auto-rules-list" class="tf-skills-list" style="max-height: 220px;">
        <div class="dash-sub">Chưa có Rule tự động nào.</div>
      </div>
    </div>
  </div>
`;
