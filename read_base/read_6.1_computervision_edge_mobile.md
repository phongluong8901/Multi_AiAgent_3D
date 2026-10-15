# --- Bai toan computervision_edge_mobile
Đối với bài toán Computer Vision kết hợp Edge / Mobile (ví dụ: Nhận diện khuôn mặt, quét mã vạch trên app điện thoại; camera an ninh thông minh tự phát hiện kẻ gian; drone tự tránh vật cản; hoặc hệ thống kiểm tra lỗi sản phẩm trên băng chuyền nhà máy), đây là đỉnh cao của độ khó vì thị giác máy tính đòi hỏi lượng tính toán hình ảnh khổng lồ, nhưng thiết bị biên (Edge/IoT) và điện thoại lại có tài nguyên cực kỳ hạn chế (pin yếu, RAM ít, chip di động/NPU nhỏ).

1. Model tự train / Fine-tune siêu nhỏ + ONNX / TFLite / TensorRT (Giải pháp cốt lõi - Bắt buộc)

Mức độ phù hợp: Tuyệt đối (Số 1).

Khi nào dùng:

Hầu như mọi bài toán CV trên thiết bị biên đều phải đi qua con đường này. Bạn train hoặc fine-tune các kiến trúc mạng chuyên dụng siêu nhẹ (như YOLOv8/v11 bản Nano/Small, MobileNet, EfficientNet, FastViT) bằng PyTorch, sau đó bắt buộc phải tối ưu hóa:

Nén mô hình bằng Quantization (ép từ FP32 xuống INT8 để giảm 75% dung lượng và tăng tốc).

Chuyển đổi sang các định dạng biên: TFLite (cho Android), Apple CoreML (cho iOS), ONNX Runtime Mobile (cho đa nền tảng), hoặc NVIDIA TensorRT (cho thiết bị biên mạnh như NVIDIA Jetson).

Ứng dụng thực tế:

App mobile chỉnh sửa ảnh / AR Filters (Hiệu ứng mặt nạ trên TikTok/Instagram): Chạy phân đoạn khuôn mặt (Face Mesh) mượt mà 60 FPS trực tiếp trên camera điện thoại.

Camera giao thông / Camera an ninh thông minh (Edge AI): Camera tự nhận diện biển số xe hoặc phát hiện người đột nhập ngay trên chip của camera mà không cần gửi video lên cloud.

Robot tự hành / Drone: Nhận diện vật cản theo thời gian thực để né tránh mà không sợ mất mạng internet giữa đường.

2. Model trên Hugging Face (Kho cung cấp kiến trúc gốc siêu nhẹ)
Mức độ phù hợp: Cao (Nơi lấy các mô hình "baseline" nhẹ).

Khi nào dùng:

Khi bạn cần tìm các mô hình thị giác máy tính đã được cộng đồng tối ưu sẵn cho thiết bị di động (tìm các từ khóa như MobileNetV4, YOLO on-device, TinyViT).

Bạn tải các model này về từ Hugging Face, tiến hành fine-tune trên tập dữ liệu riêng của công ty, rồi dùng công cụ ở Nhóm 1 để xuất ra file chạy trên mobile/edge.

3. Scikit-learn (ML truyền thống)
Mức độ phù hợp: Không phù hợp.

Lý do:

Scikit-learn hoàn toàn không xử lý được dữ liệu ảnh thô (raw pixels) hay video streaming trên edge/mobile.

Nó chỉ có thể can thiệp ở bước cuối cùng (ví dụ: sau khi mô hình Deep Learning ở trên đã trích xuất ra các con số đặc trưng, Scikit-learn mới dùng các số đó để phân loại đơn giản), nhưng điều này rất hiếm khi làm vì tốn bộ nhớ chuyển đổi.

4. Vision APIs & Multimodal LLM của các ông lớn (OpenAI, Google Cloud Vision...)
Mức độ phù hợp: Rất thấp / Không khả thi cho phần lớn trường hợp.

Lý do:

Bạn không thể bắt camera hành trình trên ô tô, drone bay, hay camera an ninh phải gửi liên tục hàng chục khung hình video mỗi giây (FPS) lên cloud của OpenAI hay Google qua mạng di động được.

Việc này sẽ gây ra: Độ trễ quá lớn (không kịp xử lý tình huống khẩn cấp), tốn băng thông 4G/5G kinh khủng, và vi phạm bảo mật nghiêm trọng (vì video đời thực bị đẩy lên server bên thứ ba).

(Chỉ ngoại trừ một số trường hợp không cần real-time, ví dụ app mobile cho phép người dùng bấm chụp 1 bức ảnh rồi gửi lên cloud để phân tích định danh cây trồng thong thả trong 2-3 giây).

5. Tóm lại cho bài toán Computer Vision + Edge / Mobile:
Công thức chuẩn: PyTorch (Train) -> Fine-tune mô hình siêu nhẹ (Lấy gốc từ Hugging Face) -> Quantization & Chuyển đổi qua ONNX / TFLite / CoreML / TensorRT -> Deploy trực tiếp lên thiết bị.

Tuyệt đối tránh dùng Cloud API nếu hệ thống của bạn yêu cầu chạy offline, tốc độ cao (real-time) và bảo mật tuyệt đối trên thiết bị biên.