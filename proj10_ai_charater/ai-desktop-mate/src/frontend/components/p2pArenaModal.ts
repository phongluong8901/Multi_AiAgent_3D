export const p2pArenaModalHtml = `
  <!-- BAN DO CUA SO HOST CHO MAY KHACH (CHI HIEN TRONG P2P) -->
  <div id="p2p-host-map-overlay" style="display: none;"></div>

  <!-- TAM NGAM CHUOT KHI BAN TRONG P2P PK -->
  <div id="p2p-aim-crosshair" style="display: none;">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="2">
      <circle cx="12" cy="12" r="7"></circle>
      <line x1="12" y1="2" x2="12" y2="6"></line>
      <line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="2" y1="12" x2="6" y2="12"></line>
      <line x1="18" y1="12" x2="22" y2="12"></line>
    </svg>
  </div>

  <!-- BO DIEU KHIEN NOI CHO CHE DO P2P (CHI HIEN KHI DANG TRONG P2P) -->
  <div id="p2p-pk-controller" class="glass-panel" style="display: none;">
    <div class="p2p-ctrl-vitals-bar">
      <div class="p2p-ctrl-en-box">
        <span id="p2p-ctrl-en-text" class="p2p-ctrl-en-label">EN 100/100</span>
        <div class="p2p-ctrl-en-track"><div id="p2p-ctrl-en-fill" class="p2p-ctrl-en-fill" style="width: 100%;"></div></div>
      </div>
      <span id="p2p-ctrl-peer-stat" class="p2p-ctrl-peer-label">Doi thu: 100 HP</span>
      <button id="btn-p2p-expand-modal" class="p2p-ctrl-btn" type="button" style="height: 22px; padding: 0 7px; font-size: 10px;" title="Mo rong / Thu gon bang P2P Arena">Bang P2P</button>
    </div>
    <div class="p2p-ctrl-row">
      <button id="btn-p2p-ctrl-left" class="p2p-ctrl-btn" type="button" title="Di chuyen Trai (A / Mui ten Trai)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <button id="btn-p2p-ctrl-jump" class="p2p-ctrl-btn" type="button" title="Nhay len (W / Space / Mui ten Len)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>
      </button>
      <button id="btn-p2p-ctrl-right" class="p2p-ctrl-btn" type="button" title="Di chuyen Phai (D / Mui ten Phai)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
      <button id="btn-p2p-ctrl-rocket" class="p2p-ctrl-btn rocket" type="button" title="Ten lua bay len cua so (Shift + Mui ten Len)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path></svg>
        <span>Ten Lua</span>
      </button>
      <button id="btn-p2p-ctrl-slide" class="p2p-ctrl-btn" type="button" title="Truot nhanh ne don (Shift + Trai/Phai)">Truot</button>
      <button id="btn-p2p-ctrl-shield" class="p2p-ctrl-btn shield" type="button" title="Dung khien chan dan (Giu Ctrl)">Khien (Ctrl)</button>
      <button id="btn-p2p-ctrl-bh" class="p2p-ctrl-btn bh" type="button" title="Ho den an vao cua so (Phim B)">Ho Den (B)</button>
      <span class="p2p-ctrl-divider"></span>
      <button id="btn-p2p-ctrl-sword" class="p2p-ctrl-btn atk" type="button" title="Chem Kiem Cyber 24 DMG (Phim 1)">Kiem [1]</button>
      <button id="btn-p2p-ctrl-shoot" class="p2p-ctrl-btn shoot" type="button" title="Ban theo huong chuot 10 DMG (Click / Phim 2)">Ban [2]</button>
      <button id="btn-p2p-ctrl-thunder" class="p2p-ctrl-btn thunder" type="button" title="Goi Sam Set 26 DMG (Phim 3)">Set [3]</button>
    </div>
    <div class="p2p-ctrl-hint">Ban (-14 EN) | Shift+Len Ten Lua &amp; Shift+Trai/Phai Truot ton EN | Nhat Do An tren san/cua so (+40 EN) | Ctrl: Khien | B: Ho Den</div>
  </div>

  <!-- FLOATING P2P HP & ENERGY TAGS TRÊN ĐẦU HAI VỊT -->
  <div id="p2p-floating-hud" style="display: none;">
    <div id="p2p-hud-my-tag" class="p2p-float-tag">
      <div class="p2p-float-name">Bạn (100 HP)</div>
      <div class="p2p-float-track"><div id="p2p-hud-my-hp" class="p2p-float-fill hero" style="width: 100%;"></div></div>
      <div class="p2p-float-track energy"><div id="p2p-hud-my-en" class="p2p-float-fill energy" style="width: 100%;"></div></div>
    </div>
    <div id="p2p-hud-peer-tag" class="p2p-float-tag">
      <div class="p2p-float-name">Đối thủ (100 HP)</div>
      <div class="p2p-float-track"><div id="p2p-hud-peer-hp" class="p2p-float-fill peer" style="width: 100%;"></div></div>
      <div class="p2p-float-track energy"><div id="p2p-hud-peer-en" class="p2p-float-fill energy" style="width: 100%;"></div></div>
    </div>
  </div>

  <!-- PILL GỌI VỊT VỀ KHI ĐANG NHẢY SANG MÁY ĐỐI THỦ -->
  <div id="p2p-return-pill" class="glass-panel" style="display: none;">
    <span class="badge" style="background: rgba(56, 189, 248, 0.22); color: #7dd3fc; border-color: rgba(56, 189, 248, 0.45);">[CROSS-PC]</span>
    <span>Vịt của bạn đang tung tăng bên màn hình máy đối thủ!</span>
    <button id="btn-p2p-return-pill" class="studio-btn-primary" type="button" style="padding: 4px 10px; font-size: 11px;">Gọi Vịt Về</button>
  </div>

  <!-- BANNER CẢNH BÁO 60S KHI THUA TRẬN + NÚT THOÁT KHẨN CẤP -->
  <div id="p2p-victim-banner" class="glass-panel" style="display: none;">
    <span class="badge" style="background: rgba(239, 68, 68, 0.28); color: #fca5a5; border-color: rgba(248, 113, 113, 0.55);">[BỊ KIỂM SOÁT]</span>
    <span>Máy thắng đang điều khiển chuột/phím: <b id="p2p-victim-countdown" style="color: #fef08a;">60s</b></span>
    <button id="btn-p2p-emergency-release" class="action-btn" type="button" style="padding: 4px 10px; font-size: 11px; background: rgba(239, 68, 68, 0.28); border-color: rgba(248, 113, 113, 0.65); color: #fecaca;">Thoát Khẩn Cấp (Alt+Q)</button>
  </div>

  <!-- MODAL ĐẤU TRƯỜNG P2P PK & ĐIỀU KHIỂN CHÉO -->
  <div id="p2p-arena-panel" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title" style="flex-wrap: wrap;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline>
          <line x1="13" y1="19" x2="19" y2="13"></line>
          <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"></polyline>
          <line x1="5" y1="14" x2="9" y2="18"></line>
        </svg>
        <span>Đấu Trường P2P PK &amp; Cross-PC</span>
        <span id="p2p-phase-badge" class="badge" style="background: rgba(56, 189, 248, 0.16); color: #7dd3fc; border-color: rgba(56, 189, 248, 0.35); font-size: 9.5px;">[HOSTING]</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <button id="btn-minimize-p2p" class="icon-btn-tiny" type="button" title="Thu gon bang P2P Arena">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button id="btn-close-p2p" class="icon-btn-tiny" type="button" title="Đóng bảng P2P Arena">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- HỘP XÁC NHẬN HANDSHAKE ĐẾN -->
    <div id="p2p-consent-box" class="studio-section" style="display: none; border-color: rgba(250, 204, 21, 0.55); background: rgba(120, 53, 15, 0.25);">
      <div class="studio-section-title" style="color: #fde047;">[HANDSHAKE] Yêu cầu Kết nối &amp; PK mới</div>
      <div id="p2p-consent-text" style="font-size: 11px; color: #f8fafc; line-height: 1.4; margin-bottom: 8px;">
        Đối thủ muốn kết nối vào phòng PK...
      </div>
      <div style="display: flex; gap: 6px;">
        <button id="btn-p2p-consent-accept" class="studio-btn-primary" type="button" style="flex: 1; background: rgba(16, 185, 129, 0.32); border-color: rgba(52, 211, 153, 0.65); color: #a7f3d0;">Đồng Ý Cho Phép Kết Nối</button>
        <button id="btn-p2p-consent-reject" class="action-btn" type="button" style="background: rgba(239, 68, 68, 0.24); border-color: rgba(248, 113, 113, 0.5); color: #fecaca;">Từ Chối</button>
      </div>
    </div>

    <!-- PHẦN 1: THÔNG TIN PHÒNG & HANDSHAKE 2 MÁY -->
    <div class="studio-section">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
        <span class="studio-section-title" style="margin: 0;">Phòng của bạn &amp; Bảo mật Handshake</span>
        <div style="display: flex; gap: 4px;">
          <button id="btn-p2p-scan-lan" class="action-btn" type="button" style="padding: 2px 7px; font-size: 10px;">Quét LAN</button>
          <button id="btn-p2p-sim-peer" class="action-btn" type="button" style="padding: 2px 7px; font-size: 10px; background: rgba(168, 85, 247, 0.2); border-color: rgba(192, 132, 252, 0.45); color: #e9d5ff;">Giả Lập Máy B (Test)</button>
        </div>
      </div>

      <div style="background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 7px; padding: 7px 9px; margin-bottom: 8px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="color: #94a3b8;">Địa chỉ IP:Port: <code id="p2p-local-endpoint" style="color: #38bdf8; font-weight: 700;">--</code></span>
          <span style="color: #94a3b8;">Mã Phòng: <code id="p2p-room-code" style="color: #fbbf24; font-weight: 800; font-size: 12px;">------</code></span>
        </div>
        <div style="display: flex; gap: 6px; margin-bottom: 6px;">
          <button id="btn-p2p-copy-invite" class="action-btn" type="button" style="flex: 1; padding: 3px 8px; font-size: 10px;">Copy Mã Mời</button>
          <button id="btn-p2p-regen-code" class="action-btn" type="button" style="padding: 3px 8px; font-size: 10px;">Đổi Mã Mới</button>
        </div>
        <div style="border-top: 1px solid rgba(148, 163, 184, 0.16); padding-top: 6px; display: flex; flex-direction: column; gap: 5px;">
          <div style="color: #94a3b8; font-size: 10px; line-height: 1.35; word-break: break-all;">
            Link Mobile (Wi-Fi/LAN): <code id="p2p-mobile-url" style="color: #34d399; font-weight: 700; user-select: all;">--</code>
          </div>
          <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            <button id="btn-p2p-copy-mobile-url" class="action-btn" type="button" style="flex: 1; padding: 3px 7px; font-size: 10px; border-color: rgba(52, 211, 153, 0.45); color: #6ee7b7;">Copy Link Mobile</button>
            <button id="btn-p2p-test-local-web" class="action-btn" type="button" style="padding: 3px 7px; font-size: 10px; border-color: rgba(56, 189, 248, 0.45); color: #bae6fd;">Test Web PC</button>
            <button id="btn-p2p-open-firewall" class="action-btn" type="button" style="padding: 3px 7px; font-size: 10px; border-color: rgba(250, 204, 21, 0.5); color: #fde68a;">Mở Firewall LAN</button>
          </div>
          <div id="p2p-alt-lan-urls" style="display: none; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 9.5px; color: #94a3b8;"></div>
          <div style="font-size: 9.5px; color: #94a3b8; line-height: 1.3;">
            Điện thoại cùng Wi-Fi mở đúng link http://... trên trình duyệt (không dùng https://). Nếu điện thoại không vào được, bấm "Mở Firewall LAN".
          </div>
        </div>
      </div>

      <div id="p2p-lan-list" style="display: none; flex-direction: column; gap: 4px; margin-bottom: 8px;"></div>

      <div style="display: grid; grid-template-columns: 1.4fr 0.9fr; gap: 6px; margin-bottom: 6px;">
        <input id="p2p-target-addr" class="studio-input" type="text" placeholder="IP:Port máy kia (vd: 192.168.1.15:39282)" />
        <input id="p2p-target-code" class="studio-input" type="text" placeholder="Mã phòng (6 số)" />
      </div>
      <div style="display: flex; gap: 6px;">
        <button id="btn-p2p-connect" class="studio-btn-primary" type="button" style="flex: 1;">Gửi Yêu Cầu Handshake</button>
        <button id="btn-p2p-disconnect" class="action-btn" type="button" style="display: none; background: rgba(239, 68, 68, 0.22); border-color: rgba(248, 113, 113, 0.45); color: #fca5a5;">Ngắt Kết Nối</button>
      </div>
    </div>

    <!-- PHẦN 2: CROSS-SCREEN MIGRATION & ĐẤU TRƯỜNG PK -->
    <div id="p2p-battle-box" class="studio-section" style="display: none;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span class="studio-section-title" style="margin: 0;">Nhân Vật Chéo Màn Hình &amp; Đấu PK</span>
        <span id="p2p-peer-label" style="font-size: 10.5px; color: #6ee7b7; font-weight: 700;">--</span>
      </div>

      <div class="p2p-hp-grid">
        <div class="p2p-hp-card">
          <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 3px;">
            <span style="color: #7dd3fc; font-weight: 700;">Vịt Của Bạn</span>
            <span id="p2p-my-hp-text" style="color: #f8fafc;">100 / 100</span>
          </div>
          <div class="mood-bar"><div id="p2p-my-hp-fill" class="mood-bar-fill" style="width: 100%; background: linear-gradient(90deg, #06b6d4, #34d399);"></div></div>
          <div style="display: flex; justify-content: space-between; font-size: 9.5px; margin-top: 5px; margin-bottom: 2px;">
            <span style="color: #fde047; font-weight: 700;">Năng Lượng</span>
            <span id="p2p-my-en-text" style="color: #fef08a;">100 / 100</span>
          </div>
          <div class="mood-bar" style="height: 5px;"><div id="p2p-my-en-fill" class="mood-bar-fill" style="width: 100%; background: linear-gradient(90deg, #f59e0b, #fde047);"></div></div>
        </div>
        <div class="p2p-hp-card">
          <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 3px;">
            <span style="color: #fda4af; font-weight: 700;">Vịt Đối Thủ</span>
            <span id="p2p-peer-hp-text" style="color: #f8fafc;">100 / 100</span>
          </div>
          <div class="mood-bar"><div id="p2p-peer-hp-fill" class="mood-bar-fill" style="width: 100%; background: linear-gradient(90deg, #f97316, #ef4444);"></div></div>
          <div style="display: flex; justify-content: space-between; font-size: 9.5px; margin-top: 5px; margin-bottom: 2px;">
            <span style="color: #fde047; font-weight: 700;">Năng Lượng</span>
            <span id="p2p-peer-en-text" style="color: #fef08a;">100 / 100</span>
          </div>
          <div class="mood-bar" style="height: 5px;"><div id="p2p-peer-en-fill" class="mood-bar-fill" style="width: 100%; background: linear-gradient(90deg, #f59e0b, #fde047);"></div></div>
        </div>
      </div>

      <label style="display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: #cbd5e1; margin: 7px 0; cursor: pointer;">
        <input id="p2p-chk-automigrate" type="checkbox" checked />
        <span>Tự động nhảy sang màn hình đối thủ khi vịt đi chạm mép màn hình</span>
      </label>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 8px;">
        <button id="btn-p2p-migrate-out" class="action-btn" type="button" style="background: rgba(14, 165, 233, 0.18); border-color: rgba(56, 189, 248, 0.42); color: #bae6fd;">Nhảy Sang Màn Đối Thủ</button>
        <button id="btn-p2p-recall" class="action-btn" type="button">Gọi Vịt Về</button>
        <button id="btn-p2p-start-pk" class="studio-btn-primary" type="button" style="grid-column: span 2; background: linear-gradient(135deg, #f97316, #ef4444); border: none;">Bắt Đầu PK (Thắng Kiểm Soát 60s)</button>
      </div>

      <div id="p2p-skills-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
        <button id="btn-p2p-skill-sword" class="action-btn" type="button" style="border-color: rgba(56, 189, 248, 0.45); color: #7dd3fc;">Chém Kiếm Cyber (24 DMG)</button>
        <button id="btn-p2p-skill-laser" class="action-btn" type="button" style="border-color: rgba(250, 204, 21, 0.45); color: #fde047;">Bắn Chuột (10 DMG)</button>
        <button id="btn-p2p-skill-thunder" class="action-btn" type="button" style="border-color: rgba(192, 132, 252, 0.45); color: #e9d5ff;">Gọi Sấm Sét (26 DMG)</button>
        <button id="btn-p2p-skill-shield" class="action-btn" type="button" style="border-color: rgba(52, 211, 153, 0.45); color: #6ee7b7;">Khiên Hồi +14 HP</button>
      </div>
    </div>

    <!-- PHẦN 3: BẢNG ĐIỀU KHIỂN MÁY THUA TRONG 60 GIÂY (WINNER CONTROL DECK) -->
    <div id="p2p-remote-control-box" class="studio-section" style="display: none; border-color: rgba(250, 204, 21, 0.55); background: rgba(67, 20, 7, 0.25); margin-bottom: 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span class="studio-section-title" style="margin: 0; color: #fde047;">[WINNER] Điều Khiển Máy Thua (UltraViewer)</span>
        <span id="p2p-winner-countdown" class="badge" style="background: rgba(250, 204, 21, 0.24); color: #fef08a; border-color: rgba(250, 204, 21, 0.65);">60s</span>
      </div>

      <button id="btn-p2p-open-ultraview" class="studio-btn-primary" type="button" style="width: 100%; margin-bottom: 8px; background: linear-gradient(135deg, #0284c7, #2563eb); border: 1px solid rgba(56, 189, 248, 0.55);">
        Mở Màn Hình UltraViewer Live (Tương Tác Trực Tiếp)
      </button>

      <label style="display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: #fde68a; margin-bottom: 6px; cursor: pointer;">
        <input id="p2p-chk-livemouse" type="checkbox" checked />
        <span>Stream con trỏ chuột theo thời gian thực khi rê trên khung dưới</span>
      </label>

      <div id="p2p-remote-touchpad" class="p2p-remote-touchpad" title="Rê chuột để di chuyển con trỏ máy đối thủ; Click Trái/Phải để click từ xa">
        <img id="p2p-touchpad-live-img" class="p2p-touchpad-live-img" alt="Remote Preview" style="display: none;" />
        <div class="p2p-touchpad-hint">Rê hoặc Click vào màn hình thu nhỏ này để điều khiển chuột máy thua</div>
        <div id="p2p-touchpad-cursor" class="p2p-touchpad-cursor"></div>
      </div>

      <div class="url-row" style="margin: 8px 0 6px;">
        <input id="p2p-remote-text" class="studio-input" type="text" placeholder="Nhập chữ muốn gõ sang máy đối thủ..." />
        <button id="btn-p2p-remote-type" class="studio-btn-primary" type="button" style="padding: 4px 10px; font-size: 11px;">Gõ Phím</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
        <button id="btn-p2p-cmd-notepad" class="action-btn" type="button">Mở Notepad Trêu</button>
        <button id="btn-p2p-cmd-jitter" class="action-btn" type="button">Xoay Chuột 4s</button>
        <button id="btn-p2p-cmd-minimize" class="action-btn" type="button">Thu Nhỏ Màn (Win+D)</button>
        <button id="btn-p2p-cmd-block" class="action-btn" type="button" style="background: rgba(239, 68, 68, 0.24); border-color: rgba(248, 113, 113, 0.55); color: #fecaca;">Khóa Phím/Chuột 8s</button>
      </div>
    </div>
  </div>

  <!-- CỬA SỔ ULTRAVIEWER P2P TRỰC TIẾP 60 GIÂY CHO NGƯỜI THẮNG -->
  <div id="p2p-ultraview-modal" class="glass-panel" style="display: none;">
    <div class="p2p-uv-topbar">
      <div class="p2p-uv-title-group">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <span class="p2p-uv-title">UltraViewer P2P Live</span>
        <span id="p2p-uv-peer-name" class="badge" style="background: rgba(56, 189, 248, 0.16); color: #7dd3fc; border-color: rgba(56, 189, 248, 0.4);">Máy Thua</span>
        <span id="p2p-uv-fps-badge" class="badge" style="background: rgba(16, 185, 129, 0.16); color: #6ee7b7; border-color: rgba(52, 211, 153, 0.35);">[CONNECTING...]</span>
        <span id="p2p-uv-countdown" class="badge" style="background: rgba(250, 204, 21, 0.24); color: #fef08a; border-color: rgba(250, 204, 21, 0.65); font-weight: 800;">60s</span>
      </div>
      <div class="p2p-uv-controls-group">
        <label class="p2p-uv-chk"><input id="p2p-uv-chk-mouse" type="checkbox" checked /><span>Chuột Trực Tiếp</span></label>
        <label class="p2p-uv-chk"><input id="p2p-uv-chk-kbd" type="checkbox" checked /><span>Gửi Bàn Phím</span></label>
        <label id="p2p-uv-sim-exec-wrap" class="p2p-uv-chk" style="display: none; color: #fda4af;"><input id="p2p-uv-chk-sim-exec" type="checkbox" /><span>Click Thật (Sim)</span></label>
        <button id="btn-p2p-uv-size" class="action-btn" type="button" style="padding: 3px 8px; font-size: 10.5px;">Phóng To</button>
        <button id="btn-p2p-uv-close" class="action-btn" type="button" style="padding: 3px 8px; font-size: 10.5px; border-color: rgba(248, 113, 113, 0.45); color: #fecaca;">Đóng Viewer</button>
      </div>
    </div>

    <div id="p2p-uv-viewport" class="p2p-uv-viewport" tabindex="0" title="Click vào đây để điều khiển chuột & bàn phím sang máy thua">
      <img id="p2p-uv-screen-img" class="p2p-uv-screen-img" alt="Remote Desktop Live Screen" draggable="false" style="display: none;" />
      <div id="p2p-uv-placeholder" class="p2p-uv-placeholder">Đang kết nối luồng hình ảnh UltraViewer từ màn hình máy đối thủ...</div>
      <div id="p2p-uv-cursor" class="p2p-uv-cursor"></div>
      <div id="p2p-uv-focus-hint" class="p2p-uv-focus-hint">Rê/Click/Kéo/Cuộn chuột &amp; Gõ phím trực tiếp trên màn hình đối thủ</div>
    </div>

    <div class="p2p-uv-toolbar">
      <div class="p2p-uv-hotkey-row">
        <button class="action-btn p2p-uv-hk-btn" type="button" data-uv-hotkey="win_d">Win+D</button>
        <button class="action-btn p2p-uv-hk-btn" type="button" data-uv-hotkey="alt_tab">Alt+Tab</button>
        <button class="action-btn p2p-uv-hk-btn" type="button" data-uv-hotkey="win_e">Explorer</button>
        <button class="action-btn p2p-uv-hk-btn" type="button" data-uv-hotkey="task_mgr">Task Mgr</button>
        <button class="action-btn p2p-uv-hk-btn" type="button" data-uv-hotkey="ctrl_c">Ctrl+C</button>
        <button class="action-btn p2p-uv-hk-btn" type="button" data-uv-hotkey="ctrl_v">Ctrl+V</button>
        <button class="action-btn p2p-uv-hk-btn" type="button" data-uv-hotkey="enter">Enter</button>
        <button class="action-btn p2p-uv-hk-btn" type="button" data-uv-hotkey="backspace">Backspace</button>
        <button class="action-btn p2p-uv-hk-btn" type="button" data-uv-hotkey="escape">Esc</button>
        <span class="p2p-ctrl-divider"></span>
        <button id="btn-p2p-uv-notepad" class="action-btn p2p-uv-hk-btn" type="button">Notepad Trêu</button>
        <button id="btn-p2p-uv-jitter" class="action-btn p2p-uv-hk-btn" type="button">Xoay Chuột 4s</button>
        <button id="btn-p2p-uv-block" class="action-btn p2p-uv-hk-btn" type="button" style="border-color: rgba(248, 113, 113, 0.55); color: #fecaca;">Khóa Input 8s</button>
      </div>
      <div class="url-row" style="margin: 0;">
        <input id="p2p-uv-text-input" class="studio-input" type="text" placeholder="Gửi nhanh 1 đoạn văn bản gõ sang máy đối thủ rồi nhấn Gửi..." />
        <button id="btn-p2p-uv-send-text" class="studio-btn-primary" type="button" style="padding: 4px 12px; font-size: 11px;">Gửi Văn Bản</button>
      </div>
    </div>
  </div>
`;
