import { Request, Response } from "express";
import { ProductModel } from "../models/product.model";

/**
 * Controller quản lý danh mục sản phẩm AI Agent trên Marketplace.
 * Cung cấp các thao tác truy vấn, tìm kiếm đa tiêu chí, xem chi tiết và tạo mới sản phẩm Agent.
 */
export class ProductController {
    /**
     * Lấy danh sách sản phẩm AI Agent theo bộ lọc (category, modelTier, search từ khóa) và sắp xếp.
     */
    async getProducts(req: Request, res: Response) {
        try {
            const { category, search, modelTier, sort = "featured" } = req.query;
            const query: any = {};

            // Lọc theo phân loại nghiệp vụ (vd: business, coding, creative, general)
            if (category && category !== "all") {
                query.category = category;
            }

            // Lọc theo cấp độ mô hình AI (vd: fast, standard, premium)
            if (modelTier && modelTier !== "all") {
                query.modelTier = modelTier;
            }

            // Tìm kiếm đa trường không phân biệt hoa thường
            if (search) {
                query.$or = [
                    { name: { $regex: String(search), $options: "i" } },
                    { title: { $regex: String(search), $options: "i" } },
                    { description: { $regex: String(search), $options: "i" } },
                    { skills: { $in: [new RegExp(String(search), "i")] } },
                ];
            }

            // Tiêu chí sắp xếp danh sách sản phẩm
            let sortOptions: any = { isFeatured: -1, rating: -1 };
            if (sort === "price_asc") sortOptions = { "pricing.rentDailyRate": 1 };
            if (sort === "price_desc") sortOptions = { "pricing.rentDailyRate": -1 };
            if (sort === "popular") sortOptions = { totalRented: -1, totalBought: -1 };
            if (sort === "newest") sortOptions = { createdAt: -1 };

            const products = await ProductModel.find(query).sort(sortOptions);
            res.status(200).json({ success: true, count: products.length, data: products });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Xem thông tin chi tiết của một Agent theo Mongo ObjectId hoặc chuỗi agentId duy nhất.
     */
    async getProductById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const queryConditions: any[] = [{ agentId: id }];

            // Nếu id khớp định dạng 24 ký tự hex của MongoDB ObjectId, tìm kiếm thêm theo _id
            if (/^[0-9a-fA-F]{24}$/.test(id)) {
                queryConditions.push({ _id: id });
            }

            const product = await ProductModel.findOne({ $or: queryConditions });

            if (!product) {
                return res.status(404).json({ success: false, message: "Agent product not found" });
            }

            res.status(200).json({ success: true, data: product });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Đăng bán hoặc niêm yết một Agent mới lên Marketplace.
     */
    async createProduct(req: Request, res: Response) {
        try {
            const existing = await ProductModel.findOne({ agentId: req.body.agentId });
            if (existing) {
                return res.status(400).json({ success: false, message: "AgentId already exists in marketplace" });
            }

            const product = await ProductModel.create(req.body);
            res.status(201).json({ success: true, message: "Product created successfully", data: product });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}

export const productController = new ProductController();
