# --- setup
cd proj1_MultiAgent
cd backend-microservices

--- agent-service
python -m venv .venv
.venv\Scripts\activate

--- user-service
npm init -y
npm install express mongoose dotenv cors bcrypt jsonwebtoken
npm install -D typescript @types/node @types/express @types/cors @types/bcrypt @types/jsonwebtoken ts-node-dev
npx tsc --init

--- room-service
cd src
mkdir config, models, repositories, services, controllers, routes

npm init -y
npm install express mongoose dotenv cors
npm install -D typescript @types/node @types/express @types/cors tsx
npx tsc --init

--- chat-service
cd src
mkdir config, models, repositories, services, controllers, routes

npm init -y
npm install express mongoose dotenv cors socket.io
npm install -D typescript @types/node @types/express @types/cors tsx
npx tsc --init

--- gateway-service
npm init -y
npm install express dotenv cors http-proxy-middleware
npm install -D typescript @types/node @types/express @types/cors tsx
npx tsc --init

--- frontend-microservices
cd proj1_MultiAgent
cd frontend-microservices



# --- install
--- agent-service
pip install fastapi uvicorn sqlalchemy psycopg2-binary pydantic python-dotenv
pip install "psycopg[binary]"

pip install pydantic-settings
pip install beautifulsoup4 lxml

pip install transformers torch

--- user-service
npm install --save-dev @types/node
npm install -D tsx

--- gateway-service

--- room-service
npm install amqplib


# --- run
cd proj1_MultiAgent
cd backend-microservices

--- cd agent-service
uvicorn app.agent_services:app --reload --port 8000


--- user-service
npm run dev

--- gateway-service

--- 

# --- docker compose
cd proj1_MultiAgent
cd backend-microservices

docker compose up --build

# --- docker cli
- build toan bo
docker compose up --build -d

- build rieng
docker compose up --build -d user-service
docker compose up --build -d room-service 
docker compose up --build -d chat-service
docker compose up --build -d agent-service
docker compose up --build -d api-gateway-service


- xoa
docker compose down

- xoa va dat lai

docker compose down -v

# --- link
- swagger agent
http://localhost:4000/docs

- tavily search
https://app.tavily.com/home
- google search
https://console.cloud.google.com/apis/credentials?project=carapp2026-57b5c
- google engine search
https://programmablesearchengine.google.com/controlpanel/all
- langsmith
https://smith.langchain.com/
- apikey genai
https://aistudio.google.com/api-keys