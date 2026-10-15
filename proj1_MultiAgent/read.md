# --- source

# --- setup
--- cd proj1_MultiAgent

- FE
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

- BE
mkdir backend
cd backend
npm init -y

- Tạo file backend/tsconfig.json

# --- install
cd proj1_MultiAgent
--- cd backend
npm install express cors
npm install -D typescript tsx @types/express @types/cors @types/node

npm install ws
npm install -D @types/ws

--- cd frontend
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three

npm install @react-three/rapier

# --- run
cd proj1_MultiAgent
--- cd backend
npm run dev

--- cd frontend
npm run dev


# --- docker

# --- cicd

# --- deploy