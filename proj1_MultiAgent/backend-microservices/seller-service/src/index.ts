import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import app from "./app";
import { connectDB } from "./config/db";
import { logger } from "./config/logger";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    logger.info("Loaded env from local .env file");
} else {
    dotenv.config();
}

const PORT = process.env.PORT || 5011;

connectDB().then(() => {
    app.listen(PORT, () => {
        logger.info(`Server is running on http://localhost:${PORT}`);
    });
}).catch((error) => {
    logger.error("Failed to start server due to connection error:", error);
    process.exit(1);
});
