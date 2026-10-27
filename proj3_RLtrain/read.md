threejs-rl-agent/
├── python-trainer/           # Nơi huấn luyện AI bằng CPU và xuất file ONNX
│   ├── venv/
│   └── train_and_export.py
└── web-visualizer/           # Giao diện 3D Three.js chạy model ONNX
    ├── public/
    │   └── agent_policy.onnx # File não AI được xuất từ Python sang đây
    ├── index.html
    ├── main.js
    └── package.json


# ---
