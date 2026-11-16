use serde::Serialize;
use std::net::{SocketAddr, TcpStream};
use std::process::Command;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize, Clone, Debug)]
pub struct HardwareInfo {
    pub cpu_name: String,
    pub cpu_load_pct: f64,
    pub ram_total_gb: f64,
    pub ram_used_gb: f64,
    pub ram_used_pct: f64,
    pub gpu_name: String,
    pub disk_free_gb: f64,
    pub disk_total_gb: f64,
    pub battery_pct: i32,
    pub battery_charging: bool,
    pub top_processes: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct NetworkInfo {
    pub internet_ok: bool,
    pub latency_ms: u64,
    pub ollama_ok: bool,
    pub local_ip: String,
    pub wifi_ssid: String,
    pub conn_summary: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct WeatherInfo {
    pub location: String,
    pub temp_c: f64,
    pub feels_like_c: f64,
    pub humidity_pct: u64,
    pub wind_kmh: f64,
    pub description: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct BitcoinInfo {
    pub price_usd: f64,
    pub change_24h_pct: f64,
    pub source: String,
}

pub fn apply_no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

#[tauri::command]
pub async fn check_hardware() -> Result<HardwareInfo, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let ps_script = r#"
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name, LoadPercentage
$os = Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory
$gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1 Name
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object Size, FreeSpace
$bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1 EstimatedChargeRemaining, BatteryStatus
$top = Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 3 | ForEach-Object { "$($_.ProcessName) ($([math]::Round($_.WorkingSet64 / 1MB))MB)" }
@{
  cpu_name = [string]$cpu.Name
  cpu_load = [double]$cpu.LoadPercentage
  ram_total_kb = [double]$os.TotalVisibleMemorySize
  ram_free_kb = [double]$os.FreePhysicalMemory
  gpu_name = [string]$gpu.Name
  disk_size = [double]$disk.Size
  disk_free = [double]$disk.FreeSpace
  bat_pct = if ($bat) { [int]$bat.EstimatedChargeRemaining } else { -1 }
  bat_charging = if ($bat -and ($bat.BatteryStatus -eq 2 -or $bat.BatteryStatus -eq 6)) { $true } else { $false }
  top_procs = ($top -join ', ')
} | ConvertTo-Json -Compress
"#;

        let mut cmd = Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_script]);
        apply_no_window(&mut cmd);

        let output = cmd
            .output()
            .map_err(|e| format!("Không thể chạy PowerShell: {e}"))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Lỗi truy vấn phần cứng: {err}"));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let v: serde_json::Value = serde_json::from_str(stdout.trim())
            .map_err(|e| format!("Lỗi đọc JSON phần cứng: {e}"))?;

        let ram_total_kb = v["ram_total_kb"].as_f64().unwrap_or(0.0);
        let ram_free_kb = v["ram_free_kb"].as_f64().unwrap_or(0.0);
        let ram_total_gb = ram_total_kb / (1024.0 * 1024.0);
        let ram_used_gb = (ram_total_kb - ram_free_kb).max(0.0) / (1024.0 * 1024.0);
        let ram_used_pct = if ram_total_gb > 0.0 {
            (ram_used_gb / ram_total_gb) * 100.0
        } else {
            0.0
        };

        let disk_total_gb = v["disk_size"].as_f64().unwrap_or(0.0) / (1024.0 * 1024.0 * 1024.0);
        let disk_free_gb = v["disk_free"].as_f64().unwrap_or(0.0) / (1024.0 * 1024.0 * 1024.0);

        Ok(HardwareInfo {
            cpu_name: v["cpu_name"]
                .as_str()
                .unwrap_or("Unknown CPU")
                .trim()
                .to_string(),
            cpu_load_pct: v["cpu_load"].as_f64().unwrap_or(0.0),
            ram_total_gb,
            ram_used_gb,
            ram_used_pct,
            gpu_name: v["gpu_name"]
                .as_str()
                .unwrap_or("Unknown GPU")
                .trim()
                .to_string(),
            disk_free_gb,
            disk_total_gb,
            battery_pct: v["bat_pct"].as_i64().unwrap_or(-1) as i32,
            battery_charging: v["bat_charging"].as_bool().unwrap_or(false),
            top_processes: v["top_procs"].as_str().unwrap_or("").trim().to_string(),
        })
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn check_network() -> NetworkInfo {
    tauri::async_runtime::spawn_blocking(|| {
        let targets: [SocketAddr; 2] = [
            "1.1.1.1:53".parse().unwrap(),
            "8.8.8.8:53".parse().unwrap(),
        ];

        let mut internet_ok = false;
        let mut latency_ms = 0u64;

        for addr in targets {
            let start = Instant::now();
            if TcpStream::connect_timeout(&addr, Duration::from_millis(2000)).is_ok() {
                internet_ok = true;
                latency_ms = start.elapsed().as_millis() as u64;
                break;
            }
        }

        let ollama_addr: SocketAddr = "127.0.0.1:11434".parse().unwrap();
        let ollama_ok = TcpStream::connect_timeout(&ollama_addr, Duration::from_millis(500)).is_ok();

        let mut local_ip = "127.0.0.1".to_string();
        let mut wifi_ssid = "Ethernet/LAN".to_string();
        let mut conn_summary = "Không đọc được số kết nối".to_string();

        let ps_net = r#"
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)
$wifi = (netsh wlan show interfaces 2>$null | Select-String '^\s*SSID\s*:' | Select-Object -First 1) -replace '^\s*SSID\s*:\s*',''
$conns = @(Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue | Where-Object { $_.RemoteAddress -notlike '127.*' -and $_.RemoteAddress -ne '::1' })
@{ ip = [string]$ip; wifi = [string]$wifi.Trim(); est = $conns.Count } | ConvertTo-Json -Compress
"#;
        let mut cmd = Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", ps_net]);
        apply_no_window(&mut cmd);
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(text.trim()) {
                    let ip_val = v["ip"].as_str().unwrap_or("").trim();
                    if !ip_val.is_empty() {
                        local_ip = ip_val.to_string();
                    }
                    let wifi_val = v["wifi"].as_str().unwrap_or("").trim();
                    if !wifi_val.is_empty() {
                        wifi_ssid = wifi_val.to_string();
                    }
                    let est = v["est"].as_u64().unwrap_or(0);
                    conn_summary = format!("{est} kết nối TCP đang mở");
                }
            }
        }

        NetworkInfo {
            internet_ok,
            latency_ms,
            ollama_ok,
            local_ip,
            wifi_ssid,
            conn_summary,
        }
    })
    .await
    .unwrap_or(NetworkInfo {
        internet_ok: false,
        latency_ms: 0,
        ollama_ok: false,
        local_ip: "127.0.0.1".to_string(),
        wifi_ssid: "Ethernet/LAN".to_string(),
        conn_summary: "Không đọc được số kết nối".to_string(),
    })
}

fn wmo_code_to_vi(code: i64) -> &'static str {
    match code {
        0 => "Trời quang",
        1..=3 => "Có mây",
        45 | 48 => "Có sương mù",
        51..=57 => "Mưa phùn nhẹ",
        61..=67 => "Có mưa",
        71..=77 => "Có tuyết",
        80..=82 => "Mưa rào",
        95..=99 => "Có dông",
        _ => "Thời tiết bình thường",
    }
}

#[tauri::command]
pub async fn check_weather(city: Option<String>) -> Result<WeatherInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let query_city = city
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or("Hanoi")
            .replace(' ', "+");

        let wttr_url = format!("https://wttr.in/{query_city}?format=j1&lang=vi");
        let mut wttr_cmd = Command::new("curl.exe");
        wttr_cmd.args(["-s", "-m", "6", &wttr_url]);
        apply_no_window(&mut wttr_cmd);

        if let Ok(out) = wttr_cmd.output() {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(text.trim()) {
                    if let Some(cond) = v["current_condition"].get(0) {
                        let temp_c = cond["temp_C"]
                            .as_str()
                            .and_then(|s| s.parse::<f64>().ok())
                            .unwrap_or(0.0);
                        let feels_like_c = cond["FeelsLikeC"]
                            .as_str()
                            .and_then(|s| s.parse::<f64>().ok())
                            .unwrap_or(temp_c);
                        let humidity_pct = cond["humidity"]
                            .as_str()
                            .and_then(|s| s.parse::<u64>().ok())
                            .unwrap_or(0);
                        let wind_kmh = cond["windspeedKmph"]
                            .as_str()
                            .and_then(|s| s.parse::<f64>().ok())
                            .unwrap_or(0.0);
                        let desc = cond["lang_vi"]
                            .get(0)
                            .and_then(|d| d["value"].as_str())
                            .or_else(|| cond["weatherDesc"].get(0).and_then(|d| d["value"].as_str()))
                            .unwrap_or("Ổn định")
                            .trim()
                            .to_string();
                        let area = v["nearest_area"]
                            .get(0)
                            .and_then(|a| a["areaName"].get(0))
                            .and_then(|n| n["value"].as_str())
                            .unwrap_or("Hà Nội")
                            .to_string();

                        return Ok(WeatherInfo {
                            location: area,
                            temp_c,
                            feels_like_c,
                            humidity_pct,
                            wind_kmh,
                            description: desc,
                        });
                    }
                }
            }
        }

        let om_url = "https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code";
        let mut om_cmd = Command::new("curl.exe");
        om_cmd.args(["-s", "-m", "6", om_url]);
        apply_no_window(&mut om_cmd);

        let out = om_cmd
            .output()
            .map_err(|e| format!("Không thể gọi API thời tiết: {e}"))?;
        let text = String::from_utf8_lossy(&out.stdout);
        let v: serde_json::Value = serde_json::from_str(text.trim())
            .map_err(|_| "Không thể đọc dữ liệu thời tiết từ wttr.in/open-meteo".to_string())?;
        let cur = &v["current"];
        let temp_c = cur["temperature_2m"]
            .as_f64()
            .ok_or_else(|| "Thiếu dữ liệu nhiệt độ từ Open-Meteo".to_string())?;
        let feels_like_c = cur["apparent_temperature"].as_f64().unwrap_or(temp_c);
        let humidity_pct = cur["relative_humidity_2m"].as_u64().unwrap_or(0);
        let wind_kmh = cur["wind_speed_10m"].as_f64().unwrap_or(0.0);
        let code = cur["weather_code"].as_i64().unwrap_or(-1);

        Ok(WeatherInfo {
            location: "Hà Nội".to_string(),
            temp_c,
            feels_like_c,
            humidity_pct,
            wind_kmh,
            description: wmo_code_to_vi(code).to_string(),
        })
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn check_bitcoin() -> Result<BitcoinInfo, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut binance_cmd = Command::new("curl.exe");
        binance_cmd.args([
            "-s",
            "-m",
            "8",
            "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT",
        ]);
        apply_no_window(&mut binance_cmd);

        if let Ok(out) = binance_cmd.output() {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(text.trim()) {
                    if let Some(price_str) = v["lastPrice"].as_str() {
                        if let Ok(price_usd) = price_str.parse::<f64>() {
                            let change_24h_pct = v["priceChangePercent"]
                                .as_str()
                                .and_then(|s| s.parse::<f64>().ok())
                                .unwrap_or(0.0);
                            return Ok(BitcoinInfo {
                                price_usd,
                                change_24h_pct,
                                source: "Binance".to_string(),
                            });
                        }
                    }
                }
            }
        }

        let mut cg_cmd = Command::new("curl.exe");
        cg_cmd.args([
            "-s",
            "-m",
            "8",
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
        ]);
        apply_no_window(&mut cg_cmd);

        let out = cg_cmd
            .output()
            .map_err(|e| format!("Không thể gọi API giá Bitcoin: {e}"))?;
        let text = String::from_utf8_lossy(&out.stdout);
        let v: serde_json::Value = serde_json::from_str(text.trim())
            .map_err(|_| "Không thể đọc dữ liệu giá Bitcoin từ Binance/CoinGecko".to_string())?;

        let price_usd = v["bitcoin"]["usd"]
            .as_f64()
            .ok_or_else(|| "Thiếu trường giá USD".to_string())?;
        let change_24h_pct = v["bitcoin"]["usd_24h_change"].as_f64().unwrap_or(0.0);

        Ok(BitcoinInfo {
            price_usd,
            change_24h_pct,
            source: "CoinGecko".to_string(),
        })
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

