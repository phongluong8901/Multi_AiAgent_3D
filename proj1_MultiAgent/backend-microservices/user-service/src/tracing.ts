// src/tracing.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Cấu hình bộ xuất dữ liệu trace trỏ tới OTLP Collector hoặc Grafana Tempo
const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://tempo:4318/v1/traces",
});

// Khởi tạo SDK OpenTelemetry chuẩn xác với resourceFromAttributes
const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: "user-service",
    }),
    traceExporter,
    instrumentations: [
        getNodeAutoInstrumentations({
            "@opentelemetry/instrumentation-http": { enabled: true },
            "@opentelemetry/instrumentation-express": { enabled: true },
            "@opentelemetry/instrumentation-mongodb": { enabled: true },
            "@opentelemetry/instrumentation-redis": { enabled: true },
        }),
    ],
});

// Bắt đầu chạy tracing
sdk.start();

// Xử lý sự kiện tắt tiến trình an toàn
process.on("SIGTERM", () => {
    sdk.shutdown()
        .catch((error) => console.error("Error terminating tracing", error))
        .finally(() => process.exit(0));
});