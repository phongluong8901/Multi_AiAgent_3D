import { useState, useEffect } from "react";

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [token, setToken] = useState("token_nguoi_dung_abc123");
  const [cpuCores, setCpuCores] = useState(4);
  const [ramGb, setRamGb] = useState(8);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    let timer: number; // Đã đổi từ NodeJS.Timeout sang number
    if (isRunning) {
      timer = window.setInterval(() => {
        setUptime((prev) => prev + 1);
      }, 1000);
    } else {
      setUptime(0);
    }
    return () => clearInterval(timer);
  }, [isRunning]);

  const formatUptime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#050811",
        backgroundImage:
          "radial-gradient(circle at 50% 0%, #1e1b4b 0%, #050811 70%)",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: "#f8fafc",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${isRunning ? "rgba(56, 189, 248, 0.4)" : "rgba(51, 65, 85, 0.6)"
            }`,
          borderRadius: "20px",
          padding: "28px",
          boxShadow: isRunning
            ? "0 0 30px rgba(56, 189, 248, 0.15), 0 20px 25px -5px rgba(0, 0, 0, 0.5)"
            : "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          transition: "all 0.3s ease",
        }}
      >
        {/* Header Dashboard */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "rgba(56, 189, 248, 0.1)",
                padding: "8px",
                borderRadius: "10px",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "17px",
                  fontWeight: "700",
                  letterSpacing: "0.5px",
                  background: "linear-gradient(90deg, #38bdf8, #818cf8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AI COMPUTE WORKER
              </h2>
              <p
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "11px",
                  color: "#64748b",
                }}
              >
                Decentralized Edge Node Hub
              </p>
            </div>
          </div>

          {/* Trạng thái chấm đèn */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(30, 41, 59, 0.8)",
              padding: "6px 12px",
              borderRadius: "20px",
              border: "1px solid rgba(51, 65, 85, 0.5)",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                backgroundColor: isRunning ? "#22c55e" : "#64748b",
                boxShadow: isRunning ? "0 0 10px #22c55e" : "none",
                transition: "all 0.3s",
              }}
            ></span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: isRunning ? "#4ade80" : "#94a3b8",
                letterSpacing: "0.5px",
              }}
            >
              {isRunning ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Khung Token */}
        <div style={{ marginBottom: "18px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "8px",
              fontSize: "11px",
              fontWeight: "600",
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Mã Token Định Danh
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isRunning}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid rgba(51, 65, 85, 0.8)",
              background: "rgba(3, 7, 18, 0.6)",
              color: "#f1f5f9",
              boxSizing: "border-box",
              fontSize: "13px",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) =>
            ((e.currentTarget as HTMLInputElement).style.borderColor =
              "#38bdf8")
            }
            onBlur={(e) =>
            ((e.currentTarget as HTMLInputElement).style.borderColor =
              "rgba(51, 65, 85, 0.8)")
            }
          />
        </div>

        {/* Slider CPU */}
        <div style={{ marginBottom: "18px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
              fontSize: "11px",
              fontWeight: "600",
            }}
          >
            <span
              style={{
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                <rect x="9" y="9" width="6" height="6"></rect>
                <line x1="9" y1="1" x2="9" y2="4"></line>
                <line x1="15" y1="1" x2="15" y2="4"></line>
                <line x1="9" y1="20" x2="9" y2="23"></line>
                <line x1="15" y1="20" x2="15" y2="23"></line>
                <line x1="20" y1="9" x2="23" y2="9"></line>
                <line x1="20" y1="15" x2="23" y2="15"></line>
                <line x1="1" y1="9" x2="4" y2="9"></line>
                <line x1="1" y1="15" x2="4" y2="15"></line>
              </svg>
              Core CPU Chia Sẻ
            </span>
            <span
              style={{
                color: "#38bdf8",
                background: "rgba(56, 189, 248, 0.1)",
                padding: "2px 8px",
                borderRadius: "6px",
                border: "1px solid rgba(56, 189, 248, 0.2)",
              }}
            >
              {cpuCores} Cores
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="16"
            value={cpuCores}
            disabled={isRunning}
            onChange={(e) => setCpuCores(Number(e.target.value))}
            style={{
              width: "100%",
              accentColor: "#38bdf8",
              cursor: isRunning ? "not-allowed" : "pointer",
              height: "6px",
              background: "#1e293b",
              borderRadius: "3px",
            }}
          />
        </div>

        {/* Slider RAM */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
              fontSize: "11px",
              fontWeight: "600",
            }}
          >
            <span
              style={{
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12h20"></path>
                <path d="M20 12v8H4v-8"></path>
                <path d="M6 12V4h12v8"></path>
              </svg>
              Dung Lượng RAM
            </span>
            <span
              style={{
                color: "#38bdf8",
                background: "rgba(56, 189, 248, 0.1)",
                padding: "2px 8px",
                borderRadius: "6px",
                border: "1px solid rgba(56, 189, 248, 0.2)",
              }}
            >
              {ramGb} GB
            </span>
          </div>
          <input
            type="range"
            min="2"
            max="64"
            step="2"
            value={ramGb}
            disabled={isRunning}
            onChange={(e) => setRamGb(Number(e.target.value))}
            style={{
              width: "100%",
              accentColor: "#38bdf8",
              cursor: isRunning ? "not-allowed" : "pointer",
              height: "6px",
              background: "#1e293b",
              borderRadius: "3px",
            }}
          />
        </div>

        {/* Thông tin phụ khi đang chạy */}
        {isRunning && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              background: "rgba(30, 41, 59, 0.5)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              borderRadius: "10px",
              padding: "12px 16px",
              marginBottom: "20px",
              fontSize: "12px",
            }}
          >
            <div>
              <span style={{ color: "#64748b", display: "block" }}>Uptime</span>
              <span
                style={{
                  color: "#f8fafc",
                  fontWeight: "600",
                  fontFamily: "monospace",
                  fontSize: "13px",
                }}
              >
                {formatUptime(uptime)}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: "#64748b", display: "block" }}>
                Estimated Earn
              </span>
              <span style={{ color: "#4ade80", fontWeight: "600" }}>
                +${((uptime * 0.001) / 60).toFixed(4)}/min
              </span>
            </div>
          </div>
        )}

        {/* Nút Bắt đầu / Dừng */}
        <button
          onClick={() => setIsRunning(!isRunning)}
          style={{
            background: isRunning
              ? "linear-gradient(135deg, #ef4444, #dc2626)"
              : "linear-gradient(135deg, #22c55e, #16a34a)",
            color: "white",
            border: "none",
            padding: "14px",
            fontSize: "13px",
            fontWeight: "700",
            letterSpacing: "0.5px",
            borderRadius: "12px",
            cursor: "pointer",
            width: "100%",
            boxShadow: isRunning
              ? "0 4px 14px rgba(239, 68, 68, 0.4)"
              : "0 4px 14px rgba(34, 197, 94, 0.4)",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
          onMouseDown={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.transform =
            "scale(0.98)")
          }
          onMouseUp={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.transform =
            "scale(1)")
          }
        >
          {isRunning ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="6" y="6" width="12" height="12" rx="1" ry="1"></rect>
              </svg>
              DỪNG CHO THUÊ
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              BẮT ĐẦU CHO THUÊ
            </>
          )}
        </button>

        {/* Footer Status Message */}
        <div
          style={{
            marginTop: "16px",
            textAlign: "center",
            fontSize: "11px",
            color: isRunning ? "#38bdf8" : "#64748b",
            fontWeight: "500",
          }}
        >
          {isRunning
            ? "Đang kết nối cụm cluster & chia sẻ tài nguyên..."
            : "Hệ thống sẵn sàng khởi động."}
        </div>
      </div>
    </div>
  );
}

export default App;