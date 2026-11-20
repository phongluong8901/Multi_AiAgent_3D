export const tarotModalHtml = `
  <div id="tarot-modal" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title" style="flex-wrap: wrap;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2.5"></rect>
          <polygon points="12 7 13.4 10.6 17 12 13.4 13.4 12 17 10.6 13.4 7 12 10.6 10.6 12 7"></polygon>
        </svg>
        <span>Tarot &amp; Tử Vi Vận Mệnh</span>
        <span class="badge" style="background: rgba(168, 85, 247, 0.22); color: #e9d5ff; border-color: rgba(192, 132, 252, 0.45); font-size: 9.5px;">[MỖI 6 GIỜ]</span>
      </div>
      <button id="btn-close-tarot" class="icon-btn-tiny" type="button" title="Đóng Bảng Tarot (Esc)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="studio-tabs-bar" style="grid-template-columns: 1fr 1fr; margin-bottom: 9px;">
      <button id="tab-btn-tarot-today" class="studio-tab-btn active" type="button">Bốc Quẻ Hôm Nay</button>
      <button id="tab-btn-tarot-history" class="studio-tab-btn" type="button">
        <span>Lịch Sử Quẻ</span>
        <span id="tarot-history-count" class="badge" style="margin-left: 4px; font-size: 9px; padding: 1px 6px;">0</span>
      </button>
    </div>

    <div class="tarot-meta-strip">
      <span id="tarot-cooldown-badge" class="badge tarot-cd-ready">Sẵn sàng bốc quẻ mới</span>
      <span id="tarot-canchi-badge" class="badge">Can Chi: --</span>
      <span id="tarot-source-badge" class="badge">API: tarotapi.dev</span>
    </div>

    <!-- PANE 1: BỐC & LẬT THẺ TAROT -->
    <div id="tarot-pane-today">
      <!-- BỘ 3 LÁ ÚP ĐỂ CHỌN (hiện khi đủ 6 giờ) -->
      <div id="tarot-spread-picker" class="tarot-spread-box">
        <div class="tarot-spread-sub">Chọn 1 trong 3 lá bài hoặc nhấn Bốc Ngay để Vịt làm phép lật thẻ 3D định vận 6 giờ tới:</div>
        <div class="tarot-pick-row">
          <button class="tarot-pick-card" type="button" data-slot="0" title="Chọn lá bài Quẻ Trái">
            <svg width="36" height="52" viewBox="0 0 48 68" fill="none">
              <rect x="2" y="2" width="44" height="64" rx="5" fill="#1e1b4b" stroke="#fbbf24" stroke-width="2"/>
              <circle cx="24" cy="34" r="11" stroke="#fde68a" stroke-width="1.5"/>
              <polygon points="24,18 27,30 39,34 27,38 24,50 21,38 9,34 21,30" fill="rgba(251,191,36,0.35)" stroke="#fbbf24" stroke-width="1.2"/>
            </svg>
            <span>Lá I</span>
          </button>
          <button class="tarot-pick-card" type="button" data-slot="1" title="Chọn lá bài Quẻ Giữa">
            <svg width="36" height="52" viewBox="0 0 48 68" fill="none">
              <rect x="2" y="2" width="44" height="64" rx="5" fill="#1e1b4b" stroke="#fbbf24" stroke-width="2"/>
              <circle cx="24" cy="34" r="11" stroke="#fde68a" stroke-width="1.5"/>
              <polygon points="24,18 27,30 39,34 27,38 24,50 21,38 9,34 21,30" fill="rgba(251,191,36,0.35)" stroke="#fbbf24" stroke-width="1.2"/>
            </svg>
            <span>Lá II</span>
          </button>
          <button class="tarot-pick-card" type="button" data-slot="2" title="Chọn lá bài Quẻ Phải">
            <svg width="36" height="52" viewBox="0 0 48 68" fill="none">
              <rect x="2" y="2" width="44" height="64" rx="5" fill="#1e1b4b" stroke="#fbbf24" stroke-width="2"/>
              <circle cx="24" cy="34" r="11" stroke="#fde68a" stroke-width="1.5"/>
              <polygon points="24,18 27,30 39,34 27,38 24,50 21,38 9,34 21,30" fill="rgba(251,191,36,0.35)" stroke="#fbbf24" stroke-width="1.2"/>
            </svg>
            <span>Lá III</span>
          </button>
        </div>
        <button id="btn-tarot-draw-now" class="studio-btn-primary" type="button" style="width: 100%; background: linear-gradient(135deg, #7c3aed, #2563eb);">
          Bốc &amp; Lật Quẻ Tarot Ngay
        </button>
      </div>

      <!-- SÂN KHẤU LẬT THẺ 3D & KẾT QUẢ -->
      <div id="tarot-reveal-stage" class="tarot-reveal-layout" style="display: none;">
        <div class="tarot-card-scene">
          <div id="tarot-card-inner" class="tarot-card-inner">
            <div class="tarot-card-face tarot-card-back">
              <svg width="64" height="86" viewBox="0 0 64 86" fill="none">
                <rect x="3" y="3" width="58" height="80" rx="7" stroke="#fbbf24" stroke-width="2"/>
                <circle cx="32" cy="43" r="16" stroke="#fde68a" stroke-width="1.8"/>
                <polygon points="32,20 36,38 52,43 36,48 32,66 28,48 12,43 28,38" fill="rgba(251,191,36,0.3)" stroke="#fbbf24" stroke-width="1.4"/>
              </svg>
              <div class="tarot-back-caption">DUCK ARCANA</div>
            </div>
            <div id="tarot-card-front" class="tarot-card-face tarot-card-front tarot-tier-binh_hoa">
              <div id="tarot-card-verdict-pill" class="tarot-verdict-pill">BÌNH HÒA</div>
              <svg id="tarot-card-emblem" width="54" height="54" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="24" stroke="currentColor" stroke-width="2.4"/>
                <polygon points="32,12 37,27 52,32 37,37 32,52 27,37 12,32 27,27" fill="rgba(255,255,255,0.16)" stroke="currentColor" stroke-width="1.8"/>
              </svg>
              <div id="tarot-card-name-vi" class="tarot-card-title-vi">Mặt Trời Rực Rỡ</div>
              <div id="tarot-card-name-en" class="tarot-card-title-en">The Sun</div>
              <div id="tarot-card-orient-tag" class="tarot-orient-tag">THUẬN CHIỀU</div>
            </div>
          </div>
        </div>

        <div id="tarot-result-details" class="tarot-details-col">
          <div class="tarot-fortune-header">
            <span id="tarot-fortune-badge" class="badge tarot-tier-badge">BÌNH HÒA</span>
            <span id="tarot-luck-score" class="tarot-luck-num">75/100</span>
          </div>
          <div class="tarot-luck-bar">
            <div id="tarot-luck-fill" class="tarot-luck-fill" style="width: 75%;"></div>
          </div>

          <div id="tarot-lucky-strip" class="tarot-lucky-strip">
            Màu: -- | Số may: --
          </div>

          <div id="tarot-summary-vi" class="tarot-summary-box"></div>

          <div class="tarot-advice-grid">
            <div class="tarot-advice-card">
              <div class="tarot-adv-lbl">Công Việc</div>
              <div id="tarot-adv-work" class="tarot-adv-txt">--</div>
            </div>
            <div class="tarot-advice-card">
              <div class="tarot-adv-lbl">Tài Lộc</div>
              <div id="tarot-adv-wealth" class="tarot-adv-txt">--</div>
            </div>
            <div class="tarot-advice-card">
              <div class="tarot-adv-lbl">Tình Cảm</div>
              <div id="tarot-adv-love" class="tarot-adv-txt">--</div>
            </div>
            <div class="tarot-advice-card">
              <div class="tarot-adv-lbl">Hóa Giải / Hợp Mệnh</div>
              <div id="tarot-adv-remedy" class="tarot-adv-txt">--</div>
            </div>
          </div>

          <div id="tarot-ai-box" class="tarot-ai-box" style="display: none;"></div>

          <div class="tarot-actions-row">
            <button id="btn-tarot-ai-deep" class="studio-btn-primary" type="button" style="flex: 1; background: linear-gradient(135deg, #6d28d9, #0ea5e9);">
              Luận Giải Sâu AI (Tử Vi x Tarot)
            </button>
            <button id="btn-tarot-replay-3d" class="action-btn" type="button">
              Vịt Lật Thẻ 3D Lại
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- PANE 2: LỊCH SỬ CÁC LẦN BỐC -->
    <div id="tarot-pane-history" style="display: none;">
      <div id="tarot-history-list" class="tarot-history-list">
        <div class="dash-sub">Chưa có quẻ Tarot nào được lưu.</div>
      </div>
    </div>
  </div>
`;
