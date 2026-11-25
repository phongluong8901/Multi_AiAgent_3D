export const webCompanionHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Duck ai Manager - Web Chat Sync &amp; Cloud Hub</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #0b1120;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex;
      justify-content: center;
      padding: 18px;
    }
    .shell {
      width: min(1040px, 100%);
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 14px;
    }
    @media (max-width: 860px) {
      .shell { grid-template-columns: 1fr; }
    }
    .card {
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(56, 189, 248, 0.28);
      border-radius: 14px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 540px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      padding-bottom: 9px;
    }
    .title { font-size: 13px; font-weight: 700; color: #7dd3fc; letter-spacing: 0.4px; }
    .badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: rgba(30, 41, 59, 0.8);
      color: #cbd5e1;
    }
    .badge.ok { border-color: rgba(52, 211, 153, 0.5); color: #6ee7b7; background: rgba(16, 185, 129, 0.18); }
    .chat-list {
      flex: 1;
      overflow-y: auto;
      max-height: 410px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 4px;
    }
    .msg {
      padding: 8px 10px;
      border-radius: 10px;
      font-size: 12.5px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .msg.user { background: rgba(37, 99, 235, 0.25); border: 1px solid rgba(59, 130, 246, 0.4); align-self: flex-end; max-width: 88%; }
    .msg.assistant { background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(148, 163, 184, 0.22); align-self: flex-start; max-width: 90%; }
    .meta { font-size: 9.5px; color: #94a3b8; margin-bottom: 3px; }
    .row { display: flex; gap: 6px; align-items: center; }
    input, select, textarea {
      width: 100%;
      background: rgba(2, 6, 23, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 8px;
      color: #f8fafc;
      padding: 7px 10px;
      font-size: 12px;
      outline: none;
    }
    input:focus, textarea:focus { border-color: #38bdf8; }
    button {
      cursor: pointer;
      border-radius: 8px;
      border: 1px solid rgba(56, 189, 248, 0.45);
      background: rgba(14, 165, 233, 0.22);
      color: #e0f2fe;
      padding: 7px 11px;
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
    }
    button:hover { background: rgba(14, 165, 233, 0.35); }
    button.danger { border-color: rgba(248, 113, 113, 0.45); background: rgba(239, 68, 68, 0.16); color: #fca5a5; }
    button.listening { border-color: rgba(248, 113, 113, 0.8); background: rgba(239, 68, 68, 0.3); color: #fecaca; }
    .skill-list { flex: 1; overflow-y: auto; max-height: 410px; display: flex; flex-direction: column; gap: 8px; }
    .skill-item {
      background: rgba(2, 6, 23, 0.65);
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 9px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 11.5px;
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="card">
      <div class="header">
        <div>
          <div class="title">DUCK AI - WEB CHAT SYNC</div>
          <div id="auth-label" style="font-size:11px;color:#94a3b8;margin-top:2px;">Chưa có token Google (mở từ nút Web Chat trong Desktop hoặc dán token)</div>
        </div>
        <div class="row" style="width:auto;">
          <span id="sync-badge" class="badge">[OFFLINE]</span>
          <button id="btn-sync-now" type="button">Đồng Bộ</button>
          <button id="btn-clear-sync" class="danger" type="button">Xóa</button>
        </div>
      </div>

      <div id="token-box" class="row">
        <input id="inp-token" type="password" placeholder="Dán Google id_token / access_token (nếu mở trực tiếp không qua app Desktop)..." />
        <button id="btn-save-token" type="button">Kết Nối</button>
      </div>

      <div id="chat-list" class="chat-list"></div>

      <div class="row">
        <input id="chat-input" type="text" placeholder="Nhắn tin đồng bộ với Duck Desktop, /agent mục tiêu, hoặc Ctrl+Space để nói..." />
        <button id="btn-web-ptt" type="button" title="Push-to-Talk (Ctrl+Space)">Mic</button>
        <button id="btn-web-send" type="button">Gửi</button>
        <button id="btn-web-agent" type="button" title="Chạy Agent đa bước trên PC theo thời gian thực" style="border-color: rgba(16, 185, 129, 0.55); background: rgba(16, 185, 129, 0.2); color: #a7f3d0;">Chạy Agent</button>
      </div>
    </section>

    <section class="card">
      <div class="header">
        <div class="title">KHO SKILL CỘNG ĐỒNG (MONGODB)</div>
        <button id="btn-refresh-skills" type="button">Tải Lại</button>
      </div>
      <div class="row">
        <input id="skill-search" type="text" placeholder="Tìm skill theo tên, mô tả..." />
        <button id="btn-search-skills" type="button">Tìm</button>
      </div>
      <div id="skill-list" class="skill-list"></div>
    </section>

    <section class="card" style="grid-column: 1 / -1; min-height: 200px;">
      <div class="header">
        <div class="title">MOBILE STREAM DECK &amp; FLASHCARD TIẾNG ANH (CLOUD)</div>
        <button id="btn-cloud-vocab-draw" type="button">Từ Vựng Mới</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;">
        <button type="button" data-pc-deck="vol_down">Vol -</button>
        <button type="button" data-pc-deck="mute">Mute</button>
        <button type="button" data-pc-deck="vol_up">Vol +</button>
        <button type="button" data-pc-deck="prev">Prev</button>
        <button type="button" data-pc-deck="play_pause">Play/Pause</button>
        <button type="button" data-pc-deck="next">Next</button>
        <button type="button" data-pc-deck="clean_ram">Dọn RAM PC</button>
        <button type="button" class="danger" data-pc-deck="lock_pc">Khóa Màn PC</button>
      </div>
      <div class="row">
        <input id="inp-cloud-clip" type="text" placeholder="Dán link hoặc văn bản bắn thẳng sang PC..." />
        <button id="btn-cloud-clip" type="button">Chép Vào PC</button>
        <button id="btn-cloud-open" type="button">Mở Trên PC</button>
      </div>
      <div id="cloud-vocab-box" class="skill-item" style="display:none;"></div>
    </section>

    <section class="card" style="grid-column: 1 / -1; min-height: 200px;">
      <div class="header">
        <div class="title">TỰ ĐỘNG HÓA PC TỪ XA (RULES)</div>
        <button id="btn-load-remote-rules" type="button">Tải Rules PC</button>
      </div>
      <div id="remote-rules-list" class="skill-list" style="max-height: 220px;">
        <div style="color:#94a3b8;font-size:11.5px;">Bấm "Tải Rules PC" để lấy danh sách Automation Rules trên máy tính và Bật/Tắt hoặc Chạy Ngay từ xa.</div>
      </div>
    </section>
  </div>

  <script>
    const TOKEN_KEY = 'duck_web_google_token';
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (hashParams.get('token')) {
      localStorage.setItem(TOKEN_KEY, hashParams.get('token'));
      history.replaceState(null, '', location.pathname);
    }
    let token = localStorage.getItem(TOKEN_KEY) || '';
    let chatEventSource = null;
    const streamingBubbles = new Map();
    const inpToken = document.getElementById('inp-token');
    const tokenBox = document.getElementById('token-box');
    const authLabel = document.getElementById('auth-label');
    const syncBadge = document.getElementById('sync-badge');
    const chatList = document.getElementById('chat-list');
    const chatInput = document.getElementById('chat-input');
    const skillList = document.getElementById('skill-list');
    const remoteRulesList = document.getElementById('remote-rules-list');

    function updateAuthUi(email) {
      if (token) {
        tokenBox.style.display = 'none';
        syncBadge.className = 'badge ok';
        syncBadge.textContent = '[SYNCED]';
        authLabel.textContent = email ? 'Đã kết nối: ' + email : 'Đã kết nối phiên Google từ Desktop';
      } else {
        tokenBox.style.display = 'flex';
        syncBadge.className = 'badge';
        syncBadge.textContent = '[NO TOKEN]';
      }
    }

    async function api(path, opts = {}) {
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(path, Object.assign({}, opts, { headers }));
      return res.json();
    }

    function extractRemoteRulesFromText(raw) {
      var text = String(raw || '');
      var tag = '[REMOTE_RULES_JSON:';
      var idx = text.indexOf(tag);
      if (idx === -1) return { displayText: text, rules: null };
      var jsonStart = idx + tag.length;
      var depth = 0;
      var inStr = false;
      var esc = false;
      var jsonEnd = -1;
      for (var i = jsonStart; i < text.length; i++) {
        var ch = text.charAt(i);
        if (inStr) {
          if (esc) esc = false;
          else if (ch === String.fromCharCode(92)) esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === '[') depth++;
        else if (ch === ']') {
          depth--;
          if (depth === 0) {
            jsonEnd = i;
            break;
          }
        }
      }
      if (jsonEnd === -1) return { displayText: text, rules: null };
      var jsonSlice = text.slice(jsonStart, jsonEnd + 1);
      var closeBracketIdx = text.indexOf(']', jsonEnd + 1);
      var tailIdx = closeBracketIdx !== -1 ? closeBracketIdx + 1 : jsonEnd + 1;
      var cleaned = (text.slice(0, idx) + text.slice(tailIdx)).trim();
      try {
        var parsed = JSON.parse(jsonSlice);
        if (Array.isArray(parsed)) {
          return {
            displayText: cleaned || ('[REMOTE RULES] Đã đồng bộ ' + parsed.length + ' Automation Rule bên dưới.'),
            rules: parsed
          };
        }
      } catch {}
      return { displayText: text, rules: null };
    }

    function renderRemoteRules(rules) {
      if (!remoteRulesList) return;
      remoteRulesList.innerHTML = '';
      if (!rules || rules.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'color:#94a3b8;font-size:11.5px;';
        empty.textContent = 'PC hiện chưa có Automation Rule nào.';
        remoteRulesList.appendChild(empty);
        return;
      }
      rules.forEach(function (r) {
        var card = document.createElement('div');
        card.className = 'skill-item';
        var top = document.createElement('div');
        top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;';
        var left = document.createElement('div');
        var title = document.createElement('strong');
        title.textContent = (r.name || r.id) + ' [' + (r.enabled ? 'ĐANG BẬT' : 'ĐANG TẮT') + ']';
        title.style.color = r.enabled ? '#6ee7b7' : '#94a3b8';
        left.appendChild(title);

        var actions = document.createElement('div');
        actions.className = 'row';
        actions.style.width = 'auto';

        var toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.textContent = r.enabled ? 'Tắt' : 'Bật';
        toggleBtn.onclick = function () {
          sendChat('/rule_toggle ' + r.id + ' ' + (r.enabled ? 'off' : 'on'));
        };

        var runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.textContent = 'Chạy Ngay';
        runBtn.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        runBtn.onclick = function () {
          sendChat('/rule_run ' + r.id);
        };

        actions.append(toggleBtn, runBtn);
        top.append(left, actions);

        var desc = document.createElement('div');
        desc.style.cssText = 'color:#cbd5e1;font-size:11px;';
        desc.textContent = 'Trigger: ' + (r.trigger_type || '') + ' (' + (r.trigger_value || '') + ') -> ' + (r.action_target || '');
        card.append(top, desc);
        remoteRulesList.appendChild(card);
      });
    }

    function renderMessages(items) {
      chatList.innerHTML = '';
      if (!items || items.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#64748b;font-size:11.5px;';
        empty.textContent = 'Chưa có tin nhắn đồng bộ.';
        chatList.appendChild(empty);
        return;
      }
      var latestRules = null;
      items.forEach((m) => {
        var extracted = extractRemoteRulesFromText(m.content);
        if (extracted.rules) latestRules = extracted.rules;
        const div = document.createElement('div');
        div.className = 'msg ' + (m.role === 'assistant' ? 'assistant' : 'user');
        const meta = document.createElement('div');
        meta.className = 'meta';
        const timeStr = new Date(m.created_at_ms || Date.now()).toLocaleTimeString();
        meta.textContent = '[' + String(m.source || 'desktop').toUpperCase() + '] ' + (m.role === 'assistant' ? 'Duck AI' : 'Bạn') + ' - ' + timeStr;
        const body = document.createElement('div');
        body.textContent = extracted.displayText;
        div.append(meta, body);
        chatList.appendChild(div);
      });
      if (latestRules) renderRemoteRules(latestRules);
      chatList.scrollTop = chatList.scrollHeight;
    }

    function renderStreamChunk(payload) {
      const sid = payload.stream_id || 'live';
      let entry = streamingBubbles.get(sid);
      if (!entry) {
        const div = document.createElement('div');
        div.className = 'msg assistant';
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = '[DESKTOP STREAM] Duck AI - đang trả lời...';
        const body = document.createElement('div');
        body.textContent = '';
        div.append(meta, body);
        chatList.appendChild(div);
        entry = { div, meta, body, text: '' };
        streamingBubbles.set(sid, entry);
      }
      if (payload.token) {
        entry.text += payload.token;
        entry.body.textContent = entry.text;
        chatList.scrollTop = chatList.scrollHeight;
      }
      if (payload.done) {
        entry.meta.textContent = '[DESKTOP] Duck AI - vừa xong';
        streamingBubbles.delete(sid);
      }
    }

    function connectChatStream() {
      if (chatEventSource) {
        chatEventSource.close();
        chatEventSource = null;
      }
      if (!token) return;
      chatEventSource = new EventSource('/api/chat/stream?token=' + encodeURIComponent(token));
      chatEventSource.addEventListener('ready', () => {
        syncBadge.className = 'badge ok';
        syncBadge.textContent = '[SSE LIVE]';
      });
      chatEventSource.addEventListener('chunk', (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          renderStreamChunk(payload);
        } catch {}
      });
      chatEventSource.addEventListener('message', () => {
        streamingBubbles.clear();
        loadChat();
      });
      chatEventSource.onerror = () => {
        syncBadge.className = 'badge';
        syncBadge.textContent = '[RECONNECTING]';
      };
    }

    async function loadChat() {
      if (!token) return;
      const data = await api('/api/chat');
      if (data.ok) {
        updateAuthUi(data.email || '');
        renderMessages(data.items || []);
        if (!chatEventSource) connectChatStream();
      } else {
        if (chatEventSource) { chatEventSource.close(); chatEventSource = null; }
        localStorage.removeItem(TOKEN_KEY);
        token = '';
        updateAuthUi('');
        syncBadge.textContent = '[TOKEN EXPIRED]';
        authLabel.textContent = data.error || 'Token hết hạn. Hãy bấm lại "Web Chat" từ app Desktop.';
      }
    }

    async function sendChat(text) {
      const clean = (text || '').trim();
      if (!clean || !token) return;
      chatInput.value = '';
      await api('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ role: 'user', content: clean, source: 'web', created_at_ms: Date.now() })
      });
      await loadChat();
    }

    async function loadSkills() {
      if (!token) return;
      const q = document.getElementById('skill-search').value.trim();
      const data = await api('/api/skills?q=' + encodeURIComponent(q));
      skillList.innerHTML = '';
      if (!data.ok) {
        skillList.textContent = data.error || 'Lỗi tải danh sách.';
        return;
      }
      (data.items || []).forEach((s) => {
        const card = document.createElement('div');
        card.className = 'skill-item';
        const top = document.createElement('div');
        top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:6px;';
        const title = document.createElement('strong');
        title.textContent = s.name + ' (' + s.language + ' v' + (s.version || 1) + ')';
        const starBtn = document.createElement('button');
        starBtn.type = 'button';
        starBtn.textContent = 'Star (' + (s.stars || 0) + ')';
        starBtn.onclick = async () => {
          await api('/api/skills/' + encodeURIComponent(s.skill_key) + '/star', { method: 'POST', body: '{}' });
          await loadSkills();
        };
        top.append(title, starBtn);
        const desc = document.createElement('div');
        desc.style.color = '#cbd5e1';
        desc.textContent = s.description || s.id;
        const meta = document.createElement('div');
        meta.style.cssText = 'font-size:10px;color:#94a3b8;';
        meta.textContent = 'Tác giả: ' + (s.author_name || s.author_email || 'Community') + ' | Lượt tải: ' + (s.downloads || 0);
        card.append(top, desc, meta);
        skillList.appendChild(card);
      });
    }

    document.getElementById('btn-save-token').onclick = () => {
      token = inpToken.value.trim();
      if (token) localStorage.setItem(TOKEN_KEY, token);
      updateAuthUi('');
      loadChat();
      loadSkills();
    };
    document.getElementById('btn-sync-now').onclick = () => { loadChat(); loadSkills(); };
    document.getElementById('btn-clear-sync').onclick = async () => {
      if (!token) return;
      await api('/api/chat', { method: 'DELETE' });
      await loadChat();
    };
    document.getElementById('btn-web-send').onclick = () => sendChat(chatInput.value);
    document.getElementById('btn-web-agent').onclick = () => {
      var goal = (chatInput.value || '').trim();
      if (!goal) return;
      sendChat(goal.indexOf('/agent') === 0 ? goal : '/agent ' + goal);
    };
    document.getElementById('btn-load-remote-rules').onclick = () => {
      sendChat('/rules');
    };
    document.querySelectorAll('[data-pc-deck]').forEach((btn) => {
      btn.onclick = () => sendChat('/pc_deck ' + btn.getAttribute('data-pc-deck'));
    });
    document.getElementById('btn-cloud-clip').onclick = () => {
      var v = (document.getElementById('inp-cloud-clip').value || '').trim();
      if (v) sendChat('/pc_deck clip:' + v);
    };
    document.getElementById('btn-cloud-open').onclick = () => {
      var v = (document.getElementById('inp-cloud-clip').value || '').trim();
      if (v) sendChat('/pc_deck open:' + v);
    };
    document.getElementById('btn-cloud-vocab-draw').onclick = async () => {
      try {
        var res = await fetch('/api/vocab/random').then((r) => r.json());
        var box = document.getElementById('cloud-vocab-box');
        if (res && res.ok && res.item && box) {
          box.style.display = 'flex';
          box.textContent =
            '[' + (res.item.level || 'B2') + '] ' + res.item.word + ' ' + (res.item.phonetic || '') +
            ' — ' + (res.item.meaning_vi || res.item.definition_en || '') +
            (res.item.example_en ? (' | VD: ' + res.item.example_en) : '');
        }
      } catch {}
    };
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChat(chatInput.value);
    });
    document.getElementById('btn-refresh-skills').onclick = loadSkills;
    document.getElementById('btn-search-skills').onclick = loadSkills;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const pttBtn = document.getElementById('btn-web-ptt');
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.lang = 'vi-VN';
      rec.interimResults = true;
      let active = false;
      rec.onresult = (ev) => {
        let txt = '';
        for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
        chatInput.value = txt;
        if (ev.results[ev.results.length - 1].isFinal) {
          active = false;
          pttBtn.classList.remove('listening');
          pttBtn.textContent = 'Mic';
          sendChat(txt);
        }
      };
      rec.onerror = () => { active = false; pttBtn.classList.remove('listening'); pttBtn.textContent = 'Mic'; };
      rec.onend = () => { active = false; pttBtn.classList.remove('listening'); pttBtn.textContent = 'Mic'; };
      const toggleMic = () => {
        if (active) { rec.stop(); return; }
        active = true;
        pttBtn.classList.add('listening');
        pttBtn.textContent = 'Nghe...';
        rec.start();
      };
      pttBtn.onclick = toggleMic;
      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); toggleMic(); }
      });
    } else {
      pttBtn.disabled = true;
      pttBtn.title = 'Trình duyệt không hỗ trợ Web Speech API';
    }

    updateAuthUi('');
    if (token) {
      loadChat();
      loadSkills();
    }
    setInterval(() => { if (token) loadChat(); }, 4000);
  </script>
</body>
</html>`;
