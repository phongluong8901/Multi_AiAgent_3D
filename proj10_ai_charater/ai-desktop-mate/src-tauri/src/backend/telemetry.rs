use serde::{Deserialize, Serialize};
use std::net::{SocketAddr, TcpStream};
use std::process::Command;
use std::time::{Duration, Instant};

use crate::backend::cloud_hub::{curl_get_public_json, resolve_cloud_hub_base_url};
use crate::backend::english_offline_deck::OFFLINE_ENGLISH_DECK;
use crate::backend::memory::MemoryState;

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
    #[serde(default)]
    pub weather_code: Option<i64>,
    #[serde(default)]
    pub is_day: Option<bool>,
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

        // Kiểm tra đa tầng Ollama qua IPv4 (127.0.0.1:11434), IPv6 ([::1]:11434) và OLLAMA_HOST
        let ipv4: SocketAddr = "127.0.0.1:11434".parse().unwrap();
        let ipv6: SocketAddr = "[::1]:11434".parse().unwrap();
        let mut ollama_ok = TcpStream::connect_timeout(&ipv4, Duration::from_millis(1200)).is_ok()
            || TcpStream::connect_timeout(&ipv6, Duration::from_millis(1200)).is_ok();

        if !ollama_ok {
            if let Ok(host_env) = std::env::var("OLLAMA_HOST") {
                let clean = host_env.trim().trim_start_matches("http://").trim_start_matches("https://");
                if let Ok(addr) = clean.parse::<SocketAddr>() {
                    ollama_ok = TcpStream::connect_timeout(&addr, Duration::from_millis(1200)).is_ok();
                }
            }
        }

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

fn wwo_code_to_wmo(wwo: i64) -> Option<i64> {
    match wwo {
        113 => Some(0),
        116 | 119 | 122 => Some(2),
        143 | 248 | 260 => Some(45),
        176 | 263 | 266 | 293 | 296 | 299 | 302 | 305 | 308 | 311 | 314 | 353 | 356 | 359 => {
            Some(61)
        }
        179 | 182 | 185 | 227 | 230 | 317 | 320 | 323 | 326 | 329 | 332 | 335 | 338 | 350
        | 362 | 365 | 368 | 371 | 374 | 377 => Some(73),
        200 | 386 | 389 | 392 | 395 => Some(95),
        _ => None,
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

        let is_auto = query_city.eq_ignore_ascii_case("auto");
        let lower_city = query_city.to_lowercase();
        let (mut lat, mut lon, mut city_label, matched_preset) = if lower_city.contains("danang")
            || lower_city.contains("da+nang")
            || lower_city.contains("đà+nẵng")
        {
            (16.0544, 108.2022, "Đà Nẵng".to_string(), true)
        } else if lower_city.contains("ho+chi+minh")
            || lower_city.contains("saigon")
            || lower_city.contains("hcm")
            || lower_city.contains("hồ+chí+minh")
        {
            (10.8231, 106.6297, "TP. Hồ Chí Minh".to_string(), true)
        } else if lower_city.contains("hai+phong") || lower_city.contains("hải+phòng") {
            (20.8449, 106.6881, "Hải Phòng".to_string(), true)
        } else if lower_city.contains("can+tho") || lower_city.contains("cần+thơ") {
            (10.0452, 105.7469, "Cần Thơ".to_string(), true)
        } else if lower_city.contains("nha+trang") {
            (12.2388, 109.1967, "Nha Trang".to_string(), true)
        } else if lower_city.contains("hue") || lower_city.contains("huế") {
            (16.4637, 107.5909, "Huế".to_string(), true)
        } else if lower_city.contains("da+lat") || lower_city.contains("đà+lạt") {
            (11.9404, 108.4583, "Đà Lạt".to_string(), true)
        } else if lower_city.contains("vung+tau") || lower_city.contains("vũng+tàu") {
            (10.3460, 107.0843, "Vũng Tàu".to_string(), true)
        } else if lower_city.contains("sapa") || lower_city.contains("sa+pa") {
            (22.3364, 103.8438, "Sa Pa".to_string(), true)
        } else if lower_city.contains("quy+nhon") || lower_city.contains("quy+nhơn") {
            (13.7830, 109.2197, "Quy Nhơn".to_string(), true)
        } else if lower_city.contains("vinh") {
            (18.6796, 105.6813, "Vinh".to_string(), true)
        } else if lower_city.contains("phu+quoc") || lower_city.contains("phú+quốc") {
            (10.2899, 103.9840, "Phú Quốc".to_string(), true)
        } else if lower_city.contains("ha+long") || lower_city.contains("hạ+long") {
            (20.9599, 107.0425, "Hạ Long".to_string(), true)
        } else if lower_city.contains("bien+hoa") || lower_city.contains("biên+hòa") {
            (10.9574, 106.8427, "Biên Hòa".to_string(), true)
        } else if is_auto || lower_city.contains("hanoi") || lower_city.contains("ha+noi") || lower_city.contains("hà+nội") {
            (21.0285, 105.8542, "Hà Nội".to_string(), true)
        } else {
            (21.0285, 105.8542, "Hà Nội".to_string(), false)
        };

        // Thử nhanh wttr.in với timeout 3s (nếu "auto" thì để wttr.in tự định vị IP)
        let wttr_url = if is_auto {
            "https://wttr.in/?format=j1&lang=vi".to_string()
        } else {
            format!("https://wttr.in/{query_city}?format=j1&lang=vi")
        };
        let mut wttr_cmd = Command::new("curl.exe");
        wttr_cmd.args(["-s", "-m", "3", &wttr_url]);
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
                        let weather_code = cond["weatherCode"]
                            .as_str()
                            .and_then(|s| s.parse::<i64>().ok())
                            .and_then(wwo_code_to_wmo);
                        let desc = cond["lang_vi"]
                            .get(0)
                            .and_then(|d| d["value"].as_str())
                            .or_else(|| cond["weatherDesc"].get(0).and_then(|d| d["value"].as_str()))
                            .unwrap_or("Ổn định")
                            .trim()
                            .to_string();
                        let area = if is_auto {
                            let region_val = v["nearest_area"]
                                .get(0)
                                .and_then(|a| a["region"].get(0))
                                .and_then(|n| n["value"].as_str())
                                .unwrap_or("")
                                .trim();
                            let area_val = v["nearest_area"]
                                .get(0)
                                .and_then(|a| a["areaName"].get(0))
                                .and_then(|n| n["value"].as_str())
                                .unwrap_or("")
                                .trim();
                            let picked = if !region_val.is_empty() { region_val } else { area_val };
                            if picked.eq_ignore_ascii_case("Ha Noi") || picked.eq_ignore_ascii_case("Hanoi") {
                                "Hà Nội".to_string()
                            } else if picked.to_ascii_lowercase().contains("ho chi minh") {
                                "TP. Hồ Chí Minh".to_string()
                            } else if !picked.is_empty() {
                                picked.to_string()
                            } else {
                                city_label.clone()
                            }
                        } else {
                            city_label.clone()
                        };

                        return Ok(WeatherInfo {
                            location: area,
                            temp_c,
                            feels_like_c,
                            humidity_pct,
                            wind_kmh,
                            description: desc,
                            weather_code,
                            is_day: None,
                        });
                    }
                }
            }
        }

        // Open-Meteo Geocoding fallback cho thành phố ngoài danh sách preset
        if !is_auto && !matched_preset {
            let geo_url = format!(
                "https://geocoding-api.open-meteo.com/v1/search?name={query_city}&count=1&language=vi"
            );
            let mut geo_cmd = Command::new("curl.exe");
            geo_cmd.args(["-s", "-m", "3", &geo_url]);
            apply_no_window(&mut geo_cmd);
            if let Ok(gout) = geo_cmd.output() {
                if gout.status.success() {
                    let gtxt = String::from_utf8_lossy(&gout.stdout);
                    if let Ok(gv) = serde_json::from_str::<serde_json::Value>(gtxt.trim()) {
                        if let Some(first) = gv["results"].get(0) {
                            if let (Some(glat), Some(glon)) =
                                (first["latitude"].as_f64(), first["longitude"].as_f64())
                            {
                                lat = glat;
                                lon = glon;
                                if let Some(gname) = first["name"].as_str() {
                                    city_label = gname.to_string();
                                }
                            }
                        }
                    }
                }
            }
        }

        // Nguồn dự phòng Open-Meteo REST API (lấy cả weather_code & is_day theo giờ địa phương)
        let om_url = format!(
            "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,is_day"
        );
        let mut om_cmd = Command::new("curl.exe");
        om_cmd.args(["-s", "-m", "4", &om_url]);
        apply_no_window(&mut om_cmd);

        if let Ok(out) = om_cmd.output() {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(text.trim()) {
                    let cur = &v["current"];
                    if let Some(temp_c) = cur["temperature_2m"].as_f64() {
                        let feels_like_c = cur["apparent_temperature"].as_f64().unwrap_or(temp_c);
                        let humidity_pct = cur["relative_humidity_2m"].as_u64().unwrap_or(60);
                        let wind_kmh = cur["wind_speed_10m"].as_f64().unwrap_or(5.0);
                        let code = cur["weather_code"].as_i64().unwrap_or(-1);
                        let is_day = cur["is_day"].as_i64().map(|d| d == 1);

                        return Ok(WeatherInfo {
                            location: city_label.clone(),
                            temp_c,
                            feels_like_c,
                            humidity_pct,
                            wind_kmh,
                            description: wmo_code_to_vi(code).to_string(),
                            weather_code: if code >= 0 { Some(code) } else { None },
                            is_day,
                        });
                    }
                }
            }
        }

        Err(format!(
            "Không thể lấy dữ liệu thời tiết thực tế cho '{city_label}'. Hãy kiểm tra kết nối mạng."
        ))
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

#[derive(Serialize, Clone, Debug)]
pub struct AppProcessMetrics {
    pub pid: u32,
    pub app_cpu_pct: f64,
    pub app_ram_mb: f64,
    pub app_peak_ram_mb: f64,
    pub app_virtual_mem_mb: f64,
    pub app_handles: u32,
    pub system_cpu_cores: usize,
    pub system_ram_total_gb: f64,
    pub system_ram_used_gb: f64,
    pub system_ram_used_pct: f64,
    pub uptime_seconds: u64,
}

static APP_START_INSTANT: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();
static LAST_SAMPLE: std::sync::Mutex<Option<(Instant, u64)>> = std::sync::Mutex::new(None);

#[tauri::command]
pub async fn get_app_process_metrics() -> Result<AppProcessMetrics, String> {
    let start_time = APP_START_INSTANT.get_or_init(Instant::now);
    let uptime_seconds = start_time.elapsed().as_secs();

    #[cfg(windows)]
    {
        use windows::Win32::Foundation::FILETIME;
        use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
        use windows::Win32::System::SystemInformation::{
            GetSystemInfo, GlobalMemoryStatusEx, MEMORYSTATUSEX, SYSTEM_INFO,
        };
        use windows::Win32::System::Threading::{
            GetCurrentProcess, GetCurrentProcessId, GetProcessHandleCount, GetProcessTimes,
        };

        let pid = unsafe { GetCurrentProcessId() };
        let h_proc = unsafe { GetCurrentProcess() };

        // 1. RAM và Virtual Memory của process này
        let mut pmc = PROCESS_MEMORY_COUNTERS::default();
        let _ = unsafe {
            GetProcessMemoryInfo(
                h_proc,
                &mut pmc,
                std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
            )
        };
        let app_ram_mb = (pmc.WorkingSetSize as f64) / (1024.0 * 1024.0);
        let app_peak_ram_mb = (pmc.PeakWorkingSetSize as f64) / (1024.0 * 1024.0);
        let app_virtual_mem_mb = (pmc.PagefileUsage as f64) / (1024.0 * 1024.0);

        let mut app_handles = 0u32;
        let _ = unsafe { GetProcessHandleCount(h_proc, &mut app_handles) };

        // 2. CPU Cores & System Memory
        let mut sys_info = SYSTEM_INFO::default();
        unsafe { GetSystemInfo(&mut sys_info) };
        let system_cpu_cores = sys_info.dwNumberOfProcessors as usize;

        let mut mem_stat = MEMORYSTATUSEX::default();
        mem_stat.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
        let _ = unsafe { GlobalMemoryStatusEx(&mut mem_stat) };
        let system_ram_total_gb = (mem_stat.ullTotalPhys as f64) / (1024.0 * 1024.0 * 1024.0);
        let system_ram_used_gb =
            ((mem_stat.ullTotalPhys.saturating_sub(mem_stat.ullAvailPhys)) as f64)
                / (1024.0 * 1024.0 * 1024.0);
        let system_ram_used_pct = if system_ram_total_gb > 0.0 {
            (system_ram_used_gb / system_ram_total_gb) * 100.0
        } else {
            0.0
        };

        // 3. CPU Load % của process này
        let mut creation = FILETIME::default();
        let mut exit = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();
        let _ = unsafe {
            GetProcessTimes(h_proc, &mut creation, &mut exit, &mut kernel, &mut user)
        };

        let proc_time_100ns = ((kernel.dwHighDateTime as u64) << 32 | kernel.dwLowDateTime as u64)
            + ((user.dwHighDateTime as u64) << 32 | user.dwLowDateTime as u64);

        let now = Instant::now();
        let mut sample_lock = LAST_SAMPLE.lock().unwrap();
        let app_cpu_pct = if let Some((last_inst, last_proc_time)) = *sample_lock {
            let elapsed_ns = now.duration_since(last_inst).as_nanos() as f64;
            let cpu_ns = (proc_time_100ns.saturating_sub(last_proc_time) as f64) * 100.0;
            if elapsed_ns > 0.0 && system_cpu_cores > 0 {
                let pct = (cpu_ns / elapsed_ns) * 100.0 / (system_cpu_cores as f64);
                (pct * 10.0).round() / 10.0
            } else {
                0.0
            }
        } else {
            0.5
        };
        *sample_lock = Some((now, proc_time_100ns));

        Ok(AppProcessMetrics {
            pid,
            app_cpu_pct: app_cpu_pct.clamp(0.0, 100.0),
            app_ram_mb: (app_ram_mb * 10.0).round() / 10.0,
            app_peak_ram_mb: (app_peak_ram_mb * 10.0).round() / 10.0,
            app_virtual_mem_mb: (app_virtual_mem_mb * 10.0).round() / 10.0,
            app_handles,
            system_cpu_cores,
            system_ram_total_gb: (system_ram_total_gb * 10.0).round() / 10.0,
            system_ram_used_gb: (system_ram_used_gb * 10.0).round() / 10.0,
            system_ram_used_pct: (system_ram_used_pct * 10.0).round() / 10.0,
            uptime_seconds,
        })
    }

    #[cfg(not(windows))]
    {
        Ok(AppProcessMetrics {
            pid: std::process::id(),
            app_cpu_pct: 0.0,
            app_ram_mb: 0.0,
            app_peak_ram_mb: 0.0,
            app_virtual_mem_mb: 0.0,
            app_handles: 0,
            system_cpu_cores: 4,
            system_ram_total_gb: 16.0,
            system_ram_used_gb: 8.0,
            system_ram_used_pct: 50.0,
            uptime_seconds,
        })
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NewsArticleItem {
    pub title: String,
    pub link: String,
    pub source: String,
    pub pub_date: String,
    pub summary: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct EnglishVocabItem {
    #[serde(default)]
    pub word: String,
    #[serde(default)]
    pub phonetic: String,
    #[serde(default)]
    pub part_of_speech: String,
    #[serde(default)]
    pub definition_en: String,
    #[serde(default)]
    pub meaning_vi: String,
    #[serde(default)]
    pub example_en: String,
    #[serde(default)]
    pub example_vi: String,
    #[serde(default)]
    pub audio_url: String,
    #[serde(default)]
    pub topic: String,
    #[serde(default)]
    pub synonyms: Vec<String>,
    #[serde(default)]
    pub level: String,
    #[serde(default)]
    pub mastery_level: i64,
    #[serde(default)]
    pub next_review_at: i64,
    #[serde(default)]
    pub correct_count: i64,
    #[serde(default)]
    pub wrong_count: i64,
    #[serde(default)]
    pub is_starred: bool,
    #[serde(default)]
    pub learned_at: i64,
}

fn fetch_url_utf8(url: &str, timeout_secs: u32) -> Result<String, String> {
    let mut cmd = Command::new("curl.exe");
    let timeout_str = timeout_secs.to_string();
    cmd.args([
        "-s",
        "-L",
        "-m",
        &timeout_str,
        "-A",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "-H",
        "Accept: application/rss+xml, application/xml, text/xml, text/html, application/json, */*",
        url,
    ]);
    apply_no_window(&mut cmd);
    let out = cmd.output().map_err(|e| format!("Không thể chạy curl.exe: {e}"))?;
    if !out.status.success() && out.stdout.is_empty() {
        return Err(format!("Không tải được URL {url}"));
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn url_encode_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char);
            }
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn decode_entities_and_strip_tags(raw: &str) -> String {
    let mut s = raw
        .replace("<![CDATA[", "")
        .replace("]]>", "");

    // Bóc các thẻ HTML bên trong chuỗi RSS description / title
    let mut no_tags = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        if ch == '<' {
            in_tag = true;
            no_tags.push(' ');
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            no_tags.push(ch);
        }
    }
    s = no_tags;

    // Giải mã thực thể HTML/XML phổ biến
    let replacements = [
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&quot;", "\""),
        ("&#34;", "\""),
        ("&#39;", "'"),
        ("&apos;", "'"),
        ("&nbsp;", " "),
        ("&ndash;", "-"),
        ("&mdash;", "-"),
        ("&lsquo;", "'"),
        ("&rsquo;", "'"),
        ("&ldquo;", "\""),
        ("&rdquo;", "\""),
        ("&hellip;", "..."),
    ];
    for (pat, rep) in replacements {
        s = s.replace(pat, rep);
    }

    // Giải mã numeric HTML entities cơ bản dạng &#123;
    let mut decoded = String::with_capacity(s.len());
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '&' && i + 3 < chars.len() && chars[i + 1] == '#' {
            if let Some(semi_rel) = chars[i + 2..].iter().position(|&c| c == ';') {
                if semi_rel > 0 && semi_rel <= 7 {
                    let num_str: String = chars[i + 2..i + 2 + semi_rel].iter().collect();
                    let code_opt = if let Some(hex) = num_str.strip_prefix('x').or_else(|| num_str.strip_prefix('X')) {
                        u32::from_str_radix(hex, 16).ok()
                    } else {
                        num_str.parse::<u32>().ok()
                    };
                    if let Some(code) = code_opt.and_then(char::from_u32) {
                        decoded.push(code);
                        i += 2 + semi_rel + 1;
                        continue;
                    }
                }
            }
        }
        decoded.push(chars[i]);
        i += 1;
    }

    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn extract_tag_inner(block: &str, tag: &str) -> Option<String> {
    let open_exact = format!("<{tag}>");
    let open_prefix = format!("<{tag} ");
    let close_tag = format!("</{tag}>");
    let lower = block.to_lowercase();

    let start_idx = lower
        .find(&open_exact)
        .or_else(|| lower.find(&open_prefix))?;
    let gt_offset = block[start_idx..].find('>')?;
    let content_start = start_idx + gt_offset + 1;
    let content_end_rel = lower[content_start..].find(&close_tag)?;
    Some(block[content_start..content_start + content_end_rel].to_string())
}

fn extract_atom_link(block: &str) -> Option<String> {
    if let Some(raw) = extract_tag_inner(block, "link") {
        let cleaned = decode_entities_and_strip_tags(&raw);
        if cleaned.starts_with("http") {
            return Some(cleaned);
        }
    }
    let lower = block.to_lowercase();
    let idx = lower.find("<link ")?;
    let end = block[idx..].find('>')?;
    let slice = &block[idx..idx + end];
    extract_href_attr(slice)
}

fn extract_href_attr(fragment: &str) -> Option<String> {
    let lower = fragment.to_lowercase();
    for needle in ["href=\"", "href='"] {
        if let Some(pos) = lower.find(needle) {
            let val_start = pos + needle.len();
            let quote = if needle.ends_with('"') { '"' } else { '\'' };
            if let Some(end_rel) = fragment[val_start..].find(quote) {
                return Some(fragment[val_start..val_start + end_rel].trim().to_string());
            }
        }
    }
    None
}

fn resolve_url(base_url: &str, href: &str) -> String {
    let h = href.trim();
    if h.starts_with("http://") || h.starts_with("https://") {
        return h.to_string();
    }
    if h.starts_with("//") {
        return format!("https:{h}");
    }
    let origin = if let Some(scheme_end) = base_url.find("://") {
        let rest = &base_url[scheme_end + 3..];
        let host_end = rest.find('/').unwrap_or(rest.len());
        &base_url[..scheme_end + 3 + host_end]
    } else {
        base_url
    };
    if h.starts_with('/') {
        format!("{origin}{h}")
    } else {
        format!("{origin}/{h}")
    }
}

fn parse_rss_or_atom(body: &str, source_label: &str) -> Vec<NewsArticleItem> {
    let mut items = Vec::new();
    let lower = body.to_lowercase();
    let tag_pairs = [("<item", "</item>"), ("<entry", "</entry>")];

    for (open_pat, close_pat) in tag_pairs {
        let mut cursor = 0usize;
        while let Some(rel_start) = lower[cursor..].find(open_pat) {
            let abs_start = cursor + rel_start;
            let after_open = &lower[abs_start..];
            let Some(rel_end) = after_open.find(close_pat) else {
                break;
            };
            let block = &body[abs_start..abs_start + rel_end + close_pat.len()];
            cursor = abs_start + rel_end + close_pat.len();

            let title = extract_tag_inner(block, "title")
                .map(|t| decode_entities_and_strip_tags(&t))
                .unwrap_or_default();
            if title.len() < 8 {
                continue;
            }
            let link = extract_atom_link(block).unwrap_or_default();
            let pub_date = extract_tag_inner(block, "pubdate")
                .or_else(|| extract_tag_inner(block, "published"))
                .or_else(|| extract_tag_inner(block, "updated"))
                .map(|d| decode_entities_and_strip_tags(&d))
                .unwrap_or_default();
            let summary = extract_tag_inner(block, "description")
                .or_else(|| extract_tag_inner(block, "summary"))
                .map(|s| {
                    let clean = decode_entities_and_strip_tags(&s);
                    clean.chars().take(160).collect::<String>()
                })
                .unwrap_or_default();

            if !items.iter().any(|x: &NewsArticleItem| x.title == title) {
                items.push(NewsArticleItem {
                    title,
                    link,
                    source: source_label.to_string(),
                    pub_date,
                    summary,
                });
            }
            if items.len() >= 10 {
                return items;
            }
        }
        if !items.is_empty() {
            break;
        }
    }
    items
}

fn parse_html_headlines(html: &str, base_url: &str, source_label: &str) -> Vec<NewsArticleItem> {
    let mut items = Vec::new();
    let lower = html.to_lowercase();
    let mut cursor = 0usize;

    while let Some(rel_a) = lower[cursor..].find("<a ") {
        let a_start = cursor + rel_a;
        let Some(gt_rel) = lower[a_start..].find('>') else {
            break;
        };
        let tag_head = &html[a_start..a_start + gt_rel + 1];
        let inner_start = a_start + gt_rel + 1;
        let Some(end_rel) = lower[inner_start..].find("</a>") else {
            cursor = inner_start;
            continue;
        };
        let raw_inner = &html[inner_start..inner_start + end_rel];
        cursor = inner_start + end_rel + 4;

        let Some(href) = extract_href_attr(tag_head) else {
            continue;
        };
        let lower_href = href.to_lowercase();
        if href.is_empty()
            || lower_href.starts_with('#')
            || lower_href.starts_with("javascript:")
            || lower_href.contains("dang-nhap")
            || lower_href.contains("login")
            || lower_href.contains("quang-cao")
        {
            continue;
        }

        // Ưu tiên link bài viết thực tế (.html, .chn, .htm, hoặc slug dài)
        let looks_like_article = lower_href.contains(".html")
            || lower_href.contains(".chn")
            || lower_href.contains(".htm")
            || lower_href.contains("/post/")
            || href.len() > 28;
        if !looks_like_article {
            continue;
        }

        let title = decode_entities_and_strip_tags(raw_inner);
        let char_count = title.chars().count();
        if char_count < 26 || char_count > 190 {
            continue;
        }
        // Bỏ qua chuỗi kiểu menu/footer
        let lt = title.to_lowercase();
        if lt.contains("xem thêm") || lt.contains("đọc tiếp") || lt.contains("chính sách") {
            continue;
        }

        let full_link = resolve_url(base_url, &href);
        if !items.iter().any(|x: &NewsArticleItem| x.title == title || x.link == full_link) {
            items.push(NewsArticleItem {
                title,
                link: full_link,
                source: source_label.to_string(),
                pub_date: "Mới cập nhật".to_string(),
                summary: String::new(),
            });
        }
        if items.len() >= 10 {
            break;
        }
    }
    items
}

#[tauri::command]
pub async fn fetch_live_news(source: String) -> Result<Vec<NewsArticleItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let trimmed = source.trim();
        let lower = trimmed.to_lowercase();

        let (label, candidates): (String, Vec<String>) = if lower.starts_with("http://") || lower.starts_with("https://") {
            let host = trimmed
                .split("://")
                .nth(1)
                .and_then(|s| s.split('/').next())
                .unwrap_or("Custom News")
                .trim_start_matches("www.")
                .to_string();
            (host, vec![trimmed.to_string()])
        } else if lower == "znews" || lower.contains("zing") {
            (
                "Znews".to_string(),
                vec![
                    "https://znews.vn/rss/trang-chu.rss".to_string(),
                    "https://znews.vn/tin-moi.html".to_string(),
                    "https://znews.vn/".to_string(),
                ],
            )
        } else if lower == "cafef" {
            (
                "CafeF".to_string(),
                vec![
                    "https://cafef.vn/trang-chu.rss".to_string(),
                    "https://cafef.vn/thi-truong-chung-khoan.rss".to_string(),
                    "https://cafef.vn/".to_string(),
                ],
            )
        } else if lower == "money" || lower == "moneyh" || lower == "vneconomy" {
            (
                "Tài Chính / Money".to_string(),
                vec![
                    "https://vneconomy.vn/tai-chinh.rss".to_string(),
                    "https://cafef.vn/tai-chinh-ngan-hang.rss".to_string(),
                    "https://vnexpress.net/rss/kinh-doanh.rss".to_string(),
                    "https://vneconomy.vn/".to_string(),
                ],
            )
        } else if lower == "vnexpress" {
            (
                "VnExpress".to_string(),
                vec![
                    "https://vnexpress.net/rss/tin-moi-nhat.rss".to_string(),
                    "https://vnexpress.net/".to_string(),
                ],
            )
        } else if lower == "dantri" {
            (
                "Dân Trí".to_string(),
                vec![
                    "https://dantri.com.vn/rss/home.rss".to_string(),
                    "https://dantri.com.vn/".to_string(),
                ],
            )
        } else if lower == "tuoitre" {
            (
                "Tuổi Trẻ".to_string(),
                vec![
                    "https://tuoitre.vn/rss/tin-moi-nhat.rss".to_string(),
                    "https://tuoitre.vn/".to_string(),
                ],
            )
        } else if lower == "hackernews" || lower == "hn" {
            (
                "Hacker News".to_string(),
                vec!["https://news.ycombinator.com/rss".to_string()],
            )
        } else if trimmed.contains('.') {
            let custom_url = format!("https://{trimmed}");
            (trimmed.to_string(), vec![custom_url])
        } else {
            (
                "Znews".to_string(),
                vec![
                    "https://znews.vn/rss/trang-chu.rss".to_string(),
                    "https://znews.vn/".to_string(),
                ],
            )
        };

        for url in candidates {
            if let Ok(body) = fetch_url_utf8(&url, 7) {
                let mut articles = parse_rss_or_atom(&body, &label);
                if articles.is_empty() {
                    articles = parse_html_headlines(&body, &url, &label);
                }
                if !articles.is_empty() {
                    return Ok(articles);
                }
            }
        }

        Err(format!(
            "Không thể lấy tin mới từ nguồn '{label}'. Hãy kiểm tra mạng hoặc thử URL RSS khác."
        ))
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ đọc tin: {e}"))?
}

fn curl_json_get(base_url: &str, params: &[(&str, &str)], timeout_secs: u32) -> Option<String> {
    let mut cmd = Command::new("curl.exe");
    let timeout_str = timeout_secs.to_string();
    cmd.args([
        "-s",
        "-L",
        "-m",
        &timeout_str,
        "-A",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "-H",
        "Accept: application/json, text/plain, */*",
        "-G",
        base_url,
    ]);
    for (k, v) in params {
        cmd.arg("--data-urlencode");
        cmd.arg(format!("{k}={v}"));
    }
    apply_no_window(&mut cmd);
    let out = cmd.output().ok()?;
    if !out.status.success() && out.stdout.is_empty() {
        return None;
    }
    let body = String::from_utf8_lossy(&out.stdout).to_string();
    if body.trim().is_empty() {
        None
    } else {
        Some(body)
    }
}

pub fn is_valid_vi_translation(source_en: &str, candidate_vi: &str) -> bool {
    let src = source_en.trim();
    let cand = candidate_vi.trim();
    if cand.is_empty() {
        return false;
    }
    let upper = cand.to_uppercase();
    if upper.contains("MYMEMORY WARNING")
        || upper.contains("QUERY LENGTH LIMIT")
        || upper.contains("PLEASE SELECT TWO DISTINCT LANGUAGES")
        || upper.contains("NO QUERY SPECIFIED")
    {
        return false;
    }
    !cand.eq_ignore_ascii_case(src)
}

pub fn parse_google_translate_gtx_vi(
    body: &str,
    source_en: &str,
    is_single_word: bool,
) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(body.trim()).ok()?;
    let mut primary = String::new();
    if let Some(segs) = v.get(0).and_then(|s| s.as_array()) {
        for seg in segs {
            if let Some(part) = seg.get(0).and_then(|p| p.as_str()) {
                primary.push_str(part);
            }
        }
    }
    let primary_trimmed = primary.trim().to_string();

    if is_single_word {
        let mut glosses: Vec<String> = Vec::new();
        let push_unique = |list: &mut Vec<String>, cand: &str| {
            let t = cand.trim();
            if t.is_empty() || !is_valid_vi_translation(source_en, t) {
                return;
            }
            if !list.iter().any(|x| x.eq_ignore_ascii_case(t)) {
                list.push(t.to_string());
            }
        };

        if !primary_trimmed.is_empty() {
            push_unique(&mut glosses, &primary_trimmed);
        }

        if let Some(dict_arr) = v.get(1).and_then(|d| d.as_array()) {
            for entry in dict_arr {
                if let Some(terms) = entry.get(1).and_then(|t| t.as_array()) {
                    for term in terms {
                        if let Some(t) = term.as_str() {
                            push_unique(&mut glosses, t);
                            if glosses.len() >= 3 {
                                break;
                            }
                        }
                    }
                }
                if glosses.len() >= 3 {
                    break;
                }
            }
        }

        if !glosses.is_empty() {
            return Some(glosses.join(", "));
        }
    }

    if is_valid_vi_translation(source_en, &primary_trimmed) {
        Some(primary_trimmed)
    } else {
        None
    }
}

pub fn parse_google_clients5_vi(body: &str, source_en: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(body.trim()).ok()?;
    let mut candidate = String::new();
    if let Some(arr) = v.as_array() {
        if let Some(first) = arr.first() {
            if let Some(s) = first.as_str() {
                candidate = s.to_string();
            } else if let Some(inner) = first.as_array() {
                if let Some(s) = inner.first().and_then(|x| x.as_str()) {
                    candidate = s.to_string();
                }
            }
        }
    } else if let Some(sents) = v.get("sentences").and_then(|s| s.as_array()) {
        for s in sents {
            if let Some(tr) = s.get("trans").and_then(|x| x.as_str()) {
                candidate.push_str(tr);
            }
        }
    }
    let out = candidate.trim().to_string();
    if is_valid_vi_translation(source_en, &out) {
        Some(out)
    } else {
        None
    }
}

pub fn parse_mymemory_vi(body: &str, source_en: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(body.trim()).ok()?;
    if let Some(status) = v.get("responseStatus").and_then(|s| s.as_i64()) {
        if status == 429 || status == 403 {
            return None;
        }
    }
    let txt = v
        .get("responseData")
        .and_then(|d| d.get("translatedText"))
        .and_then(|t| t.as_str())?
        .trim()
        .to_string();
    if is_valid_vi_translation(source_en, &txt) {
        Some(txt)
    } else {
        None
    }
}

pub fn format_english_meaning_vi(
    picked_word: &str,
    word_vi: Option<String>,
    def_vi: Option<String>,
) -> String {
    let w_clean = word_vi
        .map(|s| s.trim().to_string())
        .filter(|s| is_valid_vi_translation(picked_word, s));
    let d_clean = def_vi
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && !s.eq_ignore_ascii_case(picked_word));

    match (w_clean, d_clean) {
        (Some(w), Some(d)) => {
            if w.eq_ignore_ascii_case(&d) {
                w
            } else {
                format!("{w} - {d}")
            }
        }
        (Some(w), None) => w,
        (None, Some(d)) => d,
        (None, None) => String::new(),
    }
}

fn translate_en_to_vi_live(text: &str, is_single_word: bool) -> Option<String> {
    let clean = text.trim();
    if clean.is_empty() {
        return None;
    }

    // Engine 1: Google Translate (dt=t + dt=bd for richer dictionary glosses)
    if let Some(body) = curl_json_get(
        "https://translate.googleapis.com/translate_a/single",
        &[
            ("client", "gtx"),
            ("sl", "en"),
            ("tl", "vi"),
            ("dt", "t"),
            ("dt", "bd"),
            ("q", clean),
        ],
        8,
    ) {
        if let Some(res) = parse_google_translate_gtx_vi(&body, clean, is_single_word) {
            return Some(res);
        }
    }

    // Engine 2: Google Translate Chrome Extension endpoint
    if let Some(body) = curl_json_get(
        "https://clients5.google.com/translate_a/t",
        &[
            ("client", "dict-chrome-ex"),
            ("sl", "en"),
            ("tl", "vi"),
            ("q", clean),
        ],
        8,
    ) {
        if let Some(res) = parse_google_clients5_vi(&body, clean) {
            return Some(res);
        }
    }

    // Engine 3: MyMemory free translation fallback
    let short_mm: String = clean.chars().take(450).collect();
    if let Some(body) = curl_json_get(
        "https://api.mymemory.translated.net/get",
        &[("q", &short_mm), ("langpair", "en|vi")],
        8,
    ) {
        if let Some(res) = parse_mymemory_vi(&body, clean) {
            return Some(res);
        }
    }

    None
}

fn normalize_vocab_topic_filter(raw: Option<String>) -> String {
    let trimmed = raw.unwrap_or_default().trim().to_lowercase();
    if trimmed.is_empty() {
        "random".to_string()
    } else {
        trimmed
    }
}

fn normalize_vocab_level_filter(raw: Option<String>) -> String {
    let up = raw.unwrap_or_default().trim().to_uppercase();
    if ["A1", "A2", "B1", "B2", "C1", "C2"].contains(&up.as_str()) {
        up
    } else {
        "all".to_string()
    }
}

fn build_vocab_item_from_dictionary_api(
    cand_word: &str,
    cand_dm_def: &str,
    chosen_topic: &str,
) -> Option<EnglishVocabItem> {
    let dict_url = format!(
        "https://api.dictionaryapi.dev/api/v2/entries/en/{}",
        url_encode_component(cand_word)
    );
    let dict_body = fetch_url_utf8(&dict_url, 6).ok()?;
    let entries = serde_json::from_str::<Vec<serde_json::Value>>(dict_body.trim()).ok()?;
    let entry = entries.first()?;

    let picked_word = entry["word"]
        .as_str()
        .unwrap_or(cand_word)
        .trim()
        .to_string();
    let mut phonetic = entry["phonetic"].as_str().unwrap_or("").trim().to_string();
    let mut part_of_speech = String::new();
    let mut definition_en = String::new();
    let mut example_en = String::new();
    let mut audio_url = String::new();
    let mut synonyms: Vec<String> = Vec::new();

    if let Some(ph_arr) = entry["phonetics"].as_array() {
        for ph in ph_arr {
            if phonetic.is_empty() {
                if let Some(t) = ph["text"].as_str() {
                    if !t.trim().is_empty() {
                        phonetic = t.trim().to_string();
                    }
                }
            }
            if audio_url.is_empty() {
                if let Some(au) = ph["audio"].as_str() {
                    let tau = au.trim();
                    if !tau.is_empty() {
                        audio_url = if tau.starts_with("//") {
                            format!("https:{tau}")
                        } else {
                            tau.to_string()
                        };
                    }
                }
            }
        }
    }

    if let Some(meanings) = entry["meanings"].as_array() {
        'meaning_loop: for m in meanings {
            let pos = m["partOfSpeech"].as_str().unwrap_or("noun").to_string();
            if let Some(syns) = m["synonyms"].as_array() {
                for s in syns.iter().take(4) {
                    if let Some(st) = s.as_str() {
                        if !synonyms.iter().any(|x| x.eq_ignore_ascii_case(st)) {
                            synonyms.push(st.to_string());
                        }
                    }
                }
            }
            if let Some(defs) = m["definitions"].as_array() {
                for d in defs {
                    let def_text = d["definition"].as_str().unwrap_or("").trim();
                    if def_text.is_empty() {
                        continue;
                    }
                    let ex_text = d["example"].as_str().unwrap_or("").trim();
                    if definition_en.is_empty() || !ex_text.is_empty() {
                        part_of_speech = pos.clone();
                        definition_en = def_text.to_string();
                        if !ex_text.is_empty() {
                            example_en = ex_text.to_string();
                            break 'meaning_loop;
                        }
                    }
                }
            }
        }
    }

    if definition_en.is_empty() && !cand_dm_def.is_empty() {
        definition_en = cand_dm_def
            .split('\t')
            .nth(1)
            .unwrap_or(cand_dm_def)
            .trim()
            .to_string();
    }
    if picked_word.is_empty() || definition_en.is_empty() {
        return None;
    }

    if phonetic.is_empty() {
        phonetic = format!("/{}/", picked_word);
    }
    if part_of_speech.is_empty() {
        part_of_speech = "noun".to_string();
    }
    if example_en.is_empty() {
        example_en = format!(
            "Understanding '{}' helps you communicate effectively about {}.",
            picked_word, chosen_topic
        );
    }

    let word_vi = translate_en_to_vi_live(&picked_word, true);
    let def_vi = translate_en_to_vi_live(&definition_en, false);
    let meaning_vi = format_english_meaning_vi(&picked_word, word_vi, def_vi);
    let example_vi = translate_en_to_vi_live(&example_en, false).unwrap_or_default();

    Some(EnglishVocabItem {
        word: picked_word,
        phonetic,
        part_of_speech,
        definition_en,
        meaning_vi,
        example_en,
        example_vi,
        audio_url,
        topic: chosen_topic.to_string(),
        synonyms,
        level: "B1".to_string(),
        mastery_level: 0,
        next_review_at: 0,
        correct_count: 0,
        wrong_count: 0,
        is_starred: false,
        learned_at: 0,
    })
}

fn fill_missing_item_defaults(mut item: EnglishVocabItem, fallback_topic: &str) -> EnglishVocabItem {
    if item.topic.trim().is_empty() {
        item.topic = fallback_topic.to_string();
    }
    if item.level.trim().is_empty() {
        item.level = "B1".to_string();
    }
    if item.phonetic.trim().is_empty() && !item.word.is_empty() {
        item.phonetic = format!("/{}/", item.word);
    }
    if item.example_vi.trim().is_empty() && !item.example_en.trim().is_empty() {
        if let Some(tr) = translate_en_to_vi_live(&item.example_en, false) {
            item.example_vi = tr;
        }
    }
    item
}

#[tauri::command]
pub async fn fetch_real_english_lesson(
    mem_state: tauri::State<'_, MemoryState>,
    topic: Option<String>,
    level: Option<String>,
    exclude_words: Vec<String>,
) -> Result<EnglishVocabItem, String> {
    let hub_base = resolve_cloud_hub_base_url(&mem_state);
    tauri::async_runtime::spawn_blocking(move || {
        let excluded: Vec<String> = exclude_words
            .into_iter()
            .map(|w| w.trim().to_lowercase())
            .filter(|w| !w.is_empty())
            .collect();
        let topic_filter = normalize_vocab_topic_filter(topic);
        let level_filter = normalize_vocab_level_filter(level);

        // 1. Uu tien lay tu kho 30.000+ tu vung tren MongoDB Cloud Hub
        if !hub_base.is_empty() {
            let excl_csv: String = excluded.iter().take(120).cloned().collect::<Vec<_>>().join(",");
            let url = format!(
                "{}/api/vocab/random?topic={}&level={}&limit=1&exclude={}",
                hub_base,
                url_encode_component(&topic_filter),
                url_encode_component(&level_filter),
                url_encode_component(&excl_csv)
            );
            if let Ok(raw) = curl_get_public_json(&url, 5) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                    if val.get("ok").and_then(|v| v.as_bool()) == Some(true) {
                        if let Some(item_val) = val.get("item").filter(|v| !v.is_null()) {
                            if let Ok(parsed) = serde_json::from_value::<EnglishVocabItem>(item_val.clone()) {
                                if !parsed.word.trim().is_empty() && !parsed.meaning_vi.trim().is_empty() {
                                    return Ok(fill_missing_item_defaults(parsed, &topic_filter));
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Fallback Datamuse + Dictionary API (khi backend online chua redeploy /api/vocab)
        let dynamic_seeds = [
            "technology",
            "innovation",
            "finance",
            "strategy",
            "architecture",
            "psychology",
            "leadership",
            "science",
            "sustainability",
            "communication",
            "algorithms",
            "resilience",
            "negotiation",
            "diplomacy",
            "productivity",
            "curiosity",
            "artificial intelligence",
            "economics",
            "entrepreneurship",
            "creativity",
            "philosophy",
            "analytics",
            "efficiency",
            "collaboration",
            "mindfulness",
            "journalism",
            "literature",
            "adventure",
            "exploration",
            "momentum",
            "engineering",
            "security",
            "persuasion",
            "adaptability",
            "precision",
            "visionary",
        ];

        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as usize)
            .unwrap_or(17);

        let lower_topic = topic_filter.as_str();
        let chosen_topic = if lower_topic == "random" || lower_topic == "all" {
            dynamic_seeds[nanos % dynamic_seeds.len()].to_string()
        } else if lower_topic == "ielts" {
            let ielts_pool = ["academic", "resilience", "sustainability", "diplomacy", "analytics"];
            ielts_pool[nanos % ielts_pool.len()].to_string()
        } else if lower_topic == "daily" {
            let daily_pool = ["conversation", "lifestyle", "travel", "food", "habit"];
            daily_pool[nanos % daily_pool.len()].to_string()
        } else {
            topic_filter.clone()
        };

        let encoded_topic = url_encode_component(&chosen_topic);
        let dm_url = format!(
            "https://api.datamuse.com/words?ml={encoded_topic}&md=dpf&max=80"
        );

        let mut candidates: Vec<(String, String)> = Vec::new();
        if let Ok(dm_body) = fetch_url_utf8(&dm_url, 6) {
            if let Ok(arr) = serde_json::from_str::<Vec<serde_json::Value>>(dm_body.trim()) {
                for item in arr {
                    let w = item["word"].as_str().unwrap_or("").trim();
                    if w.len() < 4 || w.len() > 18 || !w.chars().all(|c| c.is_ascii_alphabetic()) {
                        continue;
                    }
                    let lw = w.to_lowercase();
                    if excluded.contains(&lw) {
                        continue;
                    }
                    let fallback_def = item["defs"]
                        .as_array()
                        .and_then(|d| d.first())
                        .and_then(|s| s.as_str())
                        .unwrap_or("")
                        .to_string();
                    candidates.push((lw, fallback_def));
                }
            }
        }

        if candidates.is_empty() {
            if let Ok(rw_body) =
                fetch_url_utf8("https://random-word-api.herokuapp.com/word?number=16", 6)
            {
                if let Ok(words) = serde_json::from_str::<Vec<String>>(rw_body.trim()) {
                    for w in words {
                        let lw = w.trim().to_lowercase();
                        if lw.len() >= 4
                            && lw.chars().all(|c| c.is_ascii_alphabetic())
                            && !excluded.contains(&lw)
                        {
                            candidates.push((lw, String::new()));
                        }
                    }
                }
            }
        }

        if !candidates.is_empty() {
            let total = candidates.len();
            let start_idx = nanos % total;
            for step in 0..total.min(5) {
                let idx = (start_idx + (step * 7) + step) % total;
                let (cand_word, cand_dm_def) = &candidates[idx];
                if let Some(built) =
                    build_vocab_item_from_dictionary_api(cand_word, cand_dm_def, &chosen_topic)
                {
                    return Ok(built);
                }
            }

            let (cw, dm_def) = &candidates[start_idx];
            let (part_of_speech, definition_en) = if let Some((pos, def)) = dm_def.split_once('\t') {
                let mapped_pos = match pos {
                    "n" => "noun",
                    "v" => "verb",
                    "adj" => "adjective",
                    "adv" => "adverb",
                    _ => pos,
                };
                (mapped_pos.to_string(), def.to_string())
            } else {
                (
                    "vocab".to_string(),
                    format!("English term related to {chosen_topic}."),
                )
            };
            let phonetic = format!("/{cw}/");
            let example_en = format!(
                "Understanding '{cw}' helps you communicate effectively about {chosen_topic}."
            );
            let word_vi = translate_en_to_vi_live(cw, true);
            let def_vi = translate_en_to_vi_live(&definition_en, false);
            let meaning_vi = format_english_meaning_vi(cw, word_vi, def_vi);
            let example_vi = translate_en_to_vi_live(&example_en, false).unwrap_or_default();
            return Ok(EnglishVocabItem {
                word: cw.clone(),
                phonetic,
                part_of_speech,
                definition_en,
                meaning_vi,
                example_en,
                example_vi,
                audio_url: String::new(),
                topic: chosen_topic,
                synonyms: Vec::new(),
                level: if level_filter == "all" {
                    "B1".to_string()
                } else {
                    level_filter
                },
                mastery_level: 0,
                next_review_at: 0,
                correct_count: 0,
                wrong_count: 0,
                is_starred: false,
                learned_at: 0,
            });
        }

        // 3. Fallback kho tu vung Offline co san (luon hoat dong khi mat mang)
        let matching_offline: Vec<_> = OFFLINE_ENGLISH_DECK
            .iter()
            .filter(|s| {
                let not_excl = !excluded.iter().any(|e| e.eq_ignore_ascii_case(s.word));
                let topic_ok = topic_filter == "random"
                    || topic_filter == "all"
                    || s.topic.eq_ignore_ascii_case(&topic_filter);
                let level_ok =
                    level_filter == "all" || s.level.eq_ignore_ascii_case(&level_filter);
                not_excl && topic_ok && level_ok
            })
            .collect();
        if let Some(pick) = matching_offline.get(nanos % matching_offline.len().max(1)) {
            return Ok(pick.to_item());
        }

        let unlearned_any: Vec<_> = OFFLINE_ENGLISH_DECK
            .iter()
            .filter(|s| !excluded.iter().any(|e| e.eq_ignore_ascii_case(s.word)))
            .collect();
        let pool = if unlearned_any.is_empty() {
            OFFLINE_ENGLISH_DECK.iter().collect::<Vec<_>>()
        } else {
            unlearned_any
        };
        Ok(pool[nanos % pool.len()].to_item())
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ học Tiếng Anh: {e}"))?
}

#[tauri::command]
pub async fn search_english_vocab(
    mem_state: tauri::State<'_, MemoryState>,
    query: String,
    topic: Option<String>,
    level: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<EnglishVocabItem>, String> {
    let hub_base = resolve_cloud_hub_base_url(&mem_state);
    tauri::async_runtime::spawn_blocking(move || {
        let q = query.trim().to_string();
        let topic_filter = normalize_vocab_topic_filter(topic);
        let level_filter = normalize_vocab_level_filter(level);
        let lim = limit.unwrap_or(20).clamp(1, 40);
        let mut results: Vec<EnglishVocabItem> = Vec::new();

        if !hub_base.is_empty() {
            let url = format!(
                "{}/api/vocab/search?q={}&topic={}&level={}&limit={}",
                hub_base,
                url_encode_component(&q),
                url_encode_component(&topic_filter),
                url_encode_component(&level_filter),
                lim
            );
            if let Ok(raw) = curl_get_public_json(&url, 5) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                    if val.get("ok").and_then(|v| v.as_bool()) == Some(true) {
                        if let Some(arr) = val.get("items").and_then(|v| v.as_array()) {
                            for el in arr {
                                if let Ok(item) = serde_json::from_value::<EnglishVocabItem>(el.clone()) {
                                    if !item.word.trim().is_empty() {
                                        results.push(fill_missing_item_defaults(item, &topic_filter));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Neu chua co hoac dang offline: tra tu kho offline + Dictionary API truc tiep cho tu don
        let q_lower = q.to_lowercase();
        let has_exact = !q_lower.is_empty()
            && results
                .iter()
                .any(|r| r.word.eq_ignore_ascii_case(&q_lower));
        if !has_exact
            && !q_lower.is_empty()
            && q_lower.len() <= 32
            && q_lower.chars().all(|c| c.is_ascii_alphabetic() || c == '-' || c == ' ')
        {
            if let Some(dict_item) = build_vocab_item_from_dictionary_api(&q_lower, "", "lookup") {
                results.insert(0, dict_item);
            }
        }

        for seed in OFFLINE_ENGLISH_DECK {
            if results.len() >= lim {
                break;
            }
            let topic_ok = topic_filter == "random"
                || topic_filter == "all"
                || seed.topic.eq_ignore_ascii_case(&topic_filter);
            let level_ok = level_filter == "all" || seed.level.eq_ignore_ascii_case(&level_filter);
            let query_ok = q_lower.is_empty()
                || seed.word.to_lowercase().contains(&q_lower)
                || seed.meaning_vi.to_lowercase().contains(&q_lower);
            if topic_ok
                && level_ok
                && query_ok
                && !results.iter().any(|r| r.word.eq_ignore_ascii_case(seed.word))
            {
                results.push(seed.to_item());
            }
        }

        Ok(results)
    })
    .await
    .map_err(|e| format!("Lỗi tra cứu từ vựng: {e}"))?
}

#[tauri::command]
pub async fn fetch_english_vocab_cloud_stats(
    mem_state: tauri::State<'_, MemoryState>,
) -> Result<serde_json::Value, String> {
    let hub_base = resolve_cloud_hub_base_url(&mem_state);
    tauri::async_runtime::spawn_blocking(move || {
        if !hub_base.is_empty() {
            let url = format!("{hub_base}/api/vocab/stats");
            if let Ok(raw) = curl_get_public_json(&url, 4) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                    if val.get("ok").and_then(|v| v.as_bool()) == Some(true) {
                        return Ok(val);
                    }
                }
            }
        }
        Ok(serde_json::json!({
            "ok": false,
            "total_words": OFFLINE_ENGLISH_DECK.len(),
            "offline_fallback": true
        }))
    })
    .await
    .map_err(|e| format!("Lỗi lấy thống kê từ vựng: {e}"))?
}

#[tauri::command]
pub async fn fetch_english_tts_audio(
    text: String,
    slow: Option<bool>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let trimmed: String = text.trim().chars().take(200).collect();
        if trimmed.is_empty() {
            return Err("Nội dung đọc tiếng Anh trống".to_string());
        }
        let encoded = url_encode_component(&trimmed);
        let speed = if slow.unwrap_or(false) { "0.3" } else { "1" };
        let url = format!(
            "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&ttsspeed={speed}&q={encoded}"
        );
        let mut cmd = Command::new("curl.exe");
        cmd.args([
            "-s",
            "-L",
            "-m",
            "6",
            "-A",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "-H",
            "Referer: https://translate.google.com/",
            &url,
        ]);
        apply_no_window(&mut cmd);
        let out = cmd.output().map_err(|e| format!("Không chạy được curl TTS: {e}"))?;
        if !out.status.success() || out.stdout.len() < 128 {
            return Err("Không tải được luồng âm thanh TTS Tiếng Anh".to_string());
        }
        if out.stdout.starts_with(b"<!")
            || out.stdout.starts_with(b"<html")
            || out.stdout.starts_with(b"<HTML")
        {
            return Err("Endpoint TTS trả về trang HTML thay vì MP3".to_string());
        }
        Ok(format!("data:audio/mpeg;base64,{}", bytes_to_base64(&out.stdout)))
    })
    .await
    .map_err(|e| format!("Lỗi TTS Tiếng Anh: {e}"))?
}

fn bytes_to_base64(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((input.len() + 2) / 3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((triple >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

#[tauri::command]
pub async fn fetch_vietnamese_tts_audio(text: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let trimmed: String = text.trim().chars().take(190).collect();
        if trimmed.is_empty() {
            return Err("Nội dung đọc trống".to_string());
        }
        let encoded = url_encode_component(&trimmed);
        let url = format!(
            "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q={encoded}"
        );
        let mut cmd = Command::new("curl.exe");
        cmd.args([
            "-s",
            "-L",
            "-m",
            "6",
            "-A",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "-H",
            "Referer: https://translate.google.com/",
            &url,
        ]);
        apply_no_window(&mut cmd);
        let out = cmd.output().map_err(|e| format!("Không chạy được curl TTS: {e}"))?;
        if !out.status.success() || out.stdout.len() < 128 {
            return Err("Không tải được luồng âm thanh TTS Tiếng Việt".to_string());
        }
        if out.stdout.starts_with(b"<!") || out.stdout.starts_with(b"<html") || out.stdout.starts_with(b"<HTML") {
            return Err("Endpoint TTS trả về trang HTML thay vì MP3".to_string());
        }
        Ok(format!("data:audio/mpeg;base64,{}", bytes_to_base64(&out.stdout)))
    })
    .await
    .map_err(|e| format!("Lỗi TTS: {e}"))?
}



