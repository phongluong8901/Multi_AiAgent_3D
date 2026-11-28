import bcrypt from "bcrypt";

// Định nghĩa và export hàm băm mật khẩu dạng bất đồng bộ (async), trả về một Promise chứa chuỗi hash
export const hashPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

// Định nghĩa và export hàm kiểm tra mật khẩu người dùng nhập vào so với chuỗi hash trong CSDL
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return await bcrypt.compare(password, hash);
};