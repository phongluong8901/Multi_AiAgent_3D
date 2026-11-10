"""
Script kiểm thử tự động toàn bộ các API trong test-apis.http
Cách chạy:
    python run_test_apis.py
"""

import urllib.request
import urllib.error
import json
import time

GATEWAY_URL = "http://localhost:4000"
results = []
jwt_token = None
created_room_id = None

def send_request(name, method, path, body=None, use_auth=True):
    global jwt_token
    url = f"{GATEWAY_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if use_auth and jwt_token:
        headers["Authorization"] = f"Bearer {jwt_token}"

    data_bytes = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)

    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8")
            elapsed = int((time.time() - start_time) * 1000)
            try:
                data = json.loads(raw)
            except Exception:
                data = raw[:150]
            print(f" [PASS] {name:<45} | HTTP {status:<3} | {elapsed:>4}ms")
            results.append({"name": name, "status": status, "ok": True, "data": data})
            return status, data
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        elapsed = int((time.time() - start_time) * 1000)
        try:
            data = json.loads(raw)
        except Exception:
            data = raw[:150]
        # Một số endpoint trả về 409 khi đã tồn tại (ví dụ register đã có user) thì vẫn coi như logic hoạt động
        is_acceptable = e.code in [200, 201] or (status_code := getattr(e, "code", 0)) in [409]
        prefix = "[PASS]" if is_acceptable else "[FAIL]"
        print(f" {prefix} {name:<45} | HTTP {e.code:<3} | {elapsed:>4}ms | {str(data)[:60]}")
        results.append({"name": name, "status": e.code, "ok": is_acceptable, "error": data})
        return e.code, data
    except Exception as e:
        elapsed = int((time.time() - start_time) * 1000)
        print(f" [ERR ] {name:<45} | ERROR   | {elapsed:>4}ms | {str(e)[:60]}")
        results.append({"name": name, "status": 0, "ok": False, "error": str(e)})
        return 0, str(e)

def main():
    global jwt_token, created_room_id
    print("=" * 80)
    print(" BẮT ĐẦU KIỂM THỬ MICROSERVICES MULTI-AGENT QUA API GATEWAY (PORT 4000)")
    print("=" * 80)

    # 0. Gateway Health
    send_request("0. API Gateway Health Check", "GET", "/", use_auth=False)
    send_request("0.1. Danh sách AI Models", "GET", "/api/v1/models", use_auth=False)

    # 1. Đăng ký user
    send_request("1. [User Service] Đăng ký tài khoản", "POST", "/api/v1/users/register", {
        "username": "phongluong_test",
        "email": "phongluong_test@example.com",
        "password": "Password123@",
        "role": "admin"
    }, use_auth=False)

    # 2. Đăng nhập
    st, res = send_request("2. [User Service] Đăng nhập", "POST", "/api/v1/users/login", {
        "email": "phongluong_test@example.com",
        "password": "Password123@"
    }, use_auth=False)
    if isinstance(res, dict):
        jwt_token = res.get("data", {}).get("token") or res.get("token")

    # 3. Danh sách Users
    send_request("3. [User Service] Danh sách Users", "GET", "/api/v1/users")

    # 4. Tạo phòng họp
    st, res = send_request("4. [Room Service] Tạo phòng họp mới", "POST", "/api/v1/rooms/user-user", {
        "name": "Virtual Office Main Hall Test",
        "description": "Phong hop tong quan 3D Multi-Agent",
        "maxCapacity": 20
    })
    if isinstance(res, dict):
        created_room_id = res.get("data", {}).get("_id") or res.get("data", {}).get("id") or res.get("_id")

    room_id = created_room_id or "room_test_123"

    # 5. Danh sách phòng & chi tiết
    send_request("5. [Room Service] Lấy danh sách phòng", "GET", "/api/v1/rooms/user-user")
    send_request("5.1. [Room Service] Chi tiết phòng", "GET", f"/api/v1/rooms/user-user/{room_id}")

    # 5.2. Cập nhật Workflow Tuần tự
    send_request("5.2. [Room Service] Cập nhật Workflow", "PUT", f"/api/v1/rooms/user-user/{room_id}/workflow", {
        "mode": "sequential",
        "enabled": True,
        "description": "Quy trinh phan tich gia vang va ve bieu do",
        "order": ["agent_manager", "agent_search", "agent_visualize"],
        "stepTools": {
            "0": "workflow_planner_tool",
            "1": "web_search_tool",
            "2": "data_visualization_tool"
        },
        "agentTools": {
            "agent_manager": ["workflow_planner_tool", "system_control_tool"],
            "agent_visualize": ["data_visualization_tool", "data_analysis_tool"]
        }
    })

    # 6. Lịch sử chat
    send_request("6. [Chat Service] Lấy lịch sử chat", "GET", f"/api/v1/chats/history/{room_id}")

    # 7 & 7.1. Tạo Tools
    send_request("7. [Agent Service] Tạo Tool calculator", "POST", "/api/v1/tools", {
        "id": "calculator_tool",
        "name": "Calculator",
        "description": "Cong cu tinh toan so hoc co ban"
    }, use_auth=False)

    send_request("7.1. [Agent Service] Tạo Tool visualizer", "POST", "/api/v1/tools", {
        "id": "data_visualization_tool",
        "name": "Data Visualization",
        "description": "Ve bieu do truc quan Line, Bar, Pie, Area"
    }, use_auth=False)

    # 8. Danh sách Tools
    send_request("8. [Agent Service] Danh sách Tools", "GET", "/api/v1/tools", use_auth=False)

    # 9 & 10. Prompts
    send_request("9. [Agent Service] Tạo Prompt", "POST", "/api/v1/prompts", {
        "id": "assistant_prompt",
        "title": "Tro ly ao",
        "content": "Ban la mot tro ly AI trong khong gian 3D chuyen nghiep."
    }, use_auth=False)
    send_request("10. [Agent Service] Danh sách Prompts", "GET", "/api/v1/prompts", use_auth=False)

    # 11 & 12. Agents
    send_request("11. [Agent Service] Tạo Agent mới", "POST", "/api/v1/agents", {
        "id": "agent_alpha",
        "name": "Agent Alpha 3D",
        "color": "#3182ce",
        "status": "idle",
        "speech": "Xin chao! Toi la Agent Alpha.",
        "pos_x": 0.0,
        "pos_y": 1.0,
        "pos_z": 0.0,
        "prompt_id": "assistant_prompt",
        "tool_ids": ["calculator_tool"]
    }, use_auth=False)
    send_request("12. [Agent Service] Danh sách Agents", "GET", "/api/v1/agents", use_auth=False)

    # 13. Đồng bộ Agent vào Room
    send_request("13. [Room Service] Đồng bộ Agent vào Room", "POST", f"/api/v1/rooms/agent-agent/{room_id}/agents", {
        "activeAgents": ["agent_manager", "agent_search", "agent_visualize", "agent_analyst"]
    })

    # 14, 15, 16. Chat & Presence
    send_request("14. [Chat Service] Hiện diện trong Room", "GET", f"/api/v1/chats/presence/{room_id}")
    send_request("15. [Chat Service] Gửi lệnh chat cho Agent", "POST", "/api/v1/chats/send", {
        "roomId": room_id,
        "senderId": "user_alice",
        "senderName": "Alice",
        "senderType": "user",
        "message": "@agent_manager tim cho t gia vang hom nay"
    })
    send_request("16. [Chat Service] Cập nhật User Presence", "POST", f"/api/v1/chats/presence/{room_id}", {
        "user": {
            "id": "user_bob",
            "name": "Bob Developer",
            "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=bob",
            "color": "#10b981"
        }
    })

    # 17, 18, 19, 20. User Profile & Agent Ownership
    send_request("17. [User Service] Profile cá nhân", "GET", "/api/v1/users/me")
    send_request("18. [User Service] Cập nhật Profile", "PUT", "/api/v1/users/me", {
        "name": "Phong Luong Senior AI",
        "bio": "Lead Multi-Agent Architecture",
        "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=PhongLuong"
    })
    send_request("19. [User Service] Danh sách Agent của User", "GET", "/api/v1/users/me/agents")
    send_request("20. [User Service] Đăng ký sở hữu Agent", "POST", "/api/v1/users/me/agents/agent_ml")

    # 21, 22. Thêm & Rút Agent khỏi Room
    send_request("21. [Room Service] Thêm 1 Agent vào Room", "POST", f"/api/v1/rooms/agent-agent/{room_id}/agents/agent_ml")
    send_request("22. [Room Service] Rút 1 Agent khỏi Room", "DELETE", f"/api/v1/rooms/agent-agent/{room_id}/agents/agent_ml")

    # 23, 24. User-Agent Binding
    send_request("23. [Room Service] Gán Agent cho User", "POST", f"/api/v1/rooms/user-agent/{room_id}/user-agents", {
        "userId": "user_alice",
        "userName": "Alice Leader",
        "userColor": "#3b82f6",
        "agentId": "agent_ml",
        "agentName": "ML Expert"
    })
    send_request("24. [Room Service] Hủy gán Agent trong Room", "DELETE", f"/api/v1/rooms/user-agent/{room_id}/user-agents/agent_ml")

    # Tổng kết
    print("=" * 80)
    passed = sum(1 for r in results if r["ok"])
    failed = sum(1 for r in results if not r["ok"])
    print(f" KẾT QUẢ KIỂM THỬ: {passed}/{len(results)} CASES ĐẠT (PASS) | THẤT BẠI: {failed}")
    print("=" * 80)

if __name__ == "__main__":
    main()
