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

        // Update status to online
        await userRepository.update(user._id.toString(), { status: "online" });

        const secret = process.env.JWT_SECRET || "fallback_secret";
        const expiresIn = (process.env.JWT_EXPIRES_IN as any) || "7d";
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            secret,
            { expiresIn }
        );

        return {
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                status: "online",
                avatarUrl: user.avatarUrl,
                bio: user.bio,
                ownedAgentIds: user.ownedAgentIds,
            },
        };
    }

    async getAllUsers() {
        return await userRepository.findAll();
    }

    async getUserById(id: string) {
        const user = await userRepository.findById(id);
        if (!user) throw new Error("User not found");
        const userObj = (user as any).toObject ? (user as any).toObject() : user;
        delete userObj.passwordHash;
        return userObj;
    }

    async updateProfile(
        userId: string,
        data: { username?: string; avatarUrl?: string; bio?: string }
    ) {
        // Only allow safe fields
        const safeData: Record<string, any> = {};
        if (data.username) safeData.username = data.username;
        if ((data as any).name) safeData.username = (data as any).name;
        if (data.avatarUrl !== undefined) safeData.avatarUrl = data.avatarUrl;
        if (data.bio !== undefined) safeData.bio = data.bio;

        const updated = await userRepository.update(userId, safeData);
        if (!updated) throw new Error("User not found");
        const userObj = (updated as any).toObject ? (updated as any).toObject() : updated;
        delete userObj.passwordHash;
        return userObj;
    }

    async updateStatus(userId: string, status: "online" | "offline" | "busy") {
        const allowedStatuses = ["online", "offline", "busy"];
        if (!allowedStatuses.includes(status)) {
            throw new Error("Invalid status value");
        }
        const updated = await userRepository.update(userId, { status });
        if (!updated) throw new Error("User not found");
        return { id: userId, status };
    }

    async getOwnedAgents(userId: string) {
        const user = await userRepository.findById(userId);
        if (!user) throw new Error("User not found");
        return { ownedAgentIds: user.ownedAgentIds || [] };
    }

    async addOwnedAgent(userId: string, agentId: string) {
        const user = await userRepository.findById(userId);
        if (!user) throw new Error("User not found");

        const currentIds: string[] = user.ownedAgentIds || [];
        if (currentIds.includes(agentId)) {
            return { ownedAgentIds: currentIds };
        }

        const updated = await userRepository.update(userId, {
            ownedAgentIds: [...currentIds, agentId],
        });
        const userObj = (updated as any).toObject ? (updated as any).toObject() : updated;
        delete userObj?.passwordHash;
        return userObj;
    }

    async removeOwnedAgent(userId: string, agentId: string) {
        const user = await userRepository.findById(userId);
        if (!user) throw new Error("User not found");

        const filtered = (user.ownedAgentIds || []).filter((id: string) => id !== agentId);
        const updated = await userRepository.update(userId, { ownedAgentIds: filtered });
        const userObj = (updated as any).toObject ? (updated as any).toObject() : updated;
        delete userObj?.passwordHash;
        return userObj;
    }
}

export const userService = new UserService();