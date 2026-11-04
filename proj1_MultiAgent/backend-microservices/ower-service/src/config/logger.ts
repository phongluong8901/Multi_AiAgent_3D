export const logger = {
    info: (...args: any[]) => console.log(`[ower-service] [INFO]`, ...args),
    warn: (...args: any[]) => console.warn(`[ower-service] [WARN]`, ...args),
    error: (...args: any[]) => console.error(`[ower-service] [ERROR]`, ...args),
};
