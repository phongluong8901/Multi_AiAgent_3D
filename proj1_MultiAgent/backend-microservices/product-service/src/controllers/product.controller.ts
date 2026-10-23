import { Request, Response } from "express";
import { ProductModel } from "../models/product.model";

export class ProductController {
    async getProducts(req: Request, res: Response) {
        try {
            const { category, search, modelTier, sort = "featured" } = req.query;
            const query: any = {};

            if (category && category !== "all") {
                query.category = category;
            }

            if (modelTier && modelTier !== "all") {
                query.modelTier = modelTier;
            }

            if (search) {
                query.$or = [
                    { name: { $regex: String(search), $options: "i" } },
                    { title: { $regex: String(search), $options: "i" } },
                    { description: { $regex: String(search), $options: "i" } },
                    { skills: { $in: [new RegExp(String(search), "i")] } },
                ];
            }

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

    async getProductById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const product = await ProductModel.findOne({
                $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { agentId: id }]
            });

            if (!product) {
                return res.status(404).json({ success: false, message: "Agent product not found" });
            }

            res.status(200).json({ success: true, data: product });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

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
