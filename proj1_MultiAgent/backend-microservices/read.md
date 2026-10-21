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
npm install google-auth-library
npm install nodemailer
npm install --save-dev @types/nodemailer

npm install amqplib
npm install --save-dev @types/amqplib

npm install cloudinary multer
npm install --save-dev @types/multer

npm install cookie-parser
npm install --save-dev @types/cookie-parser

npm install swagger-ui-express swagger-jsdoc
npm install --save-dev @types/swagger-ui-express @types/swagger-jsdoc

npm install redis
npm install --save-dev @types/redis

npm install express-rate-limit rate-limit-redis

npm install ioredis
npm uninstall redis

npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/api prom-client express-prom-bundle winston

--- gateway-service
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken

--- room-service
npm install amqplib
npm install socket.io

npm install bcrypt
npm install --save-dev @types/bcrypt

--- frontend-microservices
npm install @react-oauth/google
npm install axios
npm install sonner

npm install lucide-react

npm install socket.io-client

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
docker compose up --build -d api-gateway


- xoa
docker compose down

- xoa va dat lai

docker compose down -v

# --- link port
- swagger agent
http://localhost:4000/docs

- swagger user-service
http://localhost:5001/docs

- redis commander
http://localhost:8081

- rabbitMQ
http://localhost:15672/#/

# --- link tracing, monitor, mertrics
- Dashboard (Grafana)
http://localhost:3003
- Metrics (Prometheus)
http://localhost:9090



# --- link setup
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
- oauth2.0
https://console.cloud.google.com/apis/credentials?project=microservice-multiagent3d
- smtp mail - passgoogle app
https://myaccount.google.com/apppasswords
- github oauth2.0
https://github.com/settings/developers 
-> oauth github