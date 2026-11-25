export const englishCoachModalHtml = `
  <div id="english-coach-modal" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title" style="flex-wrap: wrap;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
        <span>Duck English Coach Studio</span>
        <span id="eng-coach-source-badge" class="badge" style="background: rgba(56, 189, 248, 0.16); color: #7dd3fc; border-color: rgba(56, 189, 248, 0.42); font-size: 9.5px;">[MONGO + OFFLINE DECK]</span>
      </div>
      <button id="btn-close-english-coach" class="icon-btn-tiny" type="button" title="Đóng Học Tiếng Anh (Esc)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="eng-coach-kpi-strip">
      <span id="eng-coach-mongo-badge" class="badge eng-kpi-pill">Kho Cloud: --</span>
      <span id="eng-coach-streak-badge" class="badge eng-kpi-pill">Chuỗi: 0 ngày</span>
      <span id="eng-coach-daily-badge" class="badge eng-kpi-pill">Hôm nay: 0/10 từ</span>
      <span id="eng-coach-due-badge" class="badge eng-kpi-pill">Cần ôn SRS: 0</span>
    </div>

    <div class="studio-tabs-bar" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 10px;">
      <button id="tab-btn-eng-learn" class="studio-tab-btn active" data-eng-tab="learn" type="button">Flashcard &amp; Tra Từ</button>
      <button id="tab-btn-eng-srs" class="studio-tab-btn" data-eng-tab="srs" type="button">
        <span>Sổ Từ SRS</span>
        <span id="eng-srs-count-badge" class="badge" style="margin-left: 4px; font-size: 9px; padding: 1px 5px;">0</span>
      </button>
      <button id="tab-btn-eng-quiz" class="studio-tab-btn" data-eng-tab="quiz" type="button">Quiz 3 Chế Độ</button>
      <button id="tab-btn-eng-speak" class="studio-tab-btn" data-eng-tab="speak" type="button">Luyện Nói &amp; AI</button>
    </div>

    <!-- TAB 1: FLASHCARD 3D & TRA TỪ MONGODB -->
    <div id="eng-pane-learn" class="eng-coach-pane">
      <div class="eng-filter-bar">
        <input id="eng-search-input" class="dash-input" type="text" placeholder="Tra từ tiếng Anh hoặc nghĩa tiếng Việt (MongoDB + Online)..." style="flex: 1; min-width: 170px;" />
        <button id="btn-eng-search-go" class="btn-mini-action" type="button">Tra Từ</button>
        <select id="eng-coach-topic-select" class="dash-select" title="Chủ đề từ vựng">
          <option value="random">Ngẫu nhiên</option>
          <option value="ielts">IELTS Academic</option>
          <option value="technology">Technology &amp; AI</option>
          <option value="business">Business &amp; Work</option>
          <option value="daily">Daily Life</option>
        </select>
        <select id="eng-coach-level-select" class="dash-select" title="Cấp độ CEFR">
          <option value="">Mọi cấp</option>
          <option value="A2">A2</option>
          <option value="B1">B1</option>
          <option value="B2">B2</option>
          <option value="C1">C1</option>
          <option value="C2">C2</option>
        </select>
        <button id="btn-eng-random-card" class="btn-mini-action eng-btn-accent" type="button">Thẻ Mới</button>
      </div>

      <div id="eng-search-results" class="eng-search-results" style="display: none;"></div>

      <div id="eng-flashcard-stage" class="eng-flashcard-stage">
        <div id="eng-flashcard-inner" class="eng-flashcard-inner">
          <div class="eng-card-face eng-card-front">
            <div class="eng-card-top-row">
              <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                <span id="eng-fc-level" class="badge eng-lvl-badge">B2</span>
                <span id="eng-fc-topic" class="badge">ielts</span>
                <span id="eng-fc-pos" class="badge">noun</span>
              </div>
              <button id="btn-eng-fc-star" class="icon-btn-tiny" type="button" title="Đánh dấu Yêu thích">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </button>
            </div>
            <div class="eng-fc-word-wrap">
              <div id="eng-fc-word" class="eng-fc-word">resilient</div>
              <div id="eng-fc-ipa" class="eng-fc-ipa">/rɪˈzɪl.i.ənt/</div>
            </div>
            <div class="eng-fc-audio-row">
              <button id="btn-eng-fc-speak" class="btn-mini-action eng-btn-accent" type="button">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <span>Đọc Chuẩn</span>
              </button>
              <button id="btn-eng-fc-slow" class="btn-mini-action" type="button">Đọc Chậm 0.7x</button>
            </div>
            <div class="eng-fc-hint">Nhấn vào thẻ để lật xem nghĩa tiếng Việt, câu ví dụ &amp; AI Collocations</div>
          </div>

          <div class="eng-card-face eng-card-back">
            <div class="eng-card-back-head">
              <strong id="eng-fc-back-title" style="color: #e2e8f0; font-size: 13px;">resilient</strong>
              <span id="eng-fc-vi" class="eng-fc-vi">kiên cường, phục hồi nhanh</span>
            </div>
            <div id="eng-fc-en" class="eng-fc-en">Able to recover quickly from difficulties or adapt well to change.</div>
            <div id="eng-fc-synonyms" class="eng-fc-synonyms" style="display: none;"></div>
            <div class="eng-fc-example-box">
              <div style="display: flex; justify-content: space-between; gap: 6px; align-items: flex-start;">
                <div id="eng-fc-example" class="eng-fc-example"></div>
                <button id="btn-eng-fc-speak-ex" class="btn-mini-action" type="button" style="flex-shrink: 0;">Đọc Ví Dụ</button>
              </div>
              <div id="eng-fc-example-vi" class="eng-fc-example-vi"></div>
            </div>
            <div id="eng-fc-collocation-box" class="eng-fc-collocation-box">
              Chưa gọi AI Collocations cho từ này. Nhấn "Hỏi AI Collocations" bên dưới để phân tích sắc thái + cụm từ hay đi kèm.
            </div>
          </div>
        </div>
      </div>

      <div class="eng-action-row">
        <button id="btn-eng-fc-flip" class="btn-mini-action" type="button">Lật Thẻ</button>
        <button id="btn-eng-fc-save" class="btn-mini-action eng-btn-green" type="button">Lưu Vào Sổ SRS</button>
        <button id="btn-eng-fc-translate" class="btn-mini-action" type="button">Dịch AI Sâu</button>
        <button id="btn-eng-fc-ai-colloc" class="btn-mini-action" type="button">Hỏi AI Collocations</button>
      </div>

      <div class="eng-srs-grade-strip">
        <span class="eng-grade-label">Chấm mức độ nhớ SM-2:</span>
        <button class="eng-grade-btn eng-q1" data-srs-q="1" type="button">Quên (1)</button>
        <button class="eng-grade-btn eng-q3" data-srs-q="3" type="button">Khó (3)</button>
        <button class="eng-grade-btn eng-q4" data-srs-q="4" type="button">Nhớ Tốt (4)</button>
        <button class="eng-grade-btn eng-q5" data-srs-q="5" type="button">Quá Dễ (5)</button>
      </div>
    </div>

    <!-- TAB 2: SỔ TỪ & ÔN TẬP SRS SM-2 -->
    <div id="eng-pane-srs" class="eng-coach-pane" style="display: none;">
      <div class="eng-srs-toolbar">
        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
          <button id="eng-srs-filter-due" class="btn-mini-action active" data-srs-filter="due" type="button">Tới Hạn Ôn</button>
          <button id="eng-srs-filter-star" class="btn-mini-action" data-srs-filter="starred" type="button">Yêu Thích</button>
          <button id="eng-srs-filter-all" class="btn-mini-action" data-srs-filter="all" type="button">Tất Cả Sổ</button>
        </div>
        <button id="btn-eng-srs-start-session" class="btn-mini-action eng-btn-accent" type="button">Ôn Từ Tới Hạn</button>
      </div>
      <div id="eng-srs-list" class="dash-scroll-list eng-srs-list"></div>
    </div>

    <!-- TAB 3: QUIZ 3 CHẾ ĐỘ -->
    <div id="eng-pane-quiz" class="eng-coach-pane" style="display: none;">
      <div class="eng-quiz-top">
        <div class="eng-quiz-modes">
          <button id="btn-quiz-mode-mc" class="btn-mini-action active" data-quiz-mode="mc" type="button">4 Đáp Án Nghĩa</button>
          <button id="btn-quiz-mode-cloze" class="btn-mini-action" data-quiz-mode="cloze" type="button">Điền Khuyết Câu</button>
          <button id="btn-quiz-mode-dictation" class="btn-mini-action" data-quiz-mode="dictation" type="button">Nghe Chép Chính Tả</button>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span id="eng-quiz-score-label" class="badge">Điểm: 0/0 | Chuỗi: 0</span>
          <button id="btn-quiz-next" class="btn-mini-action eng-btn-accent" type="button">Câu Tiếp</button>
        </div>
      </div>

      <div id="eng-quiz-stage" class="eng-quiz-stage">
        <div class="eng-quiz-prompt-row">
          <div id="eng-quiz-prompt" class="eng-quiz-prompt">Nhấn "Câu Tiếp" để bắt đầu kiểm tra từ vựng.</div>
          <button id="btn-quiz-play-audio" class="btn-mini-action eng-btn-accent" type="button" style="flex-shrink: 0;">Nghe Phát Âm</button>
        </div>
        <div id="eng-quiz-subhint" class="eng-quiz-subhint"></div>
        <div id="eng-quiz-options" class="eng-quiz-options"></div>
        <div id="eng-quiz-input-wrap" class="eng-quiz-input-wrap" style="display: none;">
          <input id="eng-quiz-text-input" class="dash-input" type="text" placeholder="Gõ đáp án tiếng Anh rồi nhấn Enter..." style="flex: 1;" />
          <button id="btn-quiz-submit-text" class="studio-btn-primary" type="button" style="width: auto; padding: 6px 14px;">Kiểm Tra</button>
        </div>
        <div id="eng-quiz-feedback" class="eng-quiz-feedback" style="display: none;"></div>
      </div>
    </div>

    <!-- TAB 4: LUYỆN NÓI MIC EN-US & AI ROLEPLAY -->
    <div id="eng-pane-speak" class="eng-coach-pane" style="display: none;">
      <div class="eng-speak-target-card">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 5px;">
          <span class="badge" style="color: #7dd3fc;">Shadowing Luyện Phát Âm</span>
          <div style="display: flex; gap: 5px;">
            <button id="btn-speak-listen-sample" class="btn-mini-action eng-btn-accent" type="button">Nghe Mẫu</button>
            <button id="btn-speak-use-example" class="btn-mini-action" type="button">Đổi Từ / Câu</button>
          </div>
        </div>
        <div id="eng-speak-target-text" class="eng-speak-target-text">Resilience helps engineers overcome complex production incidents.</div>
        <div id="eng-speak-target-ipa" class="eng-speak-target-ipa"></div>
      </div>

      <div class="eng-mic-controls">
        <button id="btn-speak-mic-toggle" class="studio-btn-primary" type="button" style="width: auto; padding: 6px 14px;">Bật Mic Nói (en-US)</button>
        <span id="eng-speak-mic-status" class="badge">Mic sẵn sàng</span>
        <button id="btn-speak-score-now" class="btn-mini-action eng-btn-green" type="button">Chấm Điểm</button>
      </div>

      <textarea id="eng-speak-transcript" class="eng-speak-transcript" rows="2" placeholder="Lời nói nhận diện từ Mic (en-US) sẽ hiện ở đây — bạn cũng có thể gõ thử để chấm khớp từng từ..."></textarea>
      <div id="eng-speak-score-box" class="eng-speak-score-box">Nhấn "Bật Mic Nói (en-US)" rồi đọc to câu mẫu trên để Vịt nhép mỏ, nghe và chấm tỷ lệ khớp phát âm từng từ.</div>

      <div class="eng-roleplay-box">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 700; color: #e2e8f0;">Hội Thoại AI English Coach</span>
          <div style="display: flex; gap: 5px; align-items: center;">
            <select id="eng-roleplay-scenario" class="dash-select">
              <option value="Daily Conversation">Daily Conversation</option>
              <option value="IELTS Speaking Part 2 & 3">IELTS Speaking</option>
              <option value="Software Tech Interview">Tech Interview</option>
              <option value="Business Client Meeting">Business Meeting</option>
            </select>
            <button id="btn-roleplay-new-prompt" class="btn-mini-action eng-btn-accent" type="button">AI Mở Lời</button>
          </div>
        </div>
        <div id="eng-roleplay-history" class="dash-scroll-list eng-roleplay-history"></div>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <input id="eng-roleplay-input" class="dash-input" type="text" placeholder="Reply in English (Vịt sẽ sửa ngữ pháp nhẹ nhàng & gợi ý cách nói tự nhiên)..." style="flex: 1;" />
          <button id="btn-roleplay-send" class="studio-btn-primary" type="button" style="width: auto; padding: 6px 14px;">Gửi</button>
        </div>
      </div>
    </div>
  </div>
`;
