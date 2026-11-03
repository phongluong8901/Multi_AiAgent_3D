# RL Obstacle Avoidance 3D

## Project Structure

```text
backend/
├── main.py
├── requirements.txt
├── .env
├── app/
│   ├── api/
│   │   ├── routes.py
│   │   └── deps.py
│   ├── core/
│   │   ├── config.py
│   │   ├── websocket_manager.py
│   │   └── logger.py
│   ├── envs/
│   │   ├── base.py
│   │   └── obstacle_avoidance.py
│   ├── trainers/
│   │   ├── base_trainer.py
│   │   └── ppo_trainer.py
│   ├── services/
│   │   ├── training_service.py
│   │   └── model_service.py
│   └── schemas/
│       └── training.py
├── models/
└── logs/

frontend/
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── Scene3D.tsx
│   │   ├── Robot.tsx
│   │   ├── Goal.tsx
│   │   ├── Obstacles.tsx
│   │   ├── ControlPanel.tsx
│   │   ├── StatusBar.tsx
│   │   ├── LogPanel.tsx
│   │   └── RewarChart.tsx
│   ├── stores/
│   │   └── useTrainingStore.ts
│   ├── hooks/
│   │   └── useWebSocket.ts
│   ├── lib/
│   │   └── api.ts
│   └── types/
│       └── index.ts
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
└── index.html

desktop/
├── package.json
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
        ├── main.rs
        └── lib.rs
```

## Setup & Run Instructions

### 1. Backend (FastAPI + PPO)
```bash
cd backend
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Frontend (React + Three.js)
```bash
cd frontend
npm install
npm run build
```

### 3. Tauri Desktop App
```bash
cd desktop
npm install
npm run dev
```

### 4. Build Installer (.exe)
```bash
# Step 1: Build frontend
cd frontend
npm run build

# Step 2: Build Tauri application
cd ../desktop
npm run build
```
Output bundle location: `desktop/src-tauri/target/release/bundle/`
