import json
from typing import Dict, Any, List
from .base_tool import BaseTool


class SqlQueryGeneratorTool(BaseTool):
    name = "sql_query_generator_tool"
    description = (
        "Công cụ Thiết kế Database Schema & Sinh câu truy vấn SQL/NoSQL tối ưu "
        "(PostgreSQL, MySQL, SQLite): tự động viết câu lệnh DDL, SELECT, JOIN, CTE, "
        "Window Functions và đề xuất đánh Index tối ưu hiệu năng."
    )

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            if isinstance(arguments, str):
                task = arguments
                dialect = "postgresql"
                tables = []
            elif isinstance(arguments, dict):
                task = (
                    arguments.get("task")
                    or arguments.get("requirement")
                    or arguments.get("query_goal")
                    or arguments.get("input")
                    or "Thống kê doanh thu và đơn hàng theo khách hàng"
                )
                dialect = str(arguments.get("dialect") or "postgresql").lower()
                tables = arguments.get("tables") or []
            else:
                task = str(arguments)
                dialect = "postgresql"
                tables = []

            task_lower = str(task).lower()
            queries: Dict[str, str] = {}
            indexes: List[str] = []

            if any(k in task_lower for k in ["doanh thu", "revenue", "order", "đơn hàng", "bán hàng", "khách hàng"]):
                queries["schema_ddl"] = (
                    "CREATE TABLE IF NOT EXISTS customers (\n"
                    "    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n"
                    "    full_name VARCHAR(150) NOT NULL,\n"
                    "    email VARCHAR(255) UNIQUE NOT NULL,\n"
                    "    tier VARCHAR(32) DEFAULT 'standard',\n"
                    "    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n"
                    ");\n\n"
                    "CREATE TABLE IF NOT EXISTS orders (\n"
                    "    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n"
                    "    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,\n"
                    "    status VARCHAR(32) NOT NULL DEFAULT 'completed',\n"
                    "    total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),\n"
                    "    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n"
                    ");"
                )
                queries["analytical_query"] = (
                    "WITH customer_metrics AS (\n"
                    "    SELECT\n"
                    "        c.id AS customer_id,\n"
                    "        c.full_name,\n"
                    "        c.email,\n"
                    "        COUNT(o.id) AS total_orders,\n"
                    "        COALESCE(SUM(o.total_amount), 0) AS lifetime_value,\n"
                    "        AVG(o.total_amount) AS avg_order_value,\n"
                    "        MAX(o.created_at) AS last_order_at\n"
                    "    FROM customers c\n"
                    "    LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'\n"
                    "    GROUP BY c.id, c.full_name, c.email\n"
                    ")\n"
                    "SELECT\n"
                    "    *,\n"
                    "    DENSE_RANK() OVER (ORDER BY lifetime_value DESC) AS revenue_rank\n"
                    "FROM customer_metrics\n"
                    "ORDER BY lifetime_value DESC\n"
                    "LIMIT 50;"
                )
                indexes = [
                    "CREATE INDEX CONCURRENTLY idx_orders_customer_status_date ON orders (customer_id, status, created_at DESC);",
                    "CREATE INDEX CONCURRENTLY idx_orders_created_at_brin ON orders USING BRIN (created_at);",
                ]
            elif any(k in task_lower for k in ["user", "auth", "đăng nhập", "role", "permission", "phân quyền"]):
                queries["schema_ddl"] = (
                    "CREATE TABLE IF NOT EXISTS users (\n"
                    "    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n"
                    "    username VARCHAR(64) UNIQUE NOT NULL,\n"
                    "    email VARCHAR(255) UNIQUE NOT NULL,\n"
                    "    password_hash TEXT NOT NULL,\n"
                    "    role VARCHAR(32) NOT NULL DEFAULT 'user',\n"
                    "    is_active BOOLEAN NOT NULL DEFAULT TRUE,\n"
                    "    last_login_at TIMESTAMPTZ,\n"
                    "    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n"
                    ");"
                )
                queries["analytical_query"] = (
                    "SELECT id, username, email, role, last_login_at\n"
                    "FROM users\n"
                    "WHERE is_active = TRUE AND role = $1\n"
                    "ORDER BY last_login_at DESC NULLS LAST\n"
                    "LIMIT 100;"
                )
                indexes = [
                    "CREATE INDEX idx_users_active_role ON users (is_active, role);",
                    "CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));",
                ]
            else:
                table_name = tables[0] if tables else "records"
                queries["schema_ddl"] = (
                    f"CREATE TABLE IF NOT EXISTS {table_name} (\n"
                    f"    id BIGSERIAL PRIMARY KEY,\n"
                    f"    category VARCHAR(100) NOT NULL,\n"
                    f"    metric_value DOUBLE PRECISION NOT NULL DEFAULT 0,\n"
                    f"    metadata JSONB DEFAULT '{{}}'::jsonb,\n"
                    f"    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n"
                    f");"
                )
                queries["analytical_query"] = (
                    f"SELECT\n"
                    f"    category,\n"
                    f"    COUNT(*) AS record_count,\n"
                    f"    ROUND(AVG(metric_value)::numeric, 2) AS avg_metric,\n"
                    f"    SUM(metric_value) AS total_metric,\n"
                    f"    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value) AS p95_metric\n"
                    f"FROM {table_name}\n"
                    f"WHERE created_at >= NOW() - INTERVAL '30 days'\n"
                    f"GROUP BY category\n"
                    f"ORDER BY total_metric DESC;"
                )
                indexes = [
                    f"CREATE INDEX idx_{table_name}_category_created ON {table_name} (category, created_at DESC);",
                    f"CREATE INDEX idx_{table_name}_metadata_gin ON {table_name} USING GIN (metadata);",
                ]

            return json.dumps(
                {
                    "success": True,
                    "dialect": dialect,
                    "task": task,
                    "generated_sql": queries,
                    "recommended_indexes": indexes,
                    "optimization_tips": [
                        "Sử dụng tham số hóa ($1, :param) để chống SQL Injection tuyệt đối.",
                        "Tránh dùng SELECT * trên bảng lớn; chỉ lấy các cột cần thiết để tận dụng Index-Only Scan.",
                        "Sử dụng EXPLAIN (ANALYZE, BUFFERS) để kiểm tra Seq Scan trước khi đưa lên Production.",
                    ],
                },
                ensure_ascii=False,
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
