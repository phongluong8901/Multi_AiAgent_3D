import { userRepository } from "../repositories/user.repository";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export class UserService {
    async register(data: { username: string; email: string; password: string; role?: any }) {
        const existing = await userRepository.findByEmail(data.email);
        if (existing) {
            throw new Error("Email already in use");
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);

        const newUser = await userRepository.create({
            username: data.username,
            email: data.email,
            passwordHash,
            role: data.role || "employee",
        });

        // Trả về dữ liệu không kèm passwordHash
        const userObj = newUser.toObject();
        delete (userObj as any).passwordHash;
        return userObj;
    }

    async login(data: { email: string; password: string }) {
        const user = await userRepository.findByEmail(data.email);
        if (!user) {
            throw new Error("Invalid email or password");
        }

        const isMatch = await bcrypt.compare(data.password, user.passwordHash);
        if (!isMatch) {
            throw new Error("Invalid email or password");
        }

        const secret = process.env.JWT_SECRET || "fallback_secret";
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            secret,
            { expiresIn: "7d" }
        );

        return {
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                status: user.status,
            },
        };
    }

    async getAllUsers() {
        return await userRepository.findAll();
    }

    async getUserById(id: string) {
        const user = await userRepository.findById(id);
        if (!user) throw new Error("User not found");
        return user;
    }
}

export const userService = new UserService();