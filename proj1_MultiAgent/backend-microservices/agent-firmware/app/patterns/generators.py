from typing import Any, Dict, List
from app.schemas import GenerateFirmwareRequest, ConnectionProfile


SUPPORTED_BOARDS: List[Dict[str, Any]] = [
    {
        "id": "esp32_s3",
        "name": "ESP32-S3-WROOM-1 N16R8 (AI Voice & Vision)",
        "architecture": "Dual-core Xtensa LX7 @ 240MHz + Vector AI",
        "ram_kb": 512,
        "psram_mb": 8,
        "flash_mb": 16,
        "connectivity": ["wifi", "ble", "ip", "esp_now"],
        "transports": ["sse", "websocket", "mqtt", "http", "esp_now"],
        "language": "cpp_arduino",
        "audio_hardware": "I2S Mic INMP441 (GPIO 4,5,6) + I2S Amp MAX98357A (GPIO 15,16,17)",
        "description": "Mạch AI nhúng cao cấp có 8MB PSRAM & tập lệnh Vector AI: Thu giọng nói trực tiếp, gửi vào Room cho @agent_manager và phát giọng nói LLM Streaming thời gian thực qua loa I2S.",
    },
    {
        "id": "esp32",
        "name": "ESP32-WROOM-32D (Standard Rover & IoT)",
        "architecture": "Dual-core Xtensa LX6 @ 240MHz",
        "ram_kb": 520,
        "psram_mb": 0,
        "flash_mb": 4,
        "connectivity": ["wifi", "ble", "ip", "esp_now"],
        "transports": ["sse", "websocket", "mqtt", "http", "esp_now"],
        "language": "cpp_arduino",
        "audio_hardware": "I2S DAC MAX98357A (GPIO 25,26,22) + HC-SR04 + L298N Motor",
        "description": "Vi điều khiển WiFi + Bluetooth 4.2 kinh điển cho Robot xe tự hành 4 bánh, cảm biến siêu âm HC-SR04 và giao tiếp trực tiếp với các Agent trong Room.",
    },
    {
        "id": "esp32_cam",
        "name": "AI-Thinker ESP32-CAM (OV2640 + 4MB PSRAM)",
        "architecture": "Dual-core Xtensa LX6 + OV2640 2MP Camera",
        "ram_kb": 520,
        "psram_mb": 4,
        "flash_mb": 4,
        "connectivity": ["wifi", "ip", "esp_now"],
        "transports": ["sse", "websocket", "mqtt", "http", "esp_now"],
        "language": "cpp_arduino",
        "audio_hardware": "UART/I2S Out + Camera Frame Capture",
        "description": "Tích hợp Camera OV2640 và 4MB PSRAM, cho phép chụp ảnh hiện trường gửi vào Room để @agent_manager và @agent_analysis phân tích.",
    },
    {
        "id": "raspberry_pi",
        "name": "Raspberry Pi 4B / 5 (Linux Embodied Agent)",
        "architecture": "Quad-core ARM Cortex-A72/A76 (64-bit)",
        "ram_kb": 4194304,
        "psram_mb": 0,
        "flash_mb": 32768,
        "connectivity": ["wifi", "ble", "ip"],
        "transports": ["sse", "websocket", "mqtt", "http"],
        "language": "python",
        "audio_hardware": "USB Conference Mic + 3.5mm/HDMI/I2S Speaker + Pi Camera",
        "description": "Máy tính nhúng chạy Linux đầy đủ, hỗ trợ Whisper STT + Piper/Edge TTS kết nối luồng SSE/WebSocket trực tiếp vào Room Multi-Agent.",
    },
    {
        "id": "jetson",
        "name": "NVIDIA Jetson Orin Nano (Edge AI & ROS2)",
        "architecture": "6-core ARM Cortex-A78AE + 1024-core NVIDIA Ampere GPU",
        "ram_kb": 8388608,
        "psram_mb": 0,
        "flash_mb": 65536,
        "connectivity": ["wifi", "ble", "ip"],
        "transports": ["sse", "websocket", "mqtt", "http"],
        "language": "python",
        "audio_hardware": "ReSpeaker 4-Mic Array + CUDA TTS + LiDAR SLAM",
        "description": "Siêu máy tính nhúng Edge AI 40 TOPS hỗ trợ chạy đồng thời LLM cục bộ và đồng bộ đa Agent thời gian thực với Room 3D.",
    },
]

SUPPORTED_CONNECTIONS: List[Dict[str, Any]] = [
    {
        "id": "wifi",
        "name": "Wi-Fi (802.11 b/g/n - No Power Save)",
        "description": "Kết nối WiFi băng tần 2.4GHz/5GHz với chế độ WIFI_PS_NONE giúp giảm độ trễ gói tin LLM Stream xuống dưới 15ms.",
        "fields": ["ssid", "password", "channel", "auto_reconnect", "power_save_mode"],
    },
    {
        "id": "ble",
        "name": "Bluetooth Low Energy (BLE 5.0 GATT Stream)",
        "description": "Truyền tải qua GATT Service/Characteristic với MTU 512 bytes cho thiết bị di động hoặc Gateway BLE gần kề.",
        "fields": ["device_name", "mac_address", "service_uuid", "tx_char_uuid", "rx_char_uuid", "mtu_size"],
    },
    {
        "id": "ip",
        "name": "Static IP / Direct LAN Socket",
        "description": "Cấu hình địa chỉ IP tĩnh, Subnet, Gateway và kết nối trực tiếp tới IP LAN của máy chủ Multi-Agent.",
        "fields": ["mode", "local_ip", "gateway_ip", "subnet_mask", "dns_primary", "server_host", "server_port"],
    },
]

SUPPORTED_TRANSPORTS: List[Dict[str, Any]] = [
    {
        "id": "sse",
        "name": "SSE (Server-Sent Events - LLM Token Stream)",
        "latency": "Ultra-Low (~25ms TTFT)",
        "recommended": True,
        "description": "Truyền tải từng từ (token-by-token) từ @agent_manager và các Agent con trong Room về thẳng bộ phát giọng nói I2S của ESP32/ESP32-S3 ngay khi LLM đang sinh chữ.",
    },
    {
        "id": "websocket",
        "name": "WebSocket (Full-Duplex Bi-Directional)",
        "latency": "Very Low (~30ms)",
        "recommended": True,
        "description": "Kênh song công toàn phần: vừa đẩy dữ liệu cảm biến/giọng nói lên Room, vừa nhận stream token LLM và lệnh điều khiển động cơ tức thì.",
    },
    {
        "id": "mqtt",
        "name": "MQTT Pub/Sub (IoT Broker Queue)",
        "latency": "Low (~45ms)",
        "recommended": False,
        "description": "Giao tiếp qua MQTT Broker với các Topic riêng cho Prompt, Stream Token, Lệnh Động cơ và Telemetry cảm biến.",
    },
    {
        "id": "esp_now",
        "name": "ESP-NOW (Direct 2.4GHz Peer-to-Peer Mesh)",
        "latency": "Real-time (<3ms RF)",
        "recommended": True,
        "description": "Truyền khung dữ liệu 240-byte trực tiếp giữa các chip ESP32/ESP32-S3 qua sóng 2.4GHz không cần Router WiFi trung gian.",
    },
    {
        "id": "http",
        "name": "HTTP REST (Request / Response)",
        "latency": "Standard (~120ms)",
        "recommended": False,
        "description": "Giao thức chuẩn HTTP POST/GET đơn giản, tương thích mọi thư viện HTTPClient cơ bản.",
    },
]


def _ip_to_comma(ip_str: str, fallback: str = "192, 168, 1, 188") -> str:
    parts = [p.strip() for p in (ip_str or "").split(".") if p.strip().isdigit()]
    if len(parts) == 4:
        return ", ".join(parts)
    return fallback


def generate_firmware_code(req: GenerateFirmwareRequest) -> Dict[str, Any]:
    profile = req.connection_profile or ConnectionProfile(
        connection_type=req.connection_type,
        transport_protocol=req.transport_protocol,
    )
    conn_type = profile.connection_type or req.connection_type or "wifi"
    transport = profile.transport_protocol or req.transport_protocol or "sse"
    board = (req.board_type or "esp32_s3").lower()
    sub_agents_str = ", ".join(f"@{a}" for a in (req.active_sub_agents or ["agent_search", "agent_calculate", "agent_analysis"]))

    if board in ("raspberry_pi", "jetson"):
        code = _generate_python_edge_firmware(req, profile, conn_type, transport, sub_agents_str)
        filename = f"{board}_{req.agent_id}_{transport}_firmware.py"
        language = "python"
    else:
        code = _generate_esp32_cpp_firmware(req, profile, conn_type, transport, sub_agents_str)
        filename = f"{board}_{req.agent_id}_{conn_type}_{transport}.ino"
        language = "cpp"

    return {
        "board_type": board,
        "agent_id": req.agent_id,
        "agent_name": req.agent_name,
        "room_id": req.room_id,
        "connection_type": conn_type,
        "transport_protocol": transport,
        "language": language,
        "filename": filename,
        "code": code,
        "instructions": [
            f"1. Mở Arduino IDE 2.x hoặc PlatformIO, chọn bo mạch '{board.upper()}' (với ESP32-S3 hãy bật 'PSRAM: OPI PSRAM').",
            "2. Cài đặt thư viện: ArduinoJson (v7+), WebSocketsClient (nếu dùng WebSocket), PubSubClient (nếu dùng MQTT), ESP32-audioI2S (nếu phát loa I2S MAX98357A).",
            f"3. Cấu hình Kết nối hiện tại: [{conn_type.upper()}] | Giao thức truyền tải: [{transport.upper()}] | Gắn với Room: '{req.room_id}'.",
            f"4. Khi bạn nói vào Mic (hoặc gửi câu hỏi qua Serial/Button) ví dụ: 'Thời tiết hôm nay thế nào?', mạch sẽ gửi vào Room cho @{req.agent_id}, @{req.agent_id} điều phối ({sub_agents_str}) và truyền stream từng từ (token) về mạch để nói ra loa ngay lập tức!",
        ],
    }


def _generate_esp32_cpp_firmware(
    req: GenerateFirmwareRequest,
    profile: ConnectionProfile,
    conn_type: str,
    transport: str,
    sub_agents_str: str,
) -> str:
    ssid = profile.wifi.ssid if profile and profile.wifi.ssid else req.wifi_ssid
    password = profile.wifi.password if profile and profile.wifi.password else req.wifi_password
    server_url = req.server_url.rstrip("/")
    if server_url.startswith("ws://"):
        http_base = "http://" + server_url[5:].split("/api/")[0]
    elif server_url.startswith("wss://"):
        http_base = "https://" + server_url[6:].split("/api/")[0]
    else:
        http_base = server_url.split("/api/")[0]

    is_s3 = "s3" in req.board_type.lower()
    board_label = "ESP32-S3 AI Voice & Robotics" if is_s3 else "ESP32 Embodied Robot"

    # Connection setup block
    if conn_type == "ip":
        local_ip_c = _ip_to_comma(profile.ip.local_ip, "192, 168, 1, 188")
        gw_ip_c = _ip_to_comma(profile.ip.gateway_ip, "192, 168, 1, 1")
        subnet_c = _ip_to_comma(profile.ip.subnet_mask, "255, 255, 255, 0")
        dns_c = _ip_to_comma(profile.ip.dns_primary, "8, 8, 8, 8")
        conn_setup_code = f"""
// ─── CẤU HÌNH STATIC IP & MẠNG LAN TRỰC TIẾP ──────────────────────────────
IPAddress local_IP({local_ip_c});
IPAddress gateway({gw_ip_c});
IPAddress subnet({subnet_c});
IPAddress primaryDNS({dns_c});

void setupConnection() {{
  WiFi.mode(WIFI_STA);
  esp_wifi_set_ps(WIFI_PS_NONE); // Tắt ngủ WiFi để nhận LLM stream tức thì
  if (!WiFi.config(local_IP, gateway, subnet, primaryDNS)) {{
    Serial.println("[NET_IP] ⚠️ Lỗi cấu hình Static IP, chuyển sang DHCP...");
  }}
  WiFi.begin("{ssid}", "{password}");
  Serial.print("[NET_IP] Đang kết nối mạng LAN ");
  while (WiFi.status() != WL_CONNECTED) {{
    delay(350);
    Serial.print(".");
  }}
  Serial.println("\\n[NET_IP] ✅ Đã kết nối! Static IP: " + WiFi.localIP().toString());
}}
"""
    elif conn_type == "ble":
        conn_setup_code = f"""
// ─── CẤU HÌNH BLUETOOTH LOW ENERGY (BLE 5.0 GATT STREAMING) ───────────────
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define BLE_SERVICE_UUID        "{profile.ble.service_uuid}"
#define BLE_TX_STREAM_CHAR_UUID "{profile.ble.tx_char_uuid}"
#define BLE_RX_PROMPT_CHAR_UUID "{profile.ble.rx_char_uuid}"

BLEServer* pServer = nullptr;
BLECharacteristic* pTxStreamChar = nullptr;
bool bleClientConnected = false;
String pendingVoicePrompt = "";

class AgentBleServerCallbacks : public BLEServerCallbacks {{
  void onConnect(BLEServer* pServer) override {{
    bleClientConnected = true;
    Serial.println("[BLE] ✅ Thiết bị trung tâm đã kết nối GATT!");
  }}
  void onDisconnect(BLEServer* pServer) override {{
    bleClientConnected = false;
    Serial.println("[BLE] ⚠️ Ngắt kết nối GATT, đang quảng bá lại...");
    BLEDevice::startAdvertising();
  }}
}};

class AgentBleRxCallbacks : public BLECharacteristicCallbacks {{
  void onWrite(BLECharacteristic* pCharacteristic) override {{
    String rxValue = pCharacteristic->getValue().c_str();
    if (rxValue.length() > 0) {{
      Serial.println("[BLE_RX] 🎙️ Nhận câu hỏi từ BLE: " + rxValue);
      pendingVoicePrompt = rxValue;
    }}
  }}
}};

void setupConnection() {{
  // Khởi tạo đồng thời BLE GATT + WiFi Bridge (để đẩy vào Room nếu có mạng)
  BLEDevice::init("{profile.ble.device_name}");
  BLEDevice::setMTU({profile.ble.mtu_size});
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new AgentBleServerCallbacks());

  BLEService *pService = pServer->createService(BLE_SERVICE_UUID);
  pTxStreamChar = pService->createCharacteristic(
    BLE_TX_STREAM_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
  );
  pTxStreamChar->addDescriptor(new BLE2902());

  BLECharacteristic *pRxPromptChar = pService->createCharacteristic(
    BLE_RX_PROMPT_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxPromptChar->setCallbacks(new AgentBleRxCallbacks());

  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] ✅ Đang phát BLE GATT '{profile.ble.device_name}' (MTU={profile.ble.mtu_size})");

  WiFi.mode(WIFI_STA);
  esp_wifi_set_ps(WIFI_PS_NONE);
  WiFi.begin("{ssid}", "{password}");
}}
"""
    else:
        conn_setup_code = f"""
// ─── CẤU HÌNH KẾT NỐI WIFI TỐC ĐỘ CAO (LOW-LATENCY STREAMING) ─────────────
void setupConnection() {{
  WiFi.mode(WIFI_STA);
  esp_wifi_set_ps(WIFI_PS_NONE); // Tắt Power-Save để stream token LLM không bị trễ
  WiFi.setAutoReconnect({str(profile.wifi.auto_reconnect).lower()});
  WiFi.begin("{ssid}", "{password}", {profile.wifi.channel});
  Serial.print("[WIFI] Đang kết nối tới '{ssid}'");
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 40) {{
    delay(350);
    Serial.print(".");
    retries++;
  }}
  if (WiFi.status() == WL_CONNECTED) {{
    Serial.println("\\n[WIFI] ✅ Đã kết nối! IP: " + WiFi.localIP().toString() + " | RSSI: " + String(WiFi.RSSI()) + " dBm");
  }} else {{
    Serial.println("\\n[WIFI] ⚠️ Chưa kết nối được WiFi, sẽ tự động thử lại trong vòng lặp.");
  }}
}}
"""

    # Transport protocol implementation block
    if transport == "sse":
        transport_code = f"""
// ─── GIAO THỨC TRUYỀN TẢI: SSE (SERVER-SENT EVENTS LLM STREAMING) ─────────
// Gửi câu nói của User vào Room -> @agent_manager điều phối ({sub_agents_str})
// -> Nhận luồng token trực tiếp (data: {{...}}) và phát ra Loa I2S ngay lập tức!
void askRoomAgentStream(const String& userPrompt) {{
  if (WiFi.status() != WL_CONNECTED) {{
    Serial.println("[SSE] ❌ Chưa có kết nối mạng để stream!");
    return;
  }}

  HTTPClient http;
  WiFiClient client;
  String streamUrl = "{http_base}/api/v1/firmware/room-stream";
  Serial.println("\\n[ROOM_BRIDGE] 🎙️ User nói: \\"" + userPrompt + "\\"");
  Serial.println("[ROOM_BRIDGE] 📡 Đang mở luồng SSE tới Room '{req.room_id}' (Agent: @{req.agent_id})...");

  http.begin(client, streamUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Accept", "text/event-stream");
  http.setTimeout(30000);

  StaticJsonDocument<512> reqDoc;
  reqDoc["prompt"] = userPrompt;
  reqDoc["room_id"] = "{req.room_id}";
  reqDoc["device_id"] = "{req.agent_name}";
  reqDoc["board_type"] = "{req.board_type}";
  reqDoc["agent_id"] = "{req.agent_id}";
  reqDoc["connection_type"] = "{conn_type}";
  reqDoc["transport_protocol"] = "sse";
  reqDoc["obstacle_distance"] = measureDistanceCm();
  reqDoc["sync_to_room_chat"] = true;

  String body;
  serializeJson(reqDoc, body);

  int httpCode = http.POST(body);
  if (httpCode != HTTP_CODE_OK) {{
    Serial.printf("[SSE] ❌ Lỗi HTTP %d\\n", httpCode);
    http.end();
    return;
  }}

  WiFiClient* stream = http.getStreamPtr();
  String lineBuffer = "";
  String fullSpeech = "";

  Serial.print("[LLM_VOICE_STREAM] 🔊 ");
  while (http.connected() || stream->available()) {{
    if (stream->available()) {{
      char c = stream->read();
      if (c == '\\n') {{
        lineBuffer.trim();
        if (lineBuffer.startsWith("data:")) {{
          String jsonPayload = lineBuffer.substring(5);
          jsonPayload.trim();
          StaticJsonDocument<1024> ev;
          if (deserializeJson(ev, jsonPayload) == DeserializationError::Ok) {{
            String evType = ev["type"] | "";
            if (evType == "agent_step") {{
              String sender = ev["agent_id"] | "agent_manager";
              String note = ev["content"] | "";
              Serial.printf("\\n  🤖 [@%s] %s\\n  🔊 ", sender.c_str(), note.c_str());
            }} else if (evType == "token") {{
              String token = ev["content"] | "";
              fullSpeech += token;
              speakTokenChunk(token); // Phát ngay từng cụm từ ra loa I2S MAX98357A
            }} else if (evType == "action") {{
              String actType = ev["action_type"] | "STOP";
              int actVal = ev["value"] | 0;
              executeHardwareAction(actType, actVal);
            }} else if (evType == "done") {{
              Serial.println("\\n[SSE_DONE] ✅ Hoàn tất phản hồi từ Room Multi-Agent!");
              break;
            }}
          }}
        }}
        lineBuffer = "";
      }} else {{
        lineBuffer += c;
      }}
    }}
    delay(1);
  }}
  http.end();
}}
"""
    elif transport == "websocket":
        ws_url = http_base.replace("https://", "wss://").replace("http://", "ws://")
        transport_code = f"""
// ─── GIAO THỨC TRUYỀN TẢI: WEBSOCKET FULL-DUPLEX STREAMING ───────────────
#include <WebSocketsClient.h>
WebSocketsClient webSocket;

void onWebSocketEvent(WStype_t type, uint8_t * payload, size_t length) {{
  switch (type) {{
    case WStype_CONNECTED:
      Serial.println("[WS] ✅ Đã kết nối kênh WebSocket thời gian thực vào Room '{req.room_id}'!");
      break;
    case WStype_TEXT: {{
      StaticJsonDocument<1024> doc;
      if (deserializeJson(doc, payload, length) == DeserializationError::Ok) {{
        String evType = doc["type"] | "";
        if (evType == "token") {{
          speakTokenChunk(String((const char*)doc["content"]));
        }} else if (evType == "action") {{
          executeHardwareAction(String((const char*)doc["action_type"]), doc["value"] | 0);
        }} else if (evType == "agent_step") {{
          Serial.printf("\\n[ROOM_AGENT] @%s: %s\\n", (const char*)doc["agent_id"], (const char*)doc["content"]);
        }}
      }}
      break;
    }}
    default:
      break;
  }}
}}

void askRoomAgentStream(const String& userPrompt) {{
  StaticJsonDocument<512> doc;
  doc["type"] = "room_prompt";
  doc["room_id"] = "{req.room_id}";
  doc["agent_id"] = "{req.agent_id}";
  doc["device_id"] = "{req.agent_name}";
  doc["prompt"] = userPrompt;
  doc["obstacle_distance"] = measureDistanceCm();
  String out;
  serializeJson(doc, out);
  webSocket.sendTXT(out);
}}
"""
    elif transport == "mqtt":
        topic_prompt = profile.mqtt.topic_prompt.format(room_id=req.room_id, device_id=req.agent_name)
        topic_stream = profile.mqtt.topic_stream.format(room_id=req.room_id, device_id=req.agent_name)
        topic_action = profile.mqtt.topic_action.format(room_id=req.room_id, device_id=req.agent_name)
        transport_code = f"""
// ─── GIAO THỨC TRUYỀN TẢI: MQTT PUB/SUB BROKER STREAMING ─────────────────
#include <PubSubClient.h>
WiFiClient espMqttNet;
PubSubClient mqttClient(espMqttNet);

const char* MQTT_BROKER = "{profile.mqtt.broker_host}";
const int   MQTT_PORT   = {profile.mqtt.broker_port};
const char* TOPIC_PROMPT = "{topic_prompt}";
const char* TOPIC_STREAM = "{topic_stream}";
const char* TOPIC_ACTION = "{topic_action}";

void onMqttMessage(char* topic, byte* payload, unsigned int length) {{
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  StaticJsonDocument<1024> doc;
  if (deserializeJson(doc, msg) == DeserializationError::Ok) {{
    String evType = doc["type"] | "";
    if (evType == "token") {{
      speakTokenChunk(doc["content"] | "");
    }} else if (evType == "action") {{
      executeHardwareAction(doc["action_type"] | "STOP", doc["value"] | 0);
    }}
  }}
}}

void askRoomAgentStream(const String& userPrompt) {{
  StaticJsonDocument<512> doc;
  doc["room_id"] = "{req.room_id}";
  doc["agent_id"] = "{req.agent_id}";
  doc["device_id"] = "{req.agent_name}";
  doc["prompt"] = userPrompt;
  String payload;
  serializeJson(doc, payload);
  mqttClient.publish(TOPIC_PROMPT, payload.c_str(), false);
  Serial.println("[MQTT] 📤 Đã gửi câu hỏi lên Topic: " + String(TOPIC_PROMPT));
}}
"""
    elif transport == "esp_now":
        peer_mac_hex = ", ".join(f"0x{b}" for b in profile.esp_now.gateway_mac.split(":")) if ":" in profile.esp_now.gateway_mac else "0x30, 0xAE, 0xA4, 0x07, 0x0D, 0x64"
        transport_code = f"""
// ─── GIAO THỨC TRUYỀN TẢI: ESP-NOW MESH ĐỘ TRỄ CỰC THẤP (<2ms) ───────────
#include <esp_now.h>

uint8_t gatewayBridgeMac[] = {{ {peer_mac_hex} }};

// Khung truyền tải LLM Stream qua ESP-NOW (tối đa 250 bytes/frame)
typedef struct struct_espnow_llm_frame {{
  uint16_t seq_id;
  uint16_t total_frames;
  uint8_t  frame_type;     // 0=PROMPT, 1=LLM_TOKEN, 2=ROBOT_ACTION, 3=SUBAGENT_TRACE
  int16_t  action_value;
  char     agent_id[24];
  char     action_type[16];
  char     text_chunk[180];
}} __attribute__((packed)) espnow_llm_frame_t;

void OnEspNowDataRecv(const uint8_t * mac, const uint8_t *incomingData, int len) {{
  if (len < (int)sizeof(espnow_llm_frame_t)) return;
  espnow_llm_frame_t frame;
  memcpy(&frame, incomingData, sizeof(frame));

  if (frame.frame_type == 1) {{
    // Token giọng nói được stream từ @agent_manager trong Room
    speakTokenChunk(String(frame.text_chunk));
  }} else if (frame.frame_type == 2) {{
    executeHardwareAction(String(frame.action_type), frame.action_value);
  }} else if (frame.frame_type == 3) {{
    Serial.printf("\\n[ESP-NOW ROOM] @%s -> %s\\n", frame.agent_id, frame.text_chunk);
  }}
}}

void setupEspNowMesh() {{
  if (esp_now_init() != ESP_OK) {{
    Serial.println("[ESP-NOW] ❌ Lỗi khởi tạo ESP-NOW!");
    return;
  }}
  esp_now_register_recv_cb(OnEspNowDataRecv);
  esp_now_peer_info_t peerInfo = {{}};
  memcpy(peerInfo.peer_addr, gatewayBridgeMac, 6);
  peerInfo.channel = {profile.esp_now.wifi_channel};
  peerInfo.encrypt = {str(profile.esp_now.encrypted).lower()};
  esp_now_add_peer(&peerInfo);
  Serial.println("[ESP-NOW] ✅ Đã sẵn sàng nhận luồng LLM Token tốc độ cao qua ESP-NOW!");
}}

void askRoomAgentStream(const String& userPrompt) {{
  espnow_llm_frame_t frame = {{}};
  frame.seq_id = 1;
  frame.total_frames = 1;
  frame.frame_type = 0; // 0 = User Voice Prompt gửi vào Room
  strncpy(frame.agent_id, "{req.agent_id}", sizeof(frame.agent_id) - 1);
  strncpy(frame.text_chunk, userPrompt.c_str(), sizeof(frame.text_chunk) - 1);
  esp_now_send(gatewayBridgeMac, (uint8_t*)&frame, sizeof(frame));
  Serial.println("[ESP-NOW] 📡 Đã bắn gói tin câu hỏi tới Gateway Bridge Node: " + userPrompt);
}}
"""
    else:
        transport_code = f"""
// ─── GIAO THỨC TRUYỀN TẢI: HTTP REST BRIDGE ──────────────────────────────
void askRoomAgentStream(const String& userPrompt) {{
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin("{http_base}/api/v1/firmware/http/chat");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<512> reqDoc;
  reqDoc["prompt"] = userPrompt;
  reqDoc["room_id"] = "{req.room_id}";
  reqDoc["agent_id"] = "{req.agent_id}";
  reqDoc["device_id"] = "{req.agent_name}";
  String payload;
  serializeJson(reqDoc, payload);

  int code = http.POST(payload);
  if (code == 200) {{
    StaticJsonDocument<2048> resDoc;
    deserializeJson(resDoc, http.getString());
    String speech = resDoc["response_message"] | "";
    speakTokenChunk(speech);
    JsonArray actions = resDoc["actions"].as<JsonArray>();
    for (JsonObject act : actions) {{
      executeHardwareAction(act["type"] | "STOP", act["value"] | 0);
    }}
  }}
  http.end();
}}
"""

    return f"""// ============================================================================
// 🤖 MULTI-AGENT EMBODIED FIRMWARE — {board_label.upper()}
// • Thiết bị      : {req.agent_name} ({req.board_type})
// • Room kết nối  : {req.room_id}
// • Agent chỉ huy : @{req.agent_id} (Phối hợp: {sub_agents_str})
// • Kiểu kết nối  : {conn_type.upper()}
// • Truyền tải    : {transport.upper()} (Real-time LLM Voice & Action Stream)
// ============================================================================

#include <WiFi.h>
#include <esp_wifi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ─── CẤU HÌNH CHÂN GPIO ĐỘNG CƠ L298N & CẢM BIẾN SIÊU ÂM HC-SR04 ─────────
#define MOTOR_IN1  26
#define MOTOR_IN2  27
#define MOTOR_IN3  14
#define MOTOR_IN4  12
#define TRIG_PIN   5
#define ECHO_PIN   18
#define STATUS_LED 2

// ─── CẤU HÌNH I2S AUDIO (MIC INMP441 & LOA MAX98357A CHO ESP32 / ESP32-S3) ─
#define I2S_MIC_SCK   4
#define I2S_MIC_WS    5
#define I2S_MIC_SD    6
#define I2S_SPK_BCLK  15
#define I2S_SPK_LRC   16
#define I2S_SPK_DOUT  17
#define BOOT_BTN_PIN  0

String ttsSentenceBuffer = "";

// ─── HÀM ĐO KHOẢNG CÁCH VẬT CẢN (HC-SR04) ─────────────────────────────────
long measureDistanceCm() {{
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 25000);
  if (duration == 0) return 200;
  return duration * 0.034 / 2;
}}

// ─── HÀM PHÁT GIỌNG NÓI STREAMING TỪNG CỤM TỪ (LLM TOKEN -> I2S TTS) ─────
void speakTokenChunk(const String& token) {{
  Serial.print(token);
  ttsSentenceBuffer += token;
  // Khi gặp dấu ngắt câu (., !, ?, \\n) hoặc đủ cụm từ -> đẩy ngay vào bộ đệm đọc I2S TTS
  if (token.indexOf('.') >= 0 || token.indexOf('!') >= 0 || token.indexOf('?') >= 0 ||
      token.indexOf(',') >= 0 || ttsSentenceBuffer.length() >= 48) {{
    // TODO: Gắn hàm audio.connecttospeech(ttsSentenceBuffer.c_str(), "vi") nếu dùng ESP32-audioI2S
    ttsSentenceBuffer = "";
  }}
}}

// ─── HÀM THỰC THI LỆNH ĐIỀU KHIỂN PHẦN CỨNG ROBOT ────────────────────────
void executeHardwareAction(const String& actionType, int value) {{
  Serial.printf("\\n[HARDWARE_ACT] ⚡ %s (value=%d)\\n", actionType.c_str(), value);
  if (actionType == "FORWARD") {{
    digitalWrite(MOTOR_IN1, HIGH); digitalWrite(MOTOR_IN2, LOW);
    digitalWrite(MOTOR_IN3, HIGH); digitalWrite(MOTOR_IN4, LOW);
  }} else if (actionType == "BACKWARD") {{
    digitalWrite(MOTOR_IN1, LOW);  digitalWrite(MOTOR_IN2, HIGH);
    digitalWrite(MOTOR_IN3, LOW);  digitalWrite(MOTOR_IN4, HIGH);
  }} else if (actionType == "TURN_LEFT") {{
    digitalWrite(MOTOR_IN1, LOW);  digitalWrite(MOTOR_IN2, HIGH);
    digitalWrite(MOTOR_IN3, HIGH); digitalWrite(MOTOR_IN4, LOW);
  }} else if (actionType == "TURN_RIGHT" || actionType == "ROTATE_360") {{
    digitalWrite(MOTOR_IN1, HIGH); digitalWrite(MOTOR_IN2, LOW);
    digitalWrite(MOTOR_IN3, LOW);  digitalWrite(MOTOR_IN4, HIGH);
  }} else if (actionType == "STOP") {{
    digitalWrite(MOTOR_IN1, LOW);  digitalWrite(MOTOR_IN2, LOW);
    digitalWrite(MOTOR_IN3, LOW);  digitalWrite(MOTOR_IN4, LOW);
  }}
}}
{conn_setup_code}
{transport_code}
void setup() {{
  Serial.begin(115200);
  pinMode(MOTOR_IN1, OUTPUT); pinMode(MOTOR_IN2, OUTPUT);
  pinMode(MOTOR_IN3, OUTPUT); pinMode(MOTOR_IN4, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);  pinMode(ECHO_PIN, INPUT);
  pinMode(STATUS_LED, OUTPUT);
  pinMode(BOOT_BTN_PIN, INPUT_PULLUP);

  Serial.println("============================================================");
  Serial.println("🚀 KHỞI ĐỘNG AGENT FIRMWARE: {req.agent_name} ({req.board_type})");
  Serial.println("🏠 Room: {req.room_id} | Chỉ huy: @{req.agent_id}");
  Serial.println("🔗 Kết nối: {conn_type.upper()} | Giao thức: {transport.upper()}");
  Serial.println("============================================================");

  setupConnection();
  {"setupEspNowMesh();" if transport == "esp_now" else ""}

  // Ví dụ tự động chào Room và kiểm tra thời tiết khi vừa bật nguồn:
  delay(800);
  askRoomAgentStream("Thời tiết hôm nay thế nào? Hãy nhờ các agent trong phòng kiểm tra giúp tôi.");
}}

void loop() {{
  // 1. Nhập câu hỏi trực tiếp từ cổng Serial (hoặc module nhận diện giọng nói I2S STT)
  if (Serial.available()) {{
    String userVoiceQuery = Serial.readStringUntil('\\n');
    userVoiceQuery.trim();
    if (userVoiceQuery.length() > 0) {{
      askRoomAgentStream(userVoiceQuery);
    }}
  }}

  // 2. Nhấn nút BOOT (GPIO 0) trên mạch ESP32/ESP32-S3 để hỏi nhanh
  if (digitalRead(BOOT_BTN_PIN) == LOW) {{
    delay(250);
    askRoomAgentStream("Thời tiết hôm nay thế nào và có lời khuyên gì cho lịch trình trong phòng không?");
  }}

  // 3. Phản xạ an toàn phần cứng: tự động phanh nếu có vật cản < 20cm
  long dist = measureDistanceCm();
  if (dist < 20) {{
    executeHardwareAction("STOP", 0);
  }}

  delay(20);
}}
"""


def _generate_python_edge_firmware(
    req: GenerateFirmwareRequest,
    profile: ConnectionProfile,
    conn_type: str,
    transport: str,
    sub_agents_str: str,
) -> str:
    http_base = req.server_url.rstrip("/").split("/api/")[0]
    return f'''#!/usr/bin/env python3
"""
🤖 Multi-Agent Embodied Edge Client ({req.board_type.upper()})
- Device Name : {req.agent_name}
- Target Room : {req.room_id}
- Lead Agent  : @{req.agent_id} (Sub-agents: {sub_agents_str})
- Connection  : {conn_type.upper()} | Transport: {transport.upper()}
"""

import json
import sys
import httpx

SERVER_BASE = "{http_base}"
ROOM_ID = "{req.room_id}"
AGENT_ID = "{req.agent_id}"
DEVICE_ID = "{req.agent_name}"


def stream_room_conversation(prompt: str) -> None:
    url = f"{{SERVER_BASE}}/api/v1/firmware/room-stream"
    payload = {{
        "prompt": prompt,
        "room_id": ROOM_ID,
        "device_id": DEVICE_ID,
        "board_type": "{req.board_type}",
        "agent_id": AGENT_ID,
        "connection_type": "{conn_type}",
        "transport_protocol": "{transport}",
        "sync_to_room_chat": True,
    }}
    print(f"\\n🎙️ [User -> Room '{{ROOM_ID}}']: {{prompt}}")
    with httpx.Client(timeout=60.0) as client:
        with client.stream("POST", url, json=payload) as resp:
            for line in resp.iter_lines():
                if not line or not line.startswith("data:"):
                    continue
                event = json.loads(line[5:].strip())
                ev_type = event.get("type")
                if ev_type == "agent_step":
                    print(f"\\n🤖 [@{{event.get('agent_id')}}] {{event.get('content')}}")
                elif ev_type == "token":
                    sys.stdout.write(event.get("content", ""))
                    sys.stdout.flush()
                elif ev_type == "action":
                    print(f"\\n⚡ [ACTION] {{event.get('action_type')}} ({{event.get('value')}})")
                elif ev_type == "done":
                    print("\\n✅ [Hoàn tất đồng bộ Room & Phát giọng nói]")


if __name__ == "__main__":
    stream_room_conversation("Thời tiết hôm nay thế nào?")
'''

