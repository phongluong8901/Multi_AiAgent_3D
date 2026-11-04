import express from "express";
import cors from "cors";
import ownerRoutes from "./routes/owner.routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
}));

app.use(express.json());

// Routes
app.use("/api/v1/owner", ownerRoutes);
app.use("/api/v1/ower", ownerRoutes); // alias for backwards compatibility

// Health check
app.get("/", (req, res) => {
    res.status(200).json({ message: "Owner Service is running smoothly!" });
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "ower-service" });
});

app.use(errorHandler);

export default app;
