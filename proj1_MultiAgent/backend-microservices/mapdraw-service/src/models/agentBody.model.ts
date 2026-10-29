import mongoose, { Schema, Document } from "mongoose";

/**
 * Agent Body Design - mô tả cấu trúc động học (kinematic tree) của một robot / agent.
 * Thiết kế tương thích URDF: mỗi Link là một khối cứng, mỗi Joint nối 1 link cha với 1 link con.
 * Các joint có `actuated = true` sẽ trở thành không gian hành động (action space) khi train RL.
 */

export type LinkShape = "box" | "sphere" | "cylinder" | "capsule" | "cone" | "torus" | "gear" | "wedge" | "spring" | "extrusion";
export type JointType = "revolute" | "continuous" | "prismatic" | "fixed";

export interface IAgentLink {
    id: string;
    name: string;
    shape: LinkShape;
    /** box: [x, y, z]; sphere: [r, -, -]; cylinder/capsule: [r, length, -] (trục Y) */
    size: [number, number, number];
    color: string;
    mass: number;
    /** Offset của hình khối so với gốc toạ độ link (frame của joint cha) */
    visualOffset: [number, number, number];
    /** Xoay của hình khối (roll, pitch, yaw - radian) */
    visualRotation: [number, number, number];
    /** Có phải là cảm biến tiếp xúc (chân, bánh xe) để tính reward */
    isContactSensor?: boolean;
    shapeParams?: Record<string, any>;
}

export interface IJointLimit {
    lower: number;
    upper: number;
    effort: number;
    velocity: number;
}

export interface IAgentJoint {
    id: string;
    name: string;
    type: JointType;
    parentLinkId: string;
    childLinkId: string;
    /** Vị trí gốc joint trong frame của link cha */
    origin: [number, number, number];
    /** Xoay gốc joint (roll, pitch, yaw - radian) */
    originRotation: [number, number, number];
    /** Trục quay / trượt (đơn vị) */
    axis: [number, number, number];
    limit: IJointLimit;
    damping: number;
    friction: number;
    /** Joint có motor điều khiển hay không (đưa vào action space) */
    actuated: boolean;
    /** Vị trí mặc định / tư thế nghỉ */
    defaultPosition: number;
}

export interface IAgentBodyDesign extends Document {
    bodyId: string;
    name: string;
    description?: string;
    category: string;
    rootLinkId: string;
    /** Chiều cao spawn của base so với mặt đất (m) */
    spawnHeight: number;
    links: IAgentLink[];
    joints: IAgentJoint[];
    userId?: string;
    userName?: string;
    isPublic: boolean;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

const Vec3 = { type: [Number], default: (): [number, number, number] => [0, 0, 0] };

const AgentLinkSchema = new Schema<IAgentLink>(
    {
        id: { type: String, required: true },
        name: { type: String, required: true },
        shape: {
            type: String,
            enum: ["box", "sphere", "cylinder", "capsule", "cone", "torus", "gear", "wedge", "spring", "extrusion"],
            default: "box"
        },
        shapeParams: { type: Schema.Types.Mixed, default: () => ({}) },
        size: { type: [Number], default: (): [number, number, number] => [0.2, 0.2, 0.2] },
        color: { type: String, default: "#94a3b8" },
        mass: { type: Number, default: 1 },
        visualOffset: Vec3,
        visualRotation: Vec3,
        isContactSensor: { type: Boolean, default: false },
    },
    { _id: false }
);

const AgentJointSchema = new Schema<IAgentJoint>(
    {
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ["revolute", "continuous", "prismatic", "fixed"], default: "revolute" },
        parentLinkId: { type: String, required: true },
        childLinkId: { type: String, required: true },
        origin: Vec3,
        originRotation: Vec3,
        axis: { type: [Number], default: (): [number, number, number] => [0, 0, 1] },
        limit: {
            lower: { type: Number, default: -1.57 },
            upper: { type: Number, default: 1.57 },
            effort: { type: Number, default: 20 },
            velocity: { type: Number, default: 5 },
        },
        damping: { type: Number, default: 0.1 },
        friction: { type: Number, default: 0 },
        actuated: { type: Boolean, default: true },
        defaultPosition: { type: Number, default: 0 },
    },
    { _id: false }
);

const AgentBodyDesignSchema = new Schema<IAgentBodyDesign>(
    {
        bodyId: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        description: { type: String, default: "" },
        category: { type: String, default: "custom" },
        rootLinkId: { type: String, required: true },
        spawnHeight: { type: Number, default: 0.5 },
        links: { type: [AgentLinkSchema], default: [] },
        joints: { type: [AgentJointSchema], default: [] },
        userId: { type: String, default: "anonymous", index: true },
        userName: { type: String, default: "User" },
        isPublic: { type: Boolean, default: true },
        tags: { type: [String], default: ["AgentBody"] },
    },
    { timestamps: true }
);

export const AgentBodyDesignModel = mongoose.model<IAgentBodyDesign>("AgentBodyDesign", AgentBodyDesignSchema);
