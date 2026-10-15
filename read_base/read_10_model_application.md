# --- model application for edge/mobile or web
Dưới đây là bảng phân tích chi tiết, toàn diện về dung lượng (size), trọng số (weight), độ phù hợp, độ chính xác, việc cần làm, và phân loại model (từ pre-trained sẵn trên Hugging Face, fine-tune, đến tự train từ đầu) cho 4 bài toán lớn: Chatbot, Data Analysis, Real-time Data, và Computer Vision, được bóc tách rõ ràng cho hai môi trường Web và Edge/Mobile.

1. BÀI TOÁN: CHATBOT (LLM / Conversational AI)
Phân loại Model & Tính phù hợp:
Pre-trained Model (Hugging Face / API): Phù hợp khi làm nhanh, dùng các model cỡ lớn qua API hoặc chạy local (như Llama 3/4, Qwen 2.5, Mistral). Không cần train, chỉ cần dựng Prompt Engineering.

Fine-tuned Model: Phù hợp khi chatbot cần chuyên môn sâu (nghiệp vụ doanh nghiệp, y tế, luật) bằng cách train thêm trên tập dữ liệu Q&A nội bộ.

From-scratch (Tự train): Không khả thi và lãng phí cho đa số doanh nghiệp trừ các tập đoàn lớn muốn làm foundational model riêng.

Phân tích chi tiết theo Môi trường:

Môi trường Web (Cloud / Server Deployment):
Dung lượng & Trọng số: Model lớn từ 7B đến 70B+ parameters. Dung lượng file weights từ 14 GB đến hơn 140 GB (ở định dạng chuẩn FP16/BF16) hoặc được nén xuống 4-bit/8-bit qua vLLM.
Độ chính xác: Cực kỳ cao, khả năng suy luận ngữ cảnh tốt, thông hiểu đa ngôn ngữ sâu sắc.
Việc cần làm: Không cần thu thập data train từ đầu $\rightarrow$ Thu thập dữ liệu làm RAG (tài liệu doanh nghiệp) $\rightarrow$ Đẩy lên Vector DB (ChromaDB/Qdrant) $\rightarrow$ Thiết lập vLLM/LiteLLM Server trên cụm GPU Cloud $\rightarrow$ Tích hợp LangGraph/LangChain.

Môi trường Edge / Mobile (On-Device Local):
Dung lượng & Trọng số: Model siêu nhỏ (Small Language Models - SLMs) từ 0.5B đến 3B parameters (ví dụ: Qwen-0.5B/1.5B, Llama-3-8B-Instruct lượng tử hóa sâu, Phi-3-mini). Dung lượng file weights sau khi nén GGUF chỉ từ 400 MB đến 2 GB.
Độ chính xác: Khá tốt ở các tác vụ cơ bản, tóm tắt văn bản, hỏi đáp đơn giản; hạn chế khi xử lý logic toán học phức tạp hoặc suy luận dài.
Việc cần làm: Lựa chọn SLM sẵn có trên Hugging Face $\rightarrow$ Chuyển đổi định dạng sang GGUF (qua Llama.cpp) $\rightarrow$ Nhúng trực tiếp vào App Mobile $\rightarrow$ Kết hợp FAISS để làm RAG offline ngay trên điện thoại.

2. BÀI TOÁN: DATA ANALYSIS (Phân tích dữ liệu & Báo cáo)
(Bao gồm cả phân tích số liệu truyền thống và phân tích văn bản/NLP hiện đại).

Phân loại Model & Tính phù hợp:
Pre-trained Model / API: Các LLM tổng quát (GPT-4o, Claude 3.5 Sonnet) có khả năng sinh code Python/Pandas xuất sắc nhất hiện nay.

Fine-tuned Model (cho NLP/Text Analytics): Các model encoder nhỏ như PhoBERT (cho tiếng Việt) hoặc RoBERTa được fine-tune riêng cho bài toán phân tích cảm xúc (Sentiment Analysis) hoặc phân loại văn bản.

Traditional ML / Statistical Models: Không dùng Deep Learning mà dùng Scikit-learn (K-Means, Linear Regression, Random Forest) cho số liệu dạng bảng (Tabular data).

Phân tích chi tiết theo Môi trường:

Môi trường Web (Cloud / Backend Analytics):
Dung lượng & Trọng số: Đối với NLP: Model PhoBERT base nặng khoảng 500 MB (trọng số FP32/FP16). Đối với LLM sinh code phân tích: Sử dụng API bên thứ ba hoặc host model lớn trên Cloud Server.
Độ chính xác: Rất cao trong việc trích xuất ý nghĩa văn bản (độ chính xác cảm xúc > 90%) và sinh code phân tích chính xác tuyệt đối khi kết hợp với Sandbox.
Việc cần làm: Xây dựng đường ống ETL dữ liệu $\rightarrow$ Thu thập và gán nhãn dữ liệu văn bản (nếu làm NLP) $\rightarrow$ Fine-tune model PhoBERT trên GPU Cloud hoặc cấu hình API LLM $\rightarrow$ Tích hợp AI Code Sandbox (E2B) để chạy code an toàn $\rightarrow$ Dựng Dashboard trực quan (Next.js / Streamlit).

Môi trường Edge / Mobile (On-Device Analytics):
Dung lượng & Trọng số: Rất ít khi chạy mô hình phân tích văn bản/data nặng trực tiếp trên mobile trừ các mô hình thống kê truyền thống bằng Scikit-learn (dung lượng chỉ vài MB).
Độ chính xác: Thấp nếu cố nhúng NLP nặng; phù hợp cho các thống kê toán học đơn giản trên máy khách.
Việc cần làm: Viết code xử lý dữ liệu bằng Pandas phiên bản mobile / SQLite $\rightarrow$ Đồng bộ dữ liệu định kỳ lên Cloud Server để xử lý các thuật toán nặng thay vì bắt thiết bị biên gánh.

3. BÀI TOÁN: REAL-TIME DATA (Xử lý dữ liệu thời gian thực & IoT)

Phân loại Model & Tính phù hợp:
Rule-based & Time-Series Statistical Models: Phần lớn bài toán Real-time dữ liệu (như biến động giá, cảm biến IoT, dòng sự kiện chat) không dùng LLM cồng kềnh mà dùng các thuật toán chuỗi thời gian (ARIMA, Exponential Smoothing) hoặc bộ lọc Kalman.

Lightweight ML Streaming Models: Các mô hình học máy dạng cây nhẹ (LightGBM, XGBoost) chạy liên tục trên stream dữ liệu.

Phân tích chi tiết theo Môi trường:

Môi trường Web (Streaming Backend):
Dung lượng & Trọng số: Không nặng về model AI mà nặng về hạ tầng mạng. Trọng số mô hình dự báo chuỗi thời gian thường chỉ từ vài MB đến vài chục MB.
Độ chính xác: Độ trễ thấp (latency < 50ms), khả năng phản hồi sự kiện tức thì.
Việc cần làm: Thiết lập hệ thống WebSocket / WebRTC $\rightarrow$ Cấu hình Message Broker (RabbitMQ / Apache Kafka) $\rightarrow$ Dựng In-memory Cache với Redis để lưu trạng thái thời gian thực $\rightarrow$ Viết worker xử lý sự kiện ngầm bằng Go hoặc Python Async.

Môi trường Edge / Mobile (IoT & Edge Real-time):
Dung lượng & Trọng số: Rất nhỏ gọn, tối ưu cho vi điều khiển hoặc thiết bị nhúng (dung lượng dưới 10 MB).
Độ chính xác: Đòi hỏi tính chính xác tuyệt đối về thời gian thực (real-time constraints) để tránh sự cố phần cứng.
Việc cần làm: Lập trình nhúng (C++/Python tối ưu) $\rightarrow$ Thu thập dữ liệu cảm biến cục bộ qua giao thức MQTT $\rightarrow$ Cấu hình bộ đệm vòng (Ring Buffer) $\rightarrow$ Xử lý ngắt phần cứng thời gian thực tại biên.

4. BÀI TOÁN: COMPUTER VISION (Thị giác máy tính)
Phân loại Model & Tính phù hợp:
Pre-trained / Fine-tuned Models (YOLO, ResNet, MobileNet): Hầu như mọi dự án CV hiện đại đều lấy các mô hình base đã pre-trained trên tập dữ liệu khổng lồ (như COCO dataset) rồi tiến hành Fine-tune trên tập ảnh riêng của doanh nghiệp.

Phân tích chi tiết theo Môi trường:

Môi trường Web (Cloud / Browser Serving):
Dung lượng & Trọng số: Model YOLOv8/v11 medium hoặc ResNet-50 có dung lượng từ 50 MB đến 200 MB (trọng số FP32/FP16).
Độ chính xác: Rất cao, nhận diện chi tiết vật thể ở độ phân giải lớn (Full HD / 4K).
Việc cần làm: Thu thập và gán nhãn ảnh (qua Roboflow / CVAT) $\rightarrow$ Fine-tune mô hình YOLO trên GPU Cloud $\rightarrow$ Xuất sang ONNX hoặc TensorFlow.js $\rightarrow$ Nhúng vào Frontend Web kết hợp HTML5 Canvas để vẽ Bounding Box thời gian thực.

Môi trường Edge / Mobile (On-Device & Edge Hardware):
Dung lượng & Trọng số: Bắt buộc dùng các kiến trúc siêu nhẹ (YOLOv8-Nano, MobileNetV4) và thực hiện Quantization (INT8). Dung lượng file weights sau khi nén chỉ từ 5 MB đến 25 MB.
Độ chính xác: Đủ tốt cho các tác vụ nhận diện cơ bản (khuôn mặt, mã vạch, vật cản chính) với tốc độ khung hình cao (30-60 FPS).
Việc cần làm: Thu thập ảnh thực tế trên thiết bị $\rightarrow$ Fine-tune mô hình Nano $\rightarrow$ Chuyển đổi sang định dạng TFLite hoặc CoreML $\rightarrow$ Cấu hình phần cứng tăng tốc (Delegates cho NPU/GPU di động) $\rightarrow$ Tích hợp vào App Mobile (Flutter/Native).


