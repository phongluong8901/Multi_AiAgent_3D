export const generateOtpCode = (): string => {
    // Sinh mã ngẫu nhiên 6 chữ số (từ 100000 đến 999999)
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getOtpExpirationTime = (minutes: number = 5): Date => {
    // Tính thời gian hết hạn (mặc định 5 phút tính từ thời điểm hiện tại)
    return new Date(Date.now() + minutes * 60 * 1000);
};

export const isOtpExpired = (expiresAt: Date): boolean => {
    // Kiểm tra xem mã OTP đã hết hạn hay chưa
    return new Date() > expiresAt;
};

export const isOtpValid = (enteredOtp: string, expectedOtp: string): boolean => {
    // Kiểm tra xem mã OTP nhập vào có khớp với mã OTP dự kiến hay không
    return enteredOtp === expectedOtp;
};

export const getRemainingOtpTime = (expiresAt: Date): number => {
    // Tính thời gian còn lại của mã OTP (tính bằng giây)
    return Math.max(0, Math.floor((expiresAt.getTime() - new Date().getTime()) / 1000));
};