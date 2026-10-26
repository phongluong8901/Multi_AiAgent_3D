import mongoose, { Schema, Document } from "mongoose";

export interface IMapObjectItem {
    id: string;
    type: string;
    name: string;
    position: [number, number, number];
    rotation: number;
    width?: number;
    height?: number;
    depth?: number;
    color?: string;
}

export interface IMapDesign extends Document {
    mapId: string;
    name: string;
    description?: string;
    skyPreset: string;
    groundColor: string;
    groundSize: [number, number];
    items: IMapObjectItem[];
    userId?: string;
    userName?: string;
    isPublic: boolean;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

const MapObjectItemSchema = new Schema<IMapObjectItem>(
    {
        id: { type: String, required: true },
        type: { type: String, required: true },
        name: { type: String, required: true },
        position: { type: [Number], required: true },
        rotation: { type: Number, default: 0 },
        width: { type: Number },
        height: { type: Number },
        depth: { type: Number },
        color: { type: String },
    },
    { _id: false }
);

const MapDesignSchema = new Schema<IMapDesign>(
    {
        mapId: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        description: { type: String, default: "" },
        skyPreset: { type: String, default: "city" },
        groundColor: { type: String, default: "#18181b" },
        groundSize: { type: [Number], default: [60, 60] },
        items: { type: [MapObjectItemSchema], default: [] },
        userId: { type: String, default: "anonymous", index: true },
        userName: { type: String, default: "User" },
        isPublic: { type: Boolean, default: true },
        tags: { type: [String], default: ["3D", "SmartCity"] },
    },
    {
        timestamps: true,
    }
);

export const MapDesignModel = mongoose.model<IMapDesign>("MapDesign", MapDesignSchema);
