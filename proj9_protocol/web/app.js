let wsConn = null;
let evtSource = null;
let trafficList = [];

const currentHost = window.location.host || '127.0.0.1:8080';
const currentHostname = window.location.hostname || '127.0.0.1';

function isStreamLive() {
    const wsOpen = wsConn && wsConn.readyState === WebSocket.OPEN;
    const sseOpen = evtSource && evtSource.readyState === EventSource.OPEN;
    return Boolean(wsOpen || sseOpen);
}

// Ghi nhận và hiển thị một gói tin mới vào Bảng Dòng Chảy Trực Tiếp (khử trùng lặp theo ID).
function recordPacketTraffic(pkt) {
    if (pkt.id && trafficList.some(item => item.id === pkt.id)) {
        return;
    }
    trafficList.unshift(pkt);
    if (trafficList.length > 50) {
        trafficList.pop();
    }
    renderTrafficTable();
}

function renderTrafficTable() {
    const tbody = document.getElementById('trafficBody');
    if (!tbody) return;

    if (trafficList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b; padding:24px;">Chua co goi tin nao. Bam cac nut "Test Nhanh" o tren de quan sat dong truyen thong truc tiep!</td></tr>`;
        return;
    }

    tbody.innerHTML = trafficList.slice(0, 25).map((p, idx) => {
        const protoClass = getProtoClass(p.from);
        const dataStr = typeof p.data === 'object' ? JSON.stringify(p.data) : String(p.data || '');
        const highlightStyle = idx === 0 ? "background: #182747;" : "";

        return `
            <tr style="${highlightStyle}">
                <td><code>${escapeHTML(p.time || new Date().toLocaleTimeString())}</code></td>
                <td><strong style="color:#f8fafc;">${escapeHTML(p.id || 'N/A')}</strong></td>
                <td><span class="badge-proto ${protoClass}">${escapeHTML(p.from || 'unknown')}</span></td>
                <td><span class="badge" style="background:#1e293b; color:#cbd5e1;">${escapeHTML(p.target || 'all')}</span></td>
                <td>${p.size || 0} B <small style="color:#64748b;">(+${p.overhead || 0}B)</small></td>
                <td style="color:#38bdf8; font-family:monospace; font-weight:600;">${Number(p.latency || 0).toFixed(2)} ms</td>
                <td><code>${escapeHTML(dataStr)}</code></td>
                <td><span class="badge-on" style="background:#14532d; color:#86efac;">OK TRANSMITTED</span></td>
            </tr>
        `;
    }).join('');
}

function getProtoClass(proto) {
    if (!proto) return 'proto-mock';
    const p = proto.toLowerCase();
    if (p.includes('http')) return 'proto-http';
    if (p.includes('sio') || p.includes('socketio')) return 'proto-sio';
    if (p.includes('ws') || p.includes('websocket')) return 'proto-ws';
    if (p.includes('mqtt')) return 'proto-mqtt';
    if (p.includes('grpc')) return 'proto-grpc';
    if (p.includes('sse')) return 'proto-sse';
    if (p.includes('mjpeg')) return 'proto-mjpeg';
    if (p.includes('rtp') || p.includes('udp')) return 'proto-udp';
    if (p.includes('tcp')) return 'proto-tcp';
    if (p.includes('ndjson')) return 'proto-ndjson';
    if (p.includes('worker')) return 'proto-worker';
    return 'proto-mock';
}

function clearTrafficTable() {
    trafficList = [];
    renderTrafficTable();
    setFeedback("[CLEARED] Da xoa lich su dong chay goi tin.");
}

function setFeedback(msg, isError = false) {
    const fb = document.getElementById('liveFeedback');
    if (!fb) return;
    fb.textContent = msg;
    fb.style.color = isError ? '#f87171' : '#4ade80';
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function appendPanelLogByProto(proto, text) {
    const map = {
        http_rest: 'httpLog',
        websocket: 'wsLog',
        sse: 'sseLog',
        mqtt: 'mqttLog',
        grpc: 'grpcLog',
        socketio: 'sioLog',
        rtp_udp: 'udpLog',
        tcp_raw: 'tcpLog',
        ndjson: 'ndjsonLog',
    };
    if (map[proto]) {
        logAppend(map[proto], text);
    }
}

// 1-Click Quick Test: Bắn gói tin qua socket thật của giao thức và hiển thị phản hồi ngay lập tức
async function quickSend(proto, payload) {
    setFeedback(`[SENDING] Dang gui goi tin qua giao thuc [${proto.toUpperCase()}]...`);
    const start = performance.now();
    try {
        const res = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proto: proto, payload: payload })
        });
        const elapsed = (performance.now() - start).toFixed(2);
        const text = await res.text();

        if (res.ok) {
            const data = JSON.parse(text);
            const targetEl = document.getElementById('swapTarget');
            const target = targetEl ? targetEl.value : 'all';
            const modeTag = data.via_socket ? 'SOCKET' : 'PIPELINE';
            setFeedback(`[SUCCESS | ${modeTag}] [${proto.toUpperCase()}] -> Gateway (${elapsed}ms) -> Phat toi [${target.toUpperCase()}]!`);

            appendPanelLogByProto(proto, `[${modeTag} TEST | ${elapsed}ms] ${payload}`);

            if (!isStreamLive()) {
                recordPacketTraffic({
                    time: new Date().toLocaleTimeString(),
                    id: data.packet.id,
                    from: proto,
                    target: target,
                    size: data.packet.payload_size,
                    overhead: data.packet.overhead_bytes || 0,
                    latency: elapsed,
                    data: payload,
                    status: 'SUCCESS'
                });
            }
            refreshStats();
        } else {
            setFeedback(`[ERROR ${res.status}] ${text}`, true);
        }
    } catch (err) {
        setFeedback(`[ERROR] ` + err.message, true);
    }
}

// Khởi tạo WebSocket kết nối cùng origin ngay trên Gateway (:8080/api/ws)
function initWS() {
    const badge = document.getElementById('wsStatusBadge');
    if (badge) {
        badge.textContent = "DANG KET NOI...";
        badge.className = "badge";
    }

    if (wsConn) {
        try { wsConn.close(); } catch (e) { }
    }

    try {
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProto}//${currentHost}/api/ws`;

        wsConn = new WebSocket(wsUrl);
        wsConn.onopen = () => {
            if (badge) {
                badge.textContent = "CONNECTED";
                badge.className = "badge badge-on";
            }
            logAppend('wsLog', `[CONNECTED] WebSocket da ket noi toi ${wsUrl}`);
        };
        wsConn.onmessage = (e) => {
            logAppend('wsLog', '[RECV] ' + e.data);
            try {
                const parsed = JSON.parse(e.data);
                if (parsed.from && parsed.id) {
                    recordPacketTraffic({
                        time: new Date().toLocaleTimeString(),
                        id: parsed.id,
                        from: parsed.from,
                        target: parsed.target || 'all',
                        size: parsed.size || 0,
                        overhead: parsed.overhead || 0,
                        latency: parsed.latency_ms || 0,
                        data: parsed.data || e.data
                    });
                }
            } catch (err) {}
        };
        wsConn.onclose = () => {
            if (badge) {
                badge.textContent = "DISCONNECTED";
                badge.className = "badge badge-off";
            }
            logAppend('wsLog', '[CLOSED] WebSocket da ngat ket noi.');
        };
        wsConn.onerror = () => {
            if (badge) {
                badge.textContent = "OFFLINE";
                badge.className = "badge badge-off";
            }
            logAppend('wsLog', '[WARN] Khong the ket noi WebSocket.');
        };
    } catch (err) {
        logAppend('wsLog', '[ERROR] ' + err.message);
    }
}

function sendWS() {
    const input = document.getElementById('wsInput');
    const val = (input && input.value) || '{"msg":"hello from web","seq":1}';
    if (wsConn && wsConn.readyState === WebSocket.OPEN) {
        wsConn.send(val);
        logAppend('wsLog', '[SENT] ' + val);
        setFeedback(`[WS SENT] Da phat tin nhan WebSocket len Gateway: ${val}`);
    } else {
        quickSend('websocket', val);
    }
}

// Gửi HTTP Ingest qua Gateway API cùng origin (/api/ingest)
async function sendHTTP() {
    const input = document.getElementById('httpInput');
    const payload = (input && input.value) || '{}';
    const start = performance.now();
    try {
        const res = await fetch('/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });
        const elapsed = (performance.now() - start).toFixed(2);
        const text = await res.text();
        if (res.ok) {
            const data = JSON.parse(text);
            logAppend('httpLog', `[HTTP 200 OK | ${elapsed}ms] ${text}`);
            setFeedback(`[HTTP SUCCESS] Ingest thanh cong goi tin (ID: ${data.packet.id}) qua HTTP REST trong ${elapsed}ms!`);
            if (!isStreamLive()) {
                recordPacketTraffic({
                    time: new Date().toLocaleTimeString(),
                    id: data.packet.id,
                    from: 'http_rest',
                    target: document.getElementById('swapTarget').value,
                    size: data.packet.payload_size,
                    overhead: data.packet.overhead_bytes || 550,
                    latency: elapsed,
                    data: payload
                });
            }
            refreshStats();
        } else {
            logAppend('httpLog', `[HTTP ${res.status} ERROR | ${elapsed}ms] ${text}`);
            setFeedback(`[HTTP ERROR ${res.status}] ${text}`, true);
        }
    } catch (err) {
        logAppend('httpLog', `[ERROR] Failed to POST /api/ingest (${err.message})`);
        setFeedback(`[ERROR] ` + err.message, true);
    }
}

async function sendMQTT() {
    const input = document.getElementById('mqttInput');
    const val = (input && input.value) || '{"topic":"sensor/temperature","celsius":28.0}';
    await quickSend('mqtt', val);
}

async function sendGRPC() {
    const input = document.getElementById('grpcInput');
    const val = (input && input.value) || '{"inference":"yolo_v8","objects":3,"fps":30}';
    await quickSend('grpc', val);
}

async function sendSocketIO() {
    const input = document.getElementById('sioInput');
    const val = (input && input.value) || '{"event":"telemetry","sensor":"lidar","ok":true}';
    await quickSend('socketio', val);
}

async function sendUDP() {
    const input = document.getElementById('udpInput');
    const val = (input && input.value) || '{"rtp_seq":1,"payload":"media_chunk_sim"}';
    await quickSend('rtp_udp', val);
}

async function sendTCPRaw() {
    const input = document.getElementById('tcpInput');
    const val = (input && input.value) || '{"binary_frame":1,"sensor":"industrial_plc","ok":true}';
    await quickSend('tcp_raw', val);
}

async function sendNDJSON() {
    const input = document.getElementById('ndjsonInput');
    const val = (input && input.value) || '{"token":"streaming_ai_chunk","step":1}';
    await quickSend('ndjson', val);
}

function reloadMJPEG() {
    const img = document.getElementById('mjpegFeed');
    if (img) {
        img.style.display = 'block';
        img.src = `http://${currentHostname}:8085/video?t=` + Date.now();
    }
    const errEl = document.getElementById('mjpegErr');
    if (errEl) {
        errEl.style.display = 'none';
    }
    setFeedback("[MJPEG] Da nap lai luong video camera.");
}

function logAppend(elementId, text) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const time = new Date().toLocaleTimeString();
    el.textContent = `[${time}] ${text}\n` + el.textContent.slice(0, 3000);
}

// Kết nối SSE cùng origin ngay trên Gateway (:8080/api/events)
function connectSSE() {
    if (evtSource) {
        try { evtSource.close(); } catch (e) { }
    }
    try {
        evtSource = new EventSource('/api/events');
        evtSource.onopen = () => {
            logAppend('sseLog', '[CONNECTED] SSE da ket noi live toi /api/events');
        };
        evtSource.onmessage = (e) => {
            logAppend('sseLog', e.data);
            try {
                const parsed = JSON.parse(e.data);
                if (parsed.from && parsed.id) {
                    recordPacketTraffic({
                        time: new Date().toLocaleTimeString(),
                        id: parsed.id,
                        from: parsed.from,
                        target: parsed.target || 'all',
                        size: parsed.size || 0,
                        overhead: parsed.overhead || 0,
                        latency: parsed.latency_ms || 0,
                        data: parsed.data || e.data
                    });
                }
            } catch (err) {}
        };
        evtSource.onerror = () => {
            // EventSource tu dong ket noi lai
        };
    } catch (err) {
        logAppend('sseLog', '[ERROR] ' + err.message);
    }
}

// Bảng thống kê (hỗ trợ mảng []ProtocolStats từ Registry.AllStats())
async function refreshStats() {
    try {
        const res = await fetch('/control/stats');
        if (!res.ok) return;
        const data = await res.json();

        const swapSelect = document.getElementById('swapTarget');
        if (swapSelect && data.current_swap_target && document.activeElement !== swapSelect) {
            swapSelect.value = data.current_swap_target;
        }

        const tbody = document.getElementById('statsBody');
        if (!tbody) return;

        const protocols = Array.isArray(data.protocols)
            ? data.protocols
            : Object.keys(data.protocols || {}).sort().map(k => ({ key: k, ...data.protocols[k] }));

        tbody.innerHTML = protocols.map(p => {
            const key = p.key || '';
            const totalKB = (((p.bytes_in_total || 0) + (p.bytes_out_total || 0)) / 1024).toFixed(1);
            const nextState = p.is_running ? 'off' : 'on';
            const actionClass = p.is_running ? 'btn-danger' : 'btn-success';
            const actionLabel = p.is_running ? 'Tat' : 'Bat';
            const subMeta = [p.direction, p.endpoint].filter(Boolean).join(' | ');

            return `
              <tr>
                <td>
                  <strong>${escapeHTML(p.protocol_name)}</strong>
                  <span style="color:#64748b; font-size:11px;">(${escapeHTML(key)})</span>
                  ${subMeta ? `<div style="font-size:11px; color:#64748b; margin-top:2px;">${escapeHTML(subMeta)}</div>` : ''}
                </td>
                <td><code>${escapeHTML(p.port)}</code></td>
                <td><span class="${p.is_running ? 'badge-on' : 'badge-off'}">${p.is_running ? 'RUNNING' : 'STOPPED'}</span></td>
                <td>${p.active_clients || 0}</td>
                <td><code>${p.header_overhead_bytes || 0} B</code></td>
                <td>${(p.msg_in_count || 0).toLocaleString()}</td>
                <td>${(p.msg_out_count || 0).toLocaleString()}</td>
                <td>${totalKB} KB</td>
                <td style="color:#38bdf8; font-family:monospace; font-weight:600;">${(p.avg_latency_ms || 0).toFixed(3)} ms</td>
                <td>
                  <button class="${actionClass}" onclick="toggleProto('${escapeHTML(key)}', '${nextState}')">
                    ${actionLabel}
                  </button>
                </td>
              </tr>
            `;
        }).join('');
    } catch (err) {
        // Control server chua bat
    }
}

async function toggleProto(proto, state) {
    try {
        const res = await fetch(`/control/toggle?proto=${encodeURIComponent(proto)}&state=${encodeURIComponent(state)}`, { method: 'POST' });
        const txt = await res.text();
        if (!res.ok) {
            setFeedback(`[ERROR] Khong the doi trang thai [${proto}]: ${txt}`, true);
        } else {
            setFeedback(txt.trim());
            if (proto === 'mjpeg' && state === 'on') {
                setTimeout(reloadMJPEG, 250);
            }
        }
        refreshStats();
    } catch (err) {
        setFeedback(`[ERROR] ` + err.message, true);
    }
}

async function swapProtocol(target) {
    try {
        const res = await fetch(`/control/swap?target=${encodeURIComponent(target)}`, { method: 'POST' });
        const txt = await res.text();
        if (res.ok) {
            setFeedback(txt.trim());
        } else {
            setFeedback(`[ERROR] ${txt}`, true);
        }
        refreshStats();
    } catch (err) {
        setFeedback(`[ERROR] ` + err.message, true);
    }
}

async function runStressTest() {
    const srcEl = document.getElementById('benchSource');
    const source = (srcEl && srcEl.value) || 'http_rest';
    setFeedback(`[STRESS TEST] Dang bom 1.000 goi tin tu nguon [${source.toUpperCase()}] vao pipeline...`);
    try {
        const res = await fetch(`/control/bench?source=${encodeURIComponent(source)}&count=1000`, { method: 'POST' });
        const txt = await res.text();
        if (res.ok) {
            setFeedback(`[STRESS TEST COMPLETE] ${txt.trim()} Quan sat so luong goi tin va bang thong tang vot tren bang thong ke.`);
        } else {
            setFeedback(`[ERROR] ${txt}`, true);
        }
        setTimeout(refreshStats, 200);
    } catch (err) {
        setFeedback(`[ERROR] ` + err.message, true);
    }
}

async function resetAllStats() {
    try {
        const res = await fetch('/control/reset', { method: 'POST' });
        if (res.ok) {
            trafficList = [];
            renderTrafficTable();
            setFeedback("[RESET] Da dat lai toan bo thong so goi tin, bang thong, do tre va Worker Monitor ve 0.");
            refreshStats();
        } else {
            const txt = await res.text();
            setFeedback(`[ERROR] Reset that bai: ${txt}`, true);
        }
    } catch (err) {
        setFeedback(`[ERROR] ` + err.message, true);
    }
}

function startApp() {
    connectSSE();
    initWS();
    setInterval(refreshStats, 800);
    refreshStats();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
} else {
    startApp();
}
