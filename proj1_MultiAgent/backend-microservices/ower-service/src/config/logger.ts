/**
 * Logger tap trung cho Owner Service:
 * Su dung tien to chuan muc [ower-service] va bracketed levels ([INFO], [WARN], [ERROR])
 * tuan thu tuyet doi tieu chuan khong dung emoji.
 */
export const logger = {
    info: (...args: any[]) => console.log(`[ower-service] [INFO]`, ...args),
    warn: (...args: any[]) => console.warn(`[ower-service] [WARN]`, ...args),
    error: (...args: any[]) => console.error(`[ower-service] [ERROR]`, ...args),
};
