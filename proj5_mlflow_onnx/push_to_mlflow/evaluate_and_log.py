import os
import glob
import mlflow
import numpy as np
import onnxruntime as ort
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split

# 1. Kết nối tới MLflow Server trên Docker và dùng tên mới để tránh đụng độ rác cũ
mlflow.set_tracking_uri("http://localhost:5000")
mlflow.set_experiment("model_comparison_v3")

models_dir = "models"

# 2. Tạo dữ liệu và chia tập Test chuẩn
X, y = make_classification(n_samples=5000, n_features=4, n_classes=2, random_state=42)
_, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
X_test = X_test.astype(np.float32)

print("--- Đang quét thư mục models/ và tự động đánh giá các bản ONNX ---")

onnx_files = glob.glob(os.path.join(models_dir, "*.onnx"))

if not onnx_files:
    print(f"Không tìm thấy file .onnx nào trong thư mục '{models_dir}'!")
else:
    for file_path in onnx_files:
        filename = os.path.basename(file_path)
        print(f"\nĐang xử lý mô hình: {filename}")
        
        try:
            # 3. Dùng ONNX Runtime để load model và chạy inference tự động
            session = ort.InferenceSession(file_path)
            input_name = session.get_inputs()[0].name
            
            outputs = session.run(None, {input_name: X_test})
            preds = outputs[0]
            
            # 4. Tính toán độ chính xác (Accuracy) thực tế
            preds_cls = (preds >= 0.5).astype(int).squeeze()
            accuracy_score = float((preds_cls == y_test).mean())
            
            # 5. Đưa kết quả lên MLflow Tracking Server
            with mlflow.start_run(run_name=filename) as run:
                mlflow.log_param("model_filename", filename)
                mlflow.log_metric("accuracy", accuracy_score)
                
                # Đẩy file .onnx vào thư mục artifact chuẩn trên MLflow
                mlflow.log_artifact(file_path, artifact_path="model_files")
                
                # Nếu có file trọng số đi kèm (.onnx.data), đẩy vào luôn
                data_file_path = file_path + ".data"
                if os.path.exists(data_file_path):
                    mlflow.log_artifact(data_file_path, artifact_path="model_files")
                
                print(f"-> Đã log thành công lên MLflow! Accuracy thật = {accuracy_score:.4f}")
                
        except Exception as e:
            print(f"-> Lỗi khi xử lý {filename}: {e}")

print("\nHoàn tất toàn bộ! Hãy mở MLflow UI tại http://localhost:5000 để xem bảng so sánh.")