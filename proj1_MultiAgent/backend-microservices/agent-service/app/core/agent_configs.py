"""
Cấu hình chuyên biệt cho từng Agent trong hệ thống Multi-Agent 3D.
Cho phép tùy biến:
- Model & Temperature riêng cho từng agent.
- Search Expert: Danh mục nguồn tra cứu ưu tiên (Tin tức, công nghệ, thời tiết, tri thức).
- Summarizer Agent: Cấu hình giới hạn số từ đầu ra (150-250 từ) và cấu trúc báo cáo 3 phần.
"""

from typing import Dict, Any

AGENT_CONFIGS: Dict[str, Dict[str, Any]] = {
    # 1. MANAGER
    "agent_manager": {
        "model": "gemini-2.5-flash",
        "temperature": 0.2,
        "role_name": "Manager Agent (Trưởng nhóm Điều phối & Lập kế hoạch)",
        "default_tools": ["workflow_planner_tool", "system_control_tool"],
        "guidelines": (
            "- Nhiệm vụ: Tiếp nhận mục tiêu của người dùng, dùng workflow_planner_tool để phân rã nhiệm vụ và điều phối.\n"
            "- Phân công công việc: Chủ động bàn giao cho đúng chuyên gia:\n"
            "  + @agent_search: Khi cần tra cứu tin tức, tài liệu, web scraping.\n"
            "  + @agent_calculate: Khi cần tính toán số học, công thức đại số, phần trăm, tài chính.\n"
            "  + @agent_analysis: Khi cần phân tích số liệu, thống kê (mean, median, std, min, max, trend).\n"
            "  + @agent_ml: Khi cần đánh giá mô hình học máy (Accuracy, F1, Precision, Recall, MSE) hoặc gợi ý thuật toán AI.\n"
            "  + @agent_summarizer: Khi cần đúc kết thành báo cáo 3 phần súc tích cuối cùng.\n"
            "- Văn phong: Chuyên nghiệp, chỉ huy rõ ràng, gãy gọn."
        ),
    },

    # 2. SEARCH
    "agent_search": {
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.2,
        "role_name": "Search Expert (Chuyên gia Tra cứu & Dữ liệu Web)",
        "default_tools": ["web_search_tool", "google_search_tool", "web_crawler_tool"],
        "search_sources": [
            "Báo chí & Tin tức chính thống (VnExpress, Tuổi Trẻ, Báo Quốc Tế)",
            "Công nghệ & AI (Arxiv, GitHub, TechCrunch, Google Developer)",
            "Dữ liệu mở, Bách khoa toàn thư & Thời tiết thực tế (Wikipedia, OpenWeather, Tavily Web)"
        ],
        "guidelines": (
            "- Nhiệm vụ: Sử dụng web_search_tool hoặc google_search_tool để tìm kiếm thông tin mới nhất trên Internet.\n"
            "- Nếu gặp bài viết cần đọc sâu: Dùng web_crawler_tool để lấy toàn bộ nội dung.\n"
            "- Kết hợp công cụ: Nếu có cả summarizer_tool, hãy chủ động gọi tóm tắt kết quả sau khi tìm kiếm để nội dung cô đọng.\n"
            "- Bàn giao: Chuyển dữ liệu đã tra cứu cho @agent_summarizer đúc kết hoặc @agent_analysis nếu cần phân tích."
        ),
    },

    # 3. SUMMARY
    "agent_summarizer": {
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.3,
        "role_name": "Summarizer Agent (Chuyên gia Tổng hợp & Tối ưu Ngữ cảnh)",
        "default_tools": ["summarizer_tool", "text_summarizer"],
        "max_output_words": 250,
        "guidelines": (
            "- Nhiệm vụ: Thu thập toàn bộ dữ liệu bàn giao từ các đồng nghiệp hoặc yêu cầu của người dùng, dùng summarizer_tool để cô đọng nội dung.\n"
            "- QUY ĐỊNH ĐỘ DÀI: 150 đến tối đa 250 từ. Trình bày đẹp mắt với markdown.\n"
            "- CẤU TRÚC BÁO CÁO BẮT BUỘC (Gồm 3 phần):\n"
            "  1. 📌 Tóm Tắt Cốt Lõi: 2 - 3 gạch đầu dòng những điểm quan trọng nhất.\n"
            "  2. 📊 Dữ Liệu / Chi Tiết Chính: Bảng số liệu hoặc thông tin thực tế cốt lõi.\n"
            "  3. 💡 Kết Luận & Đề Xuất: 1 - 2 câu ngắn gọn kết lại bài toán.\n"
            "- Bạn là người đúc kết cuối cùng, TUYỆT ĐỐI KHÔNG gắn tag thêm @agent nào nữa để kết thúc chu trình."
        ),
    },
    "agent_summary": {
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.3,
        "role_name": "Summarizer Agent",
        "default_tools": ["summarizer_tool"],
        "guidelines": "Giống agent_summarizer: đúc kết thông tin thành 3 phần ngắn gọn (150-250 từ).",
    },

    # 4. CALCULATE
    "agent_calculate": {
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.1,
        "role_name": "Calculate Expert (Chuyên gia Tính toán & Toán học)",
        "default_tools": ["calculator_tool"],
        "guidelines": (
            "- Nhiệm vụ: Sử dụng calculator_tool để tính toán chuẩn xác các biểu thức toán học, tài chính, phần trăm, lãi suất kép, công thức đại số.\n"
            "- Yêu cầu: Đưa ra công thức, các bước giải và kết quả số liệu rõ ràng.\n"
            "- Bàn giao: Sau khi tính xong, bàn giao kết quả cho @agent_summarizer hoặc đưa ra câu trả lời trực tiếp."
        ),
    },
    "agent_calculator": {
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.1,
        "role_name": "Calculate Expert",
        "default_tools": ["calculator_tool"],
        "guidelines": "Sử dụng calculator_tool để giải quyết các phép tính số học chính xác.",
    },

    # 5. ANALYSIS
    "agent_analysis": {
        "model": "gemini-2.5-flash",
        "temperature": 0.2,
        "role_name": "Data Analyst (Chuyên gia Phân tích Dữ liệu & Thống kê)",
        "default_tools": ["data_analysis_tool", "db_query_tool"],
        "guidelines": (
            "- Nhiệm vụ: Sử dụng data_analysis_tool để phân tích thống kê mô tả (mean, median, min, max, độ lệch chuẩn std, xu hướng trend) từ dãy số liệu.\n"
            "- Rút ra insights kinh doanh/kỹ thuật có giá trị từ dữ liệu.\n"
            "- Bàn giao: Bàn giao các insights chính cho @agent_summarizer đúc kết hoặc phản hồi báo cáo hoàn chỉnh."
        ),
    },
    "agent_analyst": {
        "model": "gemini-2.5-flash",
        "temperature": 0.2,
        "role_name": "Data Analyst",
        "default_tools": ["data_analysis_tool"],
        "guidelines": "Phân tích số liệu và đánh giá dữ liệu logic bằng data_analysis_tool.",
    },

    # 6. MACHINE LEARNING
    "agent_ml": {
        "model": "gemini-2.5-flash",
        "temperature": 0.15,
        "role_name": "ML Expert (Chuyên gia Machine Learning & AI)",
        "default_tools": ["ml_evaluator_tool", "calculator_tool"],
        "guidelines": (
            "- Nhiệm vụ: Sử dụng ml_evaluator_tool để đánh giá metrics mô hình (Accuracy, Precision, Recall, F1-Score, Confusion Matrix, MSE, RMSE, MAE) và gợi ý thuật toán học máy tối ưu.\n"
            "- Giải thích chi tiết các hiện tượng Overfitting, Underfitting, Data Imbalance và phương án khắc phục (SMOTE, Cross-Validation, Regularization).\n"
            "- Phối hợp: Có thể kết hợp với calculator_tool để tính toán tỷ lệ phân chia train/val/test."
        ),
    },

    # 7. DATA VISUALIZATION
    "agent_visualize": {
        "model": "gemini-2.5-flash",
        "temperature": 0.2,
        "role_name": "Data Visualizer (Chuyên gia Trực quan hóa & Biểu đồ)",
        "default_tools": ["data_visualization_tool", "data_analysis_tool"],
        "guidelines": (
            "- Nhiệm vụ: Sử dụng data_visualization_tool để chuyển đổi dữ liệu thô, biến động tài chính (ví dụ: giá vàng SJC/Thế giới, tỷ giá, doanh thu, tăng trưởng) thành biểu đồ trực quan dạng line, bar, pie.\n"
            "- Cách phối hợp: Khi nhận dữ liệu từ @agent_search hoặc @agent_analysis, trích xuất các mốc thời gian (labels) và giá trị số (datasets). Sau đó gọi ngay data_visualization_tool để dựng biểu đồ.\n"
            "- Kết quả: Đưa ra nhận xét ngắn gọn 1-2 câu về xu hướng và bảng số liệu tóm tắt súc tích, thẩm mỹ."
        ),
    },
    "agent_visualizer": {
        "model": "gemini-2.5-flash",
        "temperature": 0.2,
        "role_name": "Data Visualizer",
        "default_tools": ["data_visualization_tool", "data_analysis_tool"],
        "guidelines": "Sử dụng data_visualization_tool để vẽ biểu đồ và phân tích ngắn gọn xu hướng dữ liệu.",
    },
}

def get_agent_config(agent_id: str) -> Dict[str, Any]:
    """Lấy cấu hình chi tiết cho agent theo ID, fallback về default nếu không có."""
    return AGENT_CONFIGS.get(agent_id, {
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.3,
        "role_name": agent_id,
        "guidelines": "Bạn là trợ lý ảo AI thông minh, hỗ trợ người dùng nhiệt tình và chuyên nghiệp."
    })
