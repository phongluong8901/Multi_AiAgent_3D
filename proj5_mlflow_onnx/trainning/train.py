import os
import shutil
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
import mlflow
import mlflow.pytorch

# 0. Cấu hình kết nối với MLflow Tracking Server (Docker)
mlflow.set_tracking_uri("http://localhost:5000")

# Cấu hình biến môi trường kết nối MinIO/S3 cho MLflow Artifacts
os.environ["AWS_ACCESS_KEY_ID"] = "minio_admin"
os.environ["AWS_SECRET_ACCESS_KEY"] = "minio_password"
os.environ["MLFLOW_S3_ENDPOINT_URL"] = "http://localhost:9000"

# 1. Chuẩn bị dữ liệu giả lập
X, y = make_classification(n_samples=1000, n_features=4, n_classes=2, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

X_train_t = torch.tensor(X_train, dtype=torch.float32)
y_train_t = torch.tensor(y_train, dtype=torch.float32).unsqueeze(1)
X_test_t = torch.tensor(X_test, dtype=torch.float32)

# 2. Định nghĩa kiến trúc Neural Network đơn giản
class SimpleNet(nn.Module):
    def __init__(self):
        super(SimpleNet, self).__init__()
        self.linear = nn.Sequential(
            nn.Linear(4, 8),
            nn.ReLU(),
            nn.Linear(8, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        return self.linear(x)

lr = 0.01
epochs = 50

# 3. Bắt đầu phiên làm việc với MLflow (Tracking)
mlflow.set_experiment("docker_mlflow_onnx_demo")

with mlflow.start_run() as run:
    print("--- Dang tien hanh Train model voi PyTorch ---")
    
    # Log hyperparameters lên MLflow
    mlflow.log_param("learning_rate", lr)
    mlflow.log_param("epochs", epochs)
    
    model = SimpleNet()
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    
    # Vòng lặp Train
    model.train()
    for epoch in range(epochs):
        optimizer.zero_grad()
        outputs = model(X_train_t)
        loss = criterion(outputs, y_train_t)
        loss.backward()
        optimizer.step()
        
    # Đánh giá độ chính xác (Accuracy)
    model.eval()
    with torch.no_grad():
        preds = model(X_test_t)
        preds_cls = (preds >= 0.5).float()
        accuracy = (preds_cls.squeeze() == torch.tensor(y_test, dtype=torch.float32)).float().mean().item()
    
    # Log metric lên MLflow
    mlflow.log_metric("accuracy", accuracy)
    print(f"Train hoan tat! Accuracy: {accuracy:.4f}")
    
    # 4. Xuất mô hình PyTorch sang định dạng ONNX
    onnx_path = "model.onnx"
    dummy_input = torch.randn(1, 4, dtype=torch.float32)
    
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    print(f"Da export thanh cong sang file: {onnx_path}")
    
    # 5. Lưu một bản vào thư mục backend để FastAPI nạp trực tiếp
    os.makedirs("../backend", exist_ok=True)
    shutil.copy(onnx_path, "../backend/model.onnx")
    
    # 6. Đưa file ONNX lên MLflow Artifacs (MinIO trên Docker)
    mlflow.log_artifact(onnx_path)
    print("Da dua file ONNX vao MLflow Artifacts va copy sang backend thanh cong!")

print(f"MLflow Run ID: {run.info.run_id}")