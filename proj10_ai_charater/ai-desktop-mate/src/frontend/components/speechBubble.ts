export const speechBubbleHtml = `
  <!-- CỤM THOẠI & CHAT GỌN DUCK AI MATE -->
  <div id="speech-bubble" class="glass-panel duck-speech-balloon">
    <!-- HEADER ĐIỀU KHIỂN & TRẠNG THÁI AI -->
    <div class="bubble-header">
      <div class="bubble-header-left">
        <span class="badge badge-duck-tag">[DUCK AI]</span>
        <span id="llm-badge" class="badge badge-chat-tag">[LLM: ...]</span>
        <span id="duck-mood-indicator" class="badge badge-mood-tag">Live</span>
      </div>
      <div class="bubble-header-right">
        <button id="btn-toggle-chat-side" class="btn-expand-history" type="button" title="Đổi vị trí cửa sổ Chat Trái / Phải">
          Dịch Trái
        </button>
        <button id="btn-open-chat-from-bubble" class="btn-expand-history" type="button" title="Mở rộng / Thu gọn Lịch sử Chat (SQLite)">
          Lịch sử +
        </button>
        <button id="btn-minimize-bubble" class="icon-btn-tiny" type="button" title="Thu nhỏ cụm Thoại & Chat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- KHUNG THOẠI CHÍNH & CẢNH BÁO TÀI NGUYÊN / TƯƠNG TÁC -->
    <div class="bubble-dialogue-card">
      <div id="bubble-content" class="bubble-text">
        Quạc quạc! Tớ là Duck AI Manager. Hãy click vào Chrome hoặc bất kỳ cửa sổ nào để tớ tương tác nhé!
      </div>

      <div id="suggestion-actions" style="display: none; gap: 6px; margin-top: 8px;">
        <button id="btn-sug-accept" class="btn-footer" type="button" style="background: rgba(52, 211, 153, 0.2); border-color: rgba(52, 211, 153, 0.45); color: #6ee7b7;">Đồng ý</button>
        <button id="btn-sug-dismiss" class="btn-footer" type="button" style="background: rgba(148, 163, 184, 0.14); border-color: rgba(148, 163, 184, 0.3); color: #cbd5e1;">Để sau</button>
      </div>
    </div>

    <!-- KHUNG LỊCH SỬ CHAT MỞ RỘNG (Mặc định ẩn, mở khi bấm 'Lịch sử +' hoặc Dock Chat) -->
    <div id="chat-dialog-panel" style="display: none;">
      <div class="chat-history-toolbar">
        <span style="font-size: 10px; font-weight: 700; color: #a5b4fc; letter-spacing: 0.4px;">LỊCH SỬ HỘI THOẠI [SQLITE]</span>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button id="btn-clear-chat" class="icon-btn-tiny" type="button" title="Xóa toàn bộ lịch sử chat">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
          <button id="btn-close-chat" class="icon-btn-tiny" type="button" title="Thu gọn lịch sử">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <div id="chat-history-list" class="chat-history-container">
        <div class="chat-msg msg-assistant">
          <div class="msg-author-tag">[AI MATE]</div>
          <div class="msg-bubble">
            Xin chào Chủ nhân! Tớ là trợ lý Duck AI. Bạn có thể hỏi đáp nhanh ở ô dưới hoặc mở rộng để xem lại lịch sử.
          </div>
        </div>
      </div>

      <div id="chat-quick-suggestions" class="chat-chips-row">
        <button class="chat-chip" type="button" data-cmd="Kiểm tra hiệu năng app này">Hiệu năng App</button>
        <button class="chat-chip" type="button" data-cmd="Dọn RAM">Dọn RAM</button>
        <button class="chat-chip" type="button" data-cmd="Kiểm tra trí nhớ và thói quen">Trí nhớ</button>
        <button class="chat-chip" type="button" data-cmd="Tổng kết ngày hôm nay">Tổng kết ngày</button>
        <button class="chat-chip" type="button" data-cmd="Đổi sang NVIDIA MicroDuck">Vịt MicroDuck</button>
      </div>
    </div>

    <!-- KHUNG NHẬP HỎI ĐÁP & RA LỆNH NHANH -->
    <div class="bubble-input-row">
      <input id="bubble-input" class="bubble-input" type="text" placeholder="Hỏi đáp hoặc kéo PDF/CSV/Excel/Ảnh vào Vịt..." />
      <input id="any-file-input" type="file" accept=".pdf,.csv,.tsv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.bmp,.txt,.json,.log,.md" style="display: none;" />
      <button id="btn-feed-file-btn" class="bubble-btn-file" type="button" title="Chọn PDF, CSV, Excel hoặc Ảnh đút vào miệng Vịt">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </button>
      <button id="btn-send-msg" class="bubble-btn-send" type="button" title="Gửi tin nhắn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  </div>

  <!-- UI HÁ MỒM TRỰC QUAN (HÀM MỎ TRÊN / HỌNG XOÁY / LƯỠI / HÀM MỎ DƯỚI) -->
  <div id="file-ingest-mouth-hud" style="display: none;">
    <svg class="mouth-jaw-upper" viewBox="0 0 220 56" width="180" height="46" fill="none">
      <path d="M12 50 C20 12, 62 4, 110 4 C158 4, 200 12, 208 50 Q110 38 12 50 Z" fill="url(#upperBillGrad)" stroke="#fdba74" stroke-width="2.5" />
      <ellipse cx="82" cy="24" rx="5" ry="3.5" fill="#7c2d12" />
      <ellipse cx="138" cy="24" rx="5" ry="3.5" fill="#7c2d12" />
      <path d="M46 18 Q110 8 174 18" stroke="#fef08a" stroke-width="2" stroke-linecap="round" opacity="0.6" />
      <defs>
        <linearGradient id="upperBillGrad" x1="110" y1="4" x2="110" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fbbf24" />
          <stop offset="100%" stop-color="#ea580c" />
        </linearGradient>
      </defs>
    </svg>

    <div class="mouth-cavity">
      <div class="mouth-suction-ring"></div>
      <div id="ingest-portal-sub" class="mouth-file-pill">PDF / CSV / EXCEL / IMG</div>
      <svg class="mouth-tongue" viewBox="0 0 120 34" width="104" height="30" fill="none">
        <path d="M10 30 Q60 0 110 30 Q60 36 10 30 Z" fill="#fb7185" stroke="#be123c" stroke-width="2" />
        <line x1="60" y1="14" x2="60" y2="30" stroke="#e11d48" stroke-width="2" stroke-linecap="round" opacity="0.7" />
      </svg>
    </div>

    <svg class="mouth-jaw-lower" viewBox="0 0 210 48" width="172" height="40" fill="none">
      <path d="M12 8 Q105 22 198 8 C186 40, 148 45, 105 45 C62 45, 24 40, 12 8 Z" fill="url(#lowerBillGrad)" stroke="#fb923c" stroke-width="2.5" />
      <defs>
        <linearGradient id="lowerBillGrad" x1="105" y1="8" x2="105" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#c2410c" />
          <stop offset="100%" stop-color="#f97316" />
        </linearGradient>
      </defs>
    </svg>
  </div>

  <!-- MODAL DASHBOARD PHÂN TÍCH FILE SAU KHI HẤP THỤ -->
  <div id="file-dashboard-modal" class="glass-panel" style="display: none;">
    <div class="fd-header">
      <div>
        <div id="fd-title" class="fd-title">[FILE DASHBOARD] Đang phân tích...</div>
        <div id="fd-meta" class="fd-meta">--</div>
      </div>
      <button id="btn-fd-close" class="icon-btn-tiny" type="button" title="Đóng Dashboard Phân Tích">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div id="fd-kpi-grid" class="fd-kpi-grid"></div>

    <div id="fd-ai-summary-section" class="fd-section" style="display: none; border-color: rgba(167, 139, 250, 0.45); background: rgba(76, 29, 149, 0.16);">
      <div class="fd-sec-label" style="color: #ddd6fe;">TÓM TẮT ĐẦY ĐỦ TỪ AI</div>
      <div id="fd-ai-summary-box" class="fd-excerpt-box" style="max-height: 170px;"></div>
    </div>

    <div id="fd-chart-section" class="fd-section" style="display: none;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
        <div class="fd-sec-label" style="margin-bottom: 0;">BIỂU ĐỒ CHUYÊN GIA SỐ LIỆU (AUTO-INSIGHT)</div>
        <div id="fd-col-tabs" class="fd-col-tabs"></div>
      </div>
      <div id="fd-expert-insights" class="fd-expert-insights"></div>
      <div class="fd-chart-toolbar">
        <div id="fd-chart-type-tabs" class="fd-chart-type-tabs"></div>
        <div id="fd-scatter-controls" class="fd-scatter-controls" style="display: none;"></div>
      </div>
      <div id="fd-chart-bars" class="fd-chart-stage"></div>
    </div>

    <div id="fd-stats-section" class="fd-section" style="display: none;">
      <div class="fd-sec-label">THỐNG KÊ TOÁN HỌC CÁC CỘT SỐ</div>
      <div id="fd-stats-grid" class="fd-stats-grid"></div>
    </div>

    <div id="fd-table-section" class="fd-section" style="display: none;">
      <div class="fd-sec-label">BẢNG DỮ LIỆU MẪU</div>
      <div id="fd-table-wrap" class="fd-table-wrap"></div>
    </div>

    <div id="fd-excerpt-section" class="fd-section" style="display: none;">
      <div class="fd-sec-label">VĂN BẢN TRÍCH XUẤT / OCR</div>
      <div id="fd-excerpt-box" class="fd-excerpt-box"></div>
    </div>

    <div class="fd-footer">
      <button id="btn-fd-summarize" class="btn-footer" type="button" style="background: rgba(139, 92, 246, 0.25); border-color: rgba(167, 139, 250, 0.5); color: #e9d5ff;">Tóm Tắt File (AI)</button>
      <button id="btn-fd-copy" class="btn-footer" type="button">Copy Báo Cáo</button>
      <button id="btn-fd-close-footer" class="btn-footer" type="button">Đóng</button>
    </div>
  </div>

  <div id="companion-dock" class="glass-panel">
    <button id="dock-btn-left" class="dock-btn" type="button" title="Bật/Tắt Dashboard Trái">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
    </button>
    <button id="dock-btn-chat" class="dock-btn" type="button" title="Mở rộng / Thu gọn Lịch sử Chat">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
    <button id="dock-btn-right" class="dock-btn active" type="button" title="Bật/Tắt Bảng Hành động Phải">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    </button>
    <button id="dock-btn-pc-control" class="dock-btn" type="button" title="Điều Khiển Máy Tính, Google &amp; OCR Cắt Vùng">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
    </button>
    <button id="dock-btn-studio" class="dock-btn" type="button" title="Cấu Hình Hệ Thống &amp; Studio 3D">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
    <button id="dock-btn-p2p" class="dock-btn" type="button" title="Đấu Trường P2P PK &amp; Điều Khiển Chéo (Cross-PC)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline>
        <line x1="13" y1="19" x2="19" y2="13"></line>
        <line x1="16" y1="16" x2="20" y2="20"></line>
        <line x1="19" y1="21" x2="21" y2="19"></line>
        <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"></polyline>
        <line x1="5" y1="14" x2="9" y2="18"></line>
        <line x1="7" y1="17" x2="4" y2="20"></line>
        <line x1="3" y1="19" x2="5" y2="21"></line>
      </svg>
    </button>
    <button id="dock-btn-edge-peek" class="dock-btn" type="button" title="Nép Mép Màn Hình (Alt+W)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <line x1="15" y1="3" x2="15" y2="21"></line>
        <polyline points="9 9 12 12 9 15"></polyline>
      </svg>
    </button>
  </div>
`;

