
--- cd core-service
go run main.go

--- cd backend
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Tạo môi trường ảo có tên là 'venv'
python -m venv venv

# 3. Kích hoạt môi trường ảo:
# - Nếu dùng Windows (PowerShell):
.\venv\Scripts\Activate.ps1

-
pip install psutil websocket-client
pip install -r requirements.txt
-
pyinstaller --onefile main.py

--- cd frontend
npx create-vite@5.5.2 frontend --template react-ts

cd frontend
npm install

npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

--- electron
npm init -y
npm install -D electron electron-builder

npm start

--- dong goi
- go
go build -o server.exe main.go

- py
pip install pyinstaller
pyinstaller --noconsole --onefile worker.py
-> keo ra ngoai voi main.js

- react
npm run build

- build win
npm run build:win

- build linux
npx electron-builder --linux