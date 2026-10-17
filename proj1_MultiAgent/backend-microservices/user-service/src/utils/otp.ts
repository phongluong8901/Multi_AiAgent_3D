export const generateOtpCode = (): string => {
    // Sinh mã ngẫu nhiên 6 chữ số (từ 100000 đến 999999)
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getOtpExpirationTime = (minutes: number = 5): Date => {
    // Tính thời gian hết hạn (mặc định 5 phút tính từ thời điểm hiện tại)
    return new Date(Date.now() + minutes * 60 * 1000);
};