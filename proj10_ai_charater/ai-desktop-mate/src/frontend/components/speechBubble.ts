export const speechBubbleHtml = `
  <div id="speech-bubble" class="glass-panel">
    <div class="bubble-header">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="badge">[AI Mate]</span>
        <span id="llm-badge" class="badge">[LLM: ...]</span>
      </div>
      <button id="btn-minimize-bubble" class="icon-btn-tiny" type="button" title="Ẩn bong bóng chat">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>

    <div id="bubble-content" class="bubble-text">
      Xin chào! Hãy click vào Chrome hoặc ứng dụng bất kỳ, tớ sẽ tự nhận diện để đẩy, kéo hoặc nhảy lên nhé!
    </div>

    <div id="suggestion-actions" style="display: none; gap: 6px; margin-bottom: 8px;">
      <button id="btn-sug-accept" class="btn-footer" type="button" style="background: rgba(52, 211, 153, 0.2); border-color: rgba(52, 211, 153, 0.45); color: #6ee7b7;">Đồng ý</button>
      <button id="btn-sug-dismiss" class="btn-footer" type="button" style="background: rgba(148, 163, 184, 0.14); border-color: rgba(148, 163, 184, 0.3); color: #cbd5e1;">Để sau</button>
    </div>

    <div class="bubble-input-row">
      <input id="bubble-input" class="bubble-input" type="text" placeholder="Nhắn tin với qwen2.5:1.5b..." />
      <button id="btn-send-msg" class="bubble-btn-send" type="button" title="Gửi tin nhắn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  </div>

  <div id="companion-dock" class="glass-panel">
    <button id="dock-btn-left" class="dock-btn" type="button" title="Bật/Tắt Dashboard Trái">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
      </svg>
    </button>
    <button id="dock-btn-chat" class="dock-btn active" type="button" title="Bật/Tắt Bong bóng chat">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
    <button id="dock-btn-right" class="dock-btn active" type="button" title="Bật/Tắt Bảng Hành động Phải">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    </button>
    <button id="dock-btn-studio" class="dock-btn" type="button" title="Mở Studio 3D & Vật lý">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
    <button id="dock-btn-mini" class="dock-btn" type="button" title="Chế độ Thu gọn (Ẩn hết bảng)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    </button>
  </div>
`;

