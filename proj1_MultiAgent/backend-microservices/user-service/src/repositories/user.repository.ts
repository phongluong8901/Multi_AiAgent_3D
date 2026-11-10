import { UserModel, IUser } from "../models/user.model"; // Import mô hình UserModel và giao diện IUser từ file model dữ liệu

// Khởi tạo và export lớp UserRepository chứa các phương thức tương tác trực tiếp với cơ sở dữ liệu MongoDB
export class UserRepository {

    // Phương thức bất đồng bộ tạo mới một tài liệu người dùng trong cơ sở dữ liệu
    async create(userData: Partial<IUser>): Promise<IUser> {
        const user = new UserModel(userData); // Khởi tạo instance mới của UserModel từ dữ liệu truyền vào
        return await user.save(); // Lưu tài liệu vào cơ sở dữ liệu MongoDB và trả về kết quả
    }

    // Phương thức lấy danh sách toàn bộ người dùng, đồng thời ẩn trường mật khẩu (passwordHash) để bảo mật
    // Chỉ lấy những user chưa bị xóa mềm (isDeleted: false)
    async findAll(): Promise<IUser[]> {
        return await UserModel.find({ isDeleted: { $ne: true } }).select("-passwordHash");
    }

    // Phương thức tìm kiếm người dùng theo mã định danh (ID) và loại bỏ trường mật khẩu
    async findById(id: string): Promise<IUser | null> {
        return await UserModel.findById(id).select("-passwordHash"); // Tìm kiếm theo ID, ẩn passwordHash hoặc trả về null nếu không tìm thấy
    }

    // Phương thức tìm kiếm người dùng theo địa chỉ email (thường dùng khi đăng nhập, giữ lại passwordHash để xác thực mật khẩu)
    async findByEmail(email: string): Promise<IUser | null> {
        return await UserModel.findOne({ email }); // Tìm một bản ghi khớp với email
    }

    // Phương thức tìm kiếm người dùng theo mã định danh Google ID (dùng trong xác thực SSO Google)
    async findByGoogleId(googleId: string): Promise<IUser | null> {
        return await UserModel.findOne({ googleId }); // Tìm bản ghi khớp với googleId
    }

    // Phương thức tìm kiếm người dùng theo mã định danh GitHub ID (dùng trong xác thực SSO GitHub)
    async findByGithubId(githubId: string): Promise<IUser | null> {
        return await UserModel.findOne({ githubId }); // Tìm bản ghi khớp với githubId
    }

    // Phương thức tìm kiếm người dùng theo mã định danh Hugging Face ID (dùng trong xác thực SSO Hugging Face)
    async findByHuggingfaceId(huggingfaceId: string): Promise<IUser | null> {
        return await UserModel.findOne({ huggingfaceId }); // Tìm bản ghi khớp với huggingfaceId
    }

    // Phương thức tìm kiếm người dùng theo mã thông báo xác thực tài khoản (verificationToken)
    async findByVerificationToken(token: string) {
        return await UserModel.findOne({ verificationToken: token }); // Tìm kiếm theo token xác thực email
    }

    // Phương thức cập nhật thông tin người dùng theo ID, trả về bản ghi sau khi cập nhật (new: true) và ẩn passwordHash
    async update(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
        return await UserModel.findByIdAndUpdate(id, updateData, { new: true }).select("-passwordHash");
    }

    // Phương thức xóa tài khoản người dùng theo ID, trả về giá trị boolean xác định xóa thành công hay không
    async delete(id: string): Promise<boolean> {
        const result = await UserModel.findByIdAndDelete(id); // Thực hiện tìm và xóa bản ghi
        return result !== null; // Trả về true nếu tìm thấy và xóa thành công, ngược lại trả về false
    }

    // Thực hiện Xóa mềm (Soft Delete) thay vì xóa vĩnh viễn khỏi CSDL
    async softDelete(id: string): Promise<boolean> {
        const result = await UserModel.findOneAndUpdate(
            { _id: id, isDeleted: { $ne: true } },
            { isDeleted: true, deletedAt: new Date(), status: "offline" },
            { new: true }
        );
        return result !== null;
    }

    async findByRole(role: "guest" | "user" | "admin" | "seller"): Promise<IUser[]> {
        return await UserModel.find({ role, isDeleted: { $ne: true } }).select("-passwordHash");
    }

    // 1. Tối ưu thuật toán tìm kiếm vị trí địa lý (Geo-spatial Query)
    async findNearbyAINodes(longitude: number, latitude: number, maxDistanceMeters: number = 50000) {
        return await UserModel.find({
            isDeleted: { $ne: true },
            'hardwareNode.canRunAI': true,
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [longitude, latitude]
                    },
                    $maxDistance: maxDistanceMeters
                }
            }
        }).select("username email avatarUrl status location hardwareNode role").lean();
    }


}

// Khởi tạo và export đối tượng userRepository dùng chung cho toàn bộ các service trong ứng dụng
export const userRepository = new UserRepository();