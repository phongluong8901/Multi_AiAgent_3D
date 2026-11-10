my-ai-project/
├── backend/
│   ├── main.py          # FastAPI server
│   └── model.onnx       # File ONNX lấy từ MLflow/artifact
└── frontend/
    ├── src/
    │   └── App.jsx      # Giao diện React
    └── package.json


# --- training
python -m venv myenv
myenv\Scripts\Activate.ps1

pip install mlflow torch torchvision torchaudio scikit-learn onnx

python train.py

# --- backend
python -m venv myenv
myenv\Scripts\Activate.ps1

pip install fastapi uvicorn onnxruntime numpy

uvicorn main:app --reload --port 8000

# --- frontend
npm create vite@latest frontend -- --template react
-> oxlint ma quat

- cd frontend
npm install axios lucide-react

npm run dev

# --- docker compose
docker compose up -d --build backend

docker compose up -d --build

- dung file train neu may khoe hoac train tren colab roi tai model xuong (models)
model.onnx (Cấu trúc đồ thị).
model.onnx.data (Trọng số - Weights nằm ở đây).

python trainning/train.py

- push to mlflow để đánh giá
python push_to_mlflow/evaluate_and_log.py