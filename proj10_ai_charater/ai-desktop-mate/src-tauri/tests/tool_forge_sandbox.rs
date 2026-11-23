use ai_desktop_mate_lib::backend::tool_forge::{
    audit_script_safety, resolve_live_working_dir, run_script_isolated, verify_and_record_sandbox,
    verify_receipt_for_hash, ToolForgeState,
};

#[test]
fn test_safety_audit_blocks_dangerous_and_secret_access() {
    let issues_disk = audit_script_safety("powershell", "Format-Volume -DriveLetter D");
    assert!(
        !issues_disk.is_empty(),
        "Expected destructive disk command to be blocked"
    );

    let issues_env = audit_script_safety("powershell", "Get-Content .env");
    assert!(
        !issues_env.is_empty(),
        "Expected .env secret read to be blocked"
    );

    let issues_py_env = audit_script_safety("python", "open('.env').read()");
    assert!(
        !issues_py_env.is_empty(),
        "Expected Python open('.env') to be blocked"
    );

    let issues_py_environ = audit_script_safety(
        "python",
        "import os, json\nprint(os.environ.get('DUCK_TOOL_ARGS_JSON', '{}'))",
    );
    assert!(
        issues_py_environ.is_empty(),
        "Python os.environ.get must NOT false-positive on .env: {:?}",
        issues_py_environ
    );

    let issues_db = audit_script_safety("python", "open('mate_memory.db', 'rb')");
    assert!(
        !issues_db.is_empty(),
        "Expected direct DB access to be blocked"
    );

    let issues_ok = audit_script_safety(
        "powershell",
        "$a = $env:DUCK_TOOL_ARGS_JSON | ConvertFrom-Json; Write-Output 'OK'",
    );
    assert!(
        issues_ok.is_empty(),
        "Safe script should pass audit: {:?}",
        issues_ok
    );
}

#[test]
fn test_sandbox_runs_real_powershell_and_scrubs_secrets() {
    let code = r#"
$raw = $env:DUCK_TOOL_ARGS_JSON
$argsObj = $raw | ConvertFrom-Json
$k = ('GEMINI' + '_API_KEY')
$hasSecret = [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($k))
Write-Output ("SANDBOX=" + $env:DUCK_SANDBOX_MODE + "|PORT=" + $argsObj.port + "|SCRUBBED=" + $hasSecret)
"#;
    let state = ToolForgeState::new();
    let res = verify_and_record_sandbox(
        &state.verified_receipts,
        "powershell",
        code,
        r#"{"port":59999}"#,
        &["PORT=59999".to_string(), "SCRUBBED=True".to_string()],
    );
    assert!(
        res.verified,
        "Sandbox should verify clean PowerShell run: {:?}",
        res
    );
    assert_eq!(res.exit_code, 0);
    assert!(res.stdout.contains("SANDBOX=1|PORT=59999|SCRUBBED=True"));
}

#[test]
fn test_sandbox_timeout_kills_runaway_script() {
    let code = "Start-Sleep -Seconds 15; Write-Output 'DONE'";
    let res = run_script_isolated("powershell", code, "{}", true, 3);
    assert!(!res.verified);
    assert!(
        res.timed_out,
        "Long sleeping script should be killed on timeout"
    );
}

#[test]
fn test_verification_gate_rejects_unverified_hash() {
    let state = ToolForgeState::new();
    let code_v1 = "Write-Output 'VERIFIED_PORT_CHECK'";
    let res = verify_and_record_sandbox(
        &state.verified_receipts,
        "powershell",
        code_v1,
        "{}",
        &["VERIFIED_PORT_CHECK".to_string()],
    );
    assert!(res.verified);

    assert!(verify_receipt_for_hash(&state.verified_receipts, "powershell", code_v1).is_ok());

    let tampered = "Write-Output 'UNVERIFIED_EDIT'";
    let gate_err = verify_receipt_for_hash(&state.verified_receipts, "powershell", tampered);
    assert!(
        gate_err.is_err(),
        "Tampered/unverified code must fail hard packaging gate"
    );
}

#[test]
fn test_live_draft_execution_runs_with_sandbox_mode_zero() {
    let code = r#"
$raw = $env:DUCK_TOOL_ARGS_JSON
$argsObj = if ($raw) { $raw | ConvertFrom-Json } else { [PSCustomObject]@{ target = 'empty' } }
$k = ('GEMINI' + '_API_KEY')
$hasSecret = [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($k))
Write-Output ("SANDBOX=" + $env:DUCK_SANDBOX_MODE + "|TARGET=" + $argsObj.target + "|SCRUBBED=" + $hasSecret)
"#;
    let res = run_script_isolated("powershell", code, r#"{"target":"live_check"}"#, false, 10);
    assert!(
        res.static_safe,
        "Safe script must pass static audit: {:?}",
        res.safety_issues
    );
    assert!(!res.timed_out, "Live check script must not time out");
    assert_eq!(
        res.exit_code, 0,
        "reason: {} | stderr: {}",
        res.failure_reason, res.stderr
    );
    assert!(
        res.stdout
            .contains("SANDBOX=0|TARGET=live_check|SCRUBBED=True"),
        "Unexpected live stdout: {}",
        res.stdout
    );
}

#[test]
fn test_sandbox_runs_complex_python_csv_and_xlsx_tool() {
    let code = r#"
import csv
import json
import os
import openpyxl

args = json.loads(os.environ.get("DUCK_TOOL_ARGS_JSON", "{}") or "{}")
base_dir = os.environ.get("DUCK_SANDBOX_DIR", ".")
csv_path = os.path.join(base_dir, args.get("csv_name", "sales_vi.csv"))
xlsx_path = os.path.join(base_dir, args.get("xlsx_name", "sales_vi.xlsx"))

with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["TenSP", "SoLuong", "DonGia"])
    w.writerow(["Banh Mi", 2, 15000])

with open(csv_path, "a", newline="", encoding="utf-8-sig") as f:
    csv.writer(f).writerow(["Ca Phe Sua", 3, 25000])

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "BaoCao"
with open(csv_path, "r", newline="", encoding="utf-8-sig") as f:
    for row in csv.reader(f):
        ws.append(row)
ws["B2"] = 5
wb.save(xlsx_path)

wb2 = openpyxl.load_workbook(xlsx_path)
ws2 = wb2["BaoCao"]
print(f"CSV_XLSX_OK | ROWS={ws2.max_row} | B2={ws2['B2'].value} | SANDBOX={os.environ.get('DUCK_SANDBOX_MODE')}")
"#;
    let state = ToolForgeState::new();
    let res = verify_and_record_sandbox(
        &state.verified_receipts,
        "python",
        code,
        r#"{"csv_name":"ban_hang.csv","xlsx_name":"ban_hang.xlsx"}"#,
        &["CSV_XLSX_OK".to_string(), "ROWS=3".to_string(), "B2=5".to_string()],
    );
    assert!(
        res.verified,
        "Complex Python CSV+XLSX script should verify cleanly in Sandbox: {:?}",
        res
    );
    assert_eq!(
        res.exit_code, 0,
        "reason: {} | stderr: {}",
        res.failure_reason, res.stderr
    );
    assert!(
        res.stdout.contains("CSV_XLSX_OK | ROWS=3 | B2=5 | SANDBOX=1"),
        "Unexpected stdout: {}",
        res.stdout
    );
}

#[test]
fn test_parse_gemini_candidate_text_filters_thoughts_and_reads_finish_reason() {
    let mock_resp = serde_json::json!({
        "candidates": [{
            "finishReason": "STOP",
            "content": {
                "parts": [
                    { "text": "internal reasoning notes...", "thought": true },
                    { "text": "```json\n{\"id\":\"csv_xlsx_manager\"}\n```\n" },
                    { "text": "```python\nprint('ok')\n```" }
                ]
            }
        }]
    });
    let parsed = ai_desktop_mate_lib::backend::llm::parse_gemini_candidate_text(&mock_resp);
    let (text, finish_reason) = parsed.expect("Expected parsed Gemini candidate text");
    assert_eq!(finish_reason, "STOP");
    assert!(!text.contains("internal reasoning"), "Thought parts must be excluded");
    assert!(text.contains("\"csv_xlsx_manager\""));
    assert!(text.contains("print('ok')"));
}

#[test]
fn test_live_execution_uses_output_dir_and_persists_created_file() {
    let fname = format!("__duck_live_persist_{}.csv", std::process::id());
    let expected_path = resolve_live_working_dir().join(&fname);
    let _ = std::fs::remove_file(&expected_path);

    let code = r#"
import csv, json, os
args = json.loads(os.environ.get("DUCK_TOOL_ARGS_JSON", "{}") or "{}")
out_name = args.get("path", "fallback.csv")
with open(out_name, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["SanPham", "Gia"])
    w.writerow(["Ca Phe", 25000])
print(f"CREATED_OK:{out_name}")
"#;
    let args_json = format!(r#"{{"path":"{fname}"}}"#);
    let res = run_script_isolated("python", code, &args_json, false, 20);
    let existed = expected_path.exists();
    let _ = std::fs::remove_file(&expected_path);

    assert_eq!(
        res.exit_code, 0,
        "reason: {} | stderr: {}",
        res.failure_reason, res.stderr
    );
    assert!(
        existed,
        "Expected live file to persist at {:?}",
        expected_path
    );
    assert!(
        res.stdout.contains("[FILE ĐÃ LƯU]") && res.stdout.contains(&fname),
        "Expected full saved path notice in stdout, got: {}",
        res.stdout
    );
}
