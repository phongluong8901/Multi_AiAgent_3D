# --- phan loai ML va AI hien tai

1. Scikit-learn (ML truyền thống)
Bản chất: Các thuật toán toán học/thống kê chạy trên CPU (Random Forest, Logistic Regression, XGBoost/LightGBM...). Không dùng mạng nơ-ron sâu.

Bản chất: Các thuật toán toán học/thống kê chạy trên CPU (Random Forest, Logistic Regression, XGBoost/LightGBM...). Không dùng mạng nơ-ron sâu.

Khi nào dùng:

Bài toán dùng dữ liệu dạng bảng (Tabular) có cấu trúc rõ ràng (các cột số, danh mục như file Excel/SQL).

Dữ liệu nhỏ hoặc vừa (từ vài nghìn đến vài triệu dòng, máy tính cá nhân hoặc server nhỏ chịu được).

Cần tốc độ huấn luyện siêu nhanh, kết quả dễ giải thích (explainability) để báo cáo sếp/đối tác.

Ứng dụng tiêu biểu:

Dự đoán khách hàng rời bỏ dịch vụ (Churn prediction).

Chấm điểm tín dụng (Credit scoring) ngân hàng.

Dự báo giá nhà, dự đoán số lượng hàng tồn kho dựa trên lịch sử bán hàng.

Hệ thống gợi ý sản phẩm đơn giản (Collaborative filtering cơ bản).

2. Model tự train từ đầu (Custom Trained Models)
Bản chất: Bạn tự thu thập dữ liệu (hoặc dùng dataset mở), tự định kiến trúc mạng nơ-ron (dùng PyTorch/TensorFlow) và huấn luyện từ chân không (scratch) hoặc fine-tune sâu theo ý đồ riêng.

2. Model tự train từ đầu (Custom Trained Models)
Bản chất: Bạn tự thu thập dữ liệu (hoặc dùng dataset mở), tự định kiến trúc mạng nơ-ron (dùng PyTorch/TensorFlow) và huấn luyện từ chân không (scratch) hoặc fine-tune sâu theo ý đồ riêng.

Khi nào dùng:

Bài toán mang tính đặc thù rất cao mà các mô hình có sẵn trên mạng không hiểu được (Ví dụ: Nhận diện lỗi bề mặt linh kiện điện tử sản xuất riêng tại nhà máy của bạn, xử lý âm thanh tiếng địa phương/tiếng lóng đặc thù).

Cần kiểm soát hoàn toàn mô hình, không muốn phụ thuộc bên thứ ba (yếu tố bảo mật, dữ liệu độc quyền).

Thiết bị chạy mô hình bị giới hạn tài nguyên nghiêm ngặt (cần train các mô hình siêu nhỏ để nhúng vào vi điều khiển IoT, camera giao thông, thiết bị y tế cầm tay).

Ứng dụng tiêu biểu:

Hệ thống kiểm tra lỗi sản phẩm trên băng chuyền nhà máy (Computer Vision chuyên biệt).

Xe tự lái nhận diện biển báo giao thông và chướng ngại vật cục bộ.

Mô hình dự báo giá cước vận tải riêng của một hãng logistics lớn.

3. Model trên Hugging Face (Open-source Pre-trained Models)
Bản chất: Kho lưu trữ mã nguồn mở lớn nhất thế giới cho AI. Nơi các kỹ sư/nhà nghiên cứu chia sẻ các mô hình đã được train sẵn (Computer Vision, NLP, Audio, Nhỏ gọn hoặc vừa phải). Bạn chỉ cần tải về, dùng nguyên bản (Zero-shot) hoặc tinh chỉnh nhẹ (Fine-tune) trên dữ liệu của mình.

Khi nào dùng:

Muốn làm sản phẩm nhanh, đứng trên vai người khổng lồ thay vì tự xây lại từ đầu.

Có một lượng dữ liệu vừa phải để Fine-tune (tinh chỉnh) cho phù hợp với nghiệp vụ riêng.

Cần chạy mô hình on-premise (trên máy chủ công ty) để đảm bảo bảo mật dữ liệu tuyệt đối, không muốn gửi data qua API của bên khác.

Ứng dụng tiêu biểu:

Dùng các mô hình ViT (Vision Transformer) hoặc YOLO trên Hugging Face để làm bài toán nhận diện hình ảnh, OCR quét hóa đơn tiếng Việt.

Tinh chỉnh một mô hình ngôn ngữ nhỏ (như Llama, Mistral bản 7B/8B) để làm trợ lý ảo nội bộ cho công ty chạy trên server riêng.

Làm hệ thống phân loại cảm xúc văn bản tiếng Việt, trích xuất thông tin từ hợp đồng (NER).

4. LLM của các ông lớn (Closed-source / Managed APIs như GPT-4o, Claude 3.5 Sonnet, Gemini Pro)
Bản chất: Các siêu mô hình ngôn ngữ (và Multimodal) đa năng do OpenAI, Anthropic, Google... phát triển và vận hành trên hệ thống siêu máy tính của họ. Bạn sử dụng thông qua API trả phí theo token.

Khi nào dùng:

Cần giải quyết các bài toán đòi hỏi sự thông minh nhân tạo tổng quát cao cấp (suy luận logic, viết code phức tạp, sáng tạo nội dung, hiểu ngữ cảnh sâu).

Ứng dụng cần xử lý đa phương thức (vừa đọc text, vừa nhìn ảnh/video, nghe âm thanh cùng lúc).

Không muốn đầu tư hạ tầng GPU đắt đỏ và không muốn tốn nhân lực vận hành hệ thống ML phức tạp.

Ứng dụng tiêu biểu:

Xây dựng Chatbot tổng đài thông minh, tư vấn viên ảo hiểu tiếng người mượt mà.

Hệ thống RAG (Retrieval-Augmented Generation) tra cứu tài liệu nội bộ kết hợp trí tuệ nhân tạo tổng hợp.

Công cụ hỗ trợ lập trình viên tự động viết và kiểm tra code.

Tự động hóa quy trình phân tích tài liệu pháp lý, tóm tắt hàng trăm trang hồ sơ thầu.

5. 
Có bảng số liệu, cấu trúc rõ ràng, cần nhanh gọn $\rightarrow$ Scikit-learn.

Bài toán cực kỳ đặc thù, dữ liệu độc quyền, tối ưu phần cứng biên $\rightarrow$ Model tự train.

Muốn làm sản phẩm AI chuyên biệt (Vision/NLP) nhanh, tiết kiệm, chạy server riêng $\rightarrow$ Hugging Face.

Cần bộ não thông minh toàn diện, làm sản phẩm cốt lõi dùng chung cho toàn app/doanh nghiệp, chấp nhận dùng API ngoài $\rightarrow$ LLM của các ông lớn.