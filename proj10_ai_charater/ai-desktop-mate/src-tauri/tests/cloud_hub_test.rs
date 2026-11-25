use ai_desktop_mate_lib::backend::cloud_hub::{
    base64_url_nopad, build_google_auth_url, parse_hub_skills_response,
    parse_oauth_callback_query, pkce_code_challenge_s256, sha256_bytes,
};

#[test]
fn test_sha256_and_pkce_s256_vector() {
    let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    let expected_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    assert_eq!(pkce_code_challenge_s256(verifier), expected_challenge);

    let abc = sha256_bytes(b"abc");
    assert_eq!(
        base64_url_nopad(&abc),
        "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0"
    );
}

#[test]
fn test_google_auth_url_and_callback_parser() {
    let url = build_google_auth_url(
        "12345.apps.googleusercontent.com",
        "http://127.0.0.1:51234/callback",
        "st_abc_123",
        "chal_xyz",
    );
    assert!(url.starts_with("https://accounts.google.com/o/oauth2/v2/auth?"));
    assert!(url.contains("client_id=12345.apps.googleusercontent.com"));
    assert!(url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A51234%2Fcallback"));
    assert!(url.contains("code_challenge=chal_xyz"));
    assert!(url.contains("code_challenge_method=S256"));

    let req_line = "GET /callback?code=4%2F0AQlEd8_sample&state=st_abc_123&scope=email%20profile HTTP/1.1";
    let parsed = parse_oauth_callback_query(req_line).expect("Should parse callback query");
    assert_eq!(parsed.get("code").map(String::as_str), Some("4/0AQlEd8_sample"));
    assert_eq!(parsed.get("state").map(String::as_str), Some("st_abc_123"));
}

#[test]
fn test_parse_hub_skills_response_and_error_handling() {
    let ok_json = r#"{
        "ok": true,
        "items": [
            {
                "skill_key": "sub123:port_check",
                "id": "port_check",
                "name": "Port Checker",
                "description": "Kiem tra port dang mo",
                "language": "powershell",
                "code": "Write-Output 'OK'",
                "author_email": "dev@example.com",
                "author_name": "Dev",
                "downloads": 7,
                "version": 2
            }
        ]
    }"#;
    let docs = parse_hub_skills_response(ok_json).expect("Should parse Cloud Hub items");
    assert_eq!(docs.len(), 1);
    assert_eq!(docs[0].skill_key, "sub123:port_check");
    assert_eq!(docs[0].downloads, 7);
    assert_eq!(docs[0].version, 2);

    let err_json = r#"{"ok": false, "error": "AUTH_REQUIRED"}"#;
    let err = parse_hub_skills_response(err_json).expect_err("Should surface Cloud Hub error");
    assert!(err.contains("AUTH_REQUIRED"));
}
