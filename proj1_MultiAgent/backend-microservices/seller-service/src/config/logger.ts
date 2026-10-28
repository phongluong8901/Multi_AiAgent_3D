export const logger = {
    info: (...args: any[]) => console.log(`[seller-service] [INFO]`, ...args),
    warn: (...args: any[]) => console.warn(`[seller-service] [WARN]`, ...args),
    error: (...args: any[]) => console.error(`[seller-service] [ERROR]`, ...args),
};
