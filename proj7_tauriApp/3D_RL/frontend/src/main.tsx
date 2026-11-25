/**
 * ==============================================================================
 * ĐIỂM KHỞI CHẠY REACT (REACT VIRTUAL DOM ENTRYPOINT)
 * ==============================================================================
 * Khởi tạo ứng dụng React 18 / 19 với StrictMode:
 * - Nạp tệp cấu hình kiểu dáng toàn cục Tailwind CSS (index.css).
 * - Render component gốc <App /> vào thẻ HTML #root trong index.html.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
