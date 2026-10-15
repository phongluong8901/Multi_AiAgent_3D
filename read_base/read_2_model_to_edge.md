# --- cac phuong phap nen model cho edge, mobile
Đưa các mô hình AI/Machine Learning lên Edge (thiết bị biên như Raspberry Pi, camera thông minh, xe tự hành) và Mobile (iOS, Android) là một bài toán khó. Nguyên nhân là các thiết bị này bị giới hạn nghiêm trọng về bộ nhớ RAM, dung lượng lưu trữ, năng lượng pin và sức mạnh tính toán (GPU/NPU di động).

Để giải quyết, các kỹ sư sử dụng bộ các phương pháp nén mô hình (Model Compression) cốt lõi dưới đây:

1. Lượng tử hóa (Quantization)
Bản chất: Mô hình gốc thường được huấn luyện bằng số thực 32-bit (FP32). Lượng tử hóa sẽ ép các trọng số (weights) và độ kích hoạt (activations) xuống các định dạng ít tốn bộ nhớ hơn như FP16, INT8, hoặc thậm chí INT4/Binary.
Ưu điểm:

Giảm dung lượng mô hình xuống 2 đến 4 lần (ví dụ: mô hình 500MB xuống còn 125MB).

Tăng tốc độ suy luận (inference) đáng kể nhờ các phần cứng hiện đại có hỗ trợ nhân xử lý số nguyên (INT8/INT4 Tensor Cores hoặc NPU).

Đánh đổi: Có thể sụt giảm một chút về độ chính xác (accuracy), nhưng thường không đáng kể nếu áp dụng kỹ thuật Quantization-Aware Training (QAT).

2. Cắt tỉa mạng (Pruning)
Giống như việc tỉa bớt các cành cây khô hoặc ít quan trọng để tập trung dinh dưỡng cho thân chính.

Bản chất: Trong một mạng neural, có rất nhiều kết nối hoặc neuron đóng góp rất ít vào kết quả cuối cùng (trọng số gần bằng 0). Pruning sẽ xác định và xóa bỏ hẳn các trọng số hoặc các kênh (channels/layers) ít quan trọng này.

Phân loại:

Unstructured Pruning: Xóa các trọng số riêng lẻ ngẫu nhiên. Giảm kích thước file tốt nhưng khó tăng tốc trên phần cứng thông thường.

Structured Pruning: Xóa nguyên cả cột, hàng của ma trận trọng số hoặc nguyên cả kênh (filter). Giúp mô hình nhỏ gọn và chạy nhanh hơn trực tiếp trên phần cứng thực tế.

3. Chưng cất tri thức (Knowledge Distillation)
Ý tưởng là dùng một "thầy giỏi" để dạy cho "trò khôn".

Bản chất: Bạn có một mô hình lớn, cực kỳ chính xác nhưng quá nặng (Teacher Model - ví dụ: một mô hình LLM khổng lồ hoặc ResNet-152). Bạn sẽ huấn luyện một mô hình nhỏ hơn, gọn hơn từ đầu (Student Model - ví dụ: MobileNet hoặc mô hình rút gọn) bằng cách bắt nó học cách suy luận và phân phối xác suất của mô hình lớn, thay vì chỉ học nhãn đúng/sai thuần túy.

Ưu điểm: Mô hình "học sinh" giữ lại được phần lớn độ thông minh của "thầy giáo" nhưng kích thước lại cực kỳ nhỏ gọn, phù hợp chạy mượt trên điện thoại.

4. Kiến trúc mạng tối ưu hóa sẵn (Efficient Architectures)
Thay vì cố gắng nén một mô hình cồng kềnh, các nhà nghiên cứu thiết kế ra các kiến trúc mạng được tối ưu hóa cho thiết bị di động ngay từ gốc:

Ví dụ:

Trong thị giác máy tính (Vision): MobileNet (sử dụng Depthwise Separable Convolution để giảm số lượng phép tính), EfficientNet, hoặc các biến thể YOLO nhỏ gọn cho mobile.

Trong xử lý ngôn ngữ/AI tạo sinh: Các dòng mô hình nhỏ như MobileBERT, Phi, hoặc các kiến trúc tối ưu cho Edge devices.

5. Low-Rank Factorization (Phân rã ma trận) 
Bản chất: Dựa trên nền tảng toán học tương tự như PCA mà chúng ta vừa nói ở phần trước. Các lớp tuyến tính (Linear/Convolution layers) trong mạng neural thực chất là các phép nhân ma trận lớn. Phân rã ma trận sẽ tách một ma trận lớn thành hai hoặc nhiều ma trận nhỏ hơn nhân với nhau, giúp giảm mạnh số lượng tham số và phép tính cần thực hiện mà vẫn giữ lại phần lớn đặc trưng dữ liệu.

6. 
Khi đưa AI lên Mobile hay Edge, các kỹ sư thường kết hợp các phương pháp này lại với nhau (ví dụ: dùng một kiến trúc gọn như MobileNet $\rightarrow$ tiến hành Pruning $\rightarrow$ cuối cùng là Quantization sang INT8) để đạt được sự cân bằng tối ưu giữa Độ chính xác, Dung lượng và Tốc độ xử lý (FPS / Độ trễ).