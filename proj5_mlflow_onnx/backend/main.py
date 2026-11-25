from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import onnxruntime as ort
import numpy as np
import os
import mlflow
from mlflow.tracking import MlflowClient

app = FastAPI(title="Auto-Best ONNX Inference API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Kết nối MLflow Server
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://mlflow-server:5000")
mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
client = MlflowClient()

EXPERIMENT_NAME = "model_comparison_v3"

try:
    print("--> Đang tự động truy vấn MLflow để tìm mô hình có Accuracy cao nhất...")
    
    experiment = client.get_experiment_by_name(EXPERIMENT_NAME)
    if not experiment:
        raise Exception(f"Không tìm thấy experiment '{EXPERIMENT_NAME}' trên MLflow!")
        
    experiment_id = experiment.experiment_id

    # Tự động tìm kiếm các run, sắp xếp theo metric accuracy giảm dần và lấy bản tốt nhất
    runs = client.search_runs(
        experiment_ids=[experiment_id],
        order_by=["metrics.accuracy DESC"],
        max_results=1
    )

    if not runs:
        raise Exception("Không tìm thấy lần chạy (run) nào trên MLflow!")

    best_run = runs[0]
    best_run_id = best_run.info.run_id
    best_accuracy = best_run.data.metrics.get("accuracy", 0)
    best_model_name = (
        best_run.data.params.get("model_filename")
        or best_run.data.tags.get("mlflow.runName")
        or best_run_id
    )
    
    print(f"--> Đã tìm thấy bản vô địch! Run ID: {best_run_id} với Accuracy = {best_accuracy:.4f}")

    # Tự động tải artifact từ đúng thư mục "model_files" về
    local_model_path = mlflow.artifacts.download_artifacts(run_id=best_run_id, artifact_path="model_files")
    
    onnx_files = [f for f in os.listdir(local_model_path) if f.endswith(".onnx")]
    if not onnx_files:
        raise FileNotFoundError("Không tìm thấy file .onnx trong artifact của MLflow!")
        
    model_path = os.path.join(local_model_path, onnx_files[0])
    print(f"--> Đã tải thành công model tốt nhất về đường dẫn: {model_path}")

except Exception as e:
    print(f"⚠️ Lỗi kết nối MLflow hoặc tải model ({e}). Vui lòng kiểm tra lại MLflow Server!")
    raise e

session = ort.InferenceSession(model_path)

class PredictionRequest(BaseModel):
    features: list[float]

@app.post("/predict")
def predict(data: PredictionRequest):
    if len(data.features) != 4:
        return {"error": "Yêu cầu cung cấp đúng 4 giá trị đặc trưng (features)"}
    
    X_new = np.array([data.features], dtype=np.float32)
    inputs = {session.get_inputs()[0].name: X_new}
    outputs = session.run(None, inputs)
    
    probability = float(outputs[0][0][0])
    predicted_class = 1 if probability >= 0.5 else 0
    
    return {
        "probability": probability,
        "class": predicted_class,
        "model_name": best_model_name,
        "accuracy": best_accuracy,
    }