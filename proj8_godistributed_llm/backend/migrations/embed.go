package migrations

import _ "embed"

// InitSQL chứa DDL khởi tạo các bảng PostgreSQL từ 001_init.sql.
//
//go:embed 001_init.sql
var InitSQL string

