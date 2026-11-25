# - python client (check PC and conenct to server)
cd python-client

pip install customtkinter requests torch psutil websockets
pip install customtkinter
pip install flet torch psutil websockets
- 
py woker.py
python workerUI.py

# - go server (connect python client)
cd core-server

go mod init core-server
go get github.com/gorilla/websocket

- 
go run main.go

# - fe cho UI worker
npm create tauri-app@latest


✔ Project name · tauri-app
✔ Identifier · com.mbw2025.tauri-app
✔ Choose which language to use for your frontend · TypeScript / JavaScript - (pnpm, yarn, npm, deno, bun)
✔ Choose your package manager · npm
✔ Choose your UI template · React - (https://react.dev/)
✔ Choose your UI flavor · TypeScript

-
npm install -g pnpm
pnpm install
-
pnpm tauri dev

-
pnpm tauri build

