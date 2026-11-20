use ai_desktop_mate_lib::backend::tool_forge::{
    audit_script_safety, run_script_isolated, verify_and_record_sandbox, verify_receipt_for_hash,
    ToolForgeState,
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
