// src/middlewares/metrics.middleware.ts
import promBundle from "express-prom-bundle";

export const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    promClient: {
        collectDefaultMetrics: {
            prefix: "user_service_",
        },
    },
});