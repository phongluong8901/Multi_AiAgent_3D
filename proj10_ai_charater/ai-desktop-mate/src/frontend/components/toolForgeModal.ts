export const toolForgeModalHtml = `
  <div id="tool-forge-modal" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title" style="flex-wrap: wrap;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
        <span>Xưởng Skill AI &amp; Sandbox Kiểm Nghiệm</span>
        <span class="badge" style="background: rgba(16, 185, 129, 0.16); color: #6ee7b7; border-color: rgba(52, 211, 153, 0.35); font-size: 9.5px;">[VERIFIED ONLY + SELF-HEAL]</span>
      </div>
      <button id="btn-close-tool-forge" class="icon-btn-tiny" type="button" title="Đóng Xưởng Skill (Esc)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="studio-tabs-bar" style="grid-template-columns: 1fr 1fr; margin-bottom: 10px;">
      <button id="tab-btn-tf-forge" class="studio-tab-btn active" type="button">Tạo &amp; Kiểm Nghiệm Sandbox</button>
      <button id="tab-btn-tf-skills" class="studio-tab-btn" type="button">
        <span>Kho Skill Đã Lưu</span>
        <span id="tf-skills-count" class="badge" style="margin-left: 4px; font-size: 9px; padding: 1px 6px;">0</span>
      </button>
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
  </div>
`;
