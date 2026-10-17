import { UserModel, IUser } from "../models/user.model";

export class UserRepository {
    async create(userData: Partial<IUser>): Promise<IUser> {
        const user = new UserModel(userData);
        return await user.save();
    }

    async findAll(): Promise<IUser[]> {
        return await UserModel.find().select("-passwordHash");
    }

    async findById(id: string): Promise<IUser | null> {
        return await UserModel.findById(id).select("-passwordHash");
    }

    async findByEmail(email: string): Promise<IUser | null> {
        return await UserModel.findOne({ email });
    }

    async findByGoogleId(googleId: string): Promise<IUser | null> {
        return await UserModel.findOne({ googleId });
    }

    async findByVerificationToken(token: string) {
        return await UserModel.findOne({ verificationToken: token });
    }

    async update(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
        return await UserModel.findByIdAndUpdate(id, updateData, { new: true }).select("-passwordHash");
    }

    async delete(id: string): Promise<boolean> {
        const result = await UserModel.findByIdAndDelete(id);
        return result !== null;
    }
}

export const userRepository = new UserRepository();