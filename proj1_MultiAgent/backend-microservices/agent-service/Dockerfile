# Sử dụng Python 3.11 bản slim nhẹ nhàng
FROM python:3.11-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Cài đặt các package hệ thống cần thiết cho build (nếu cần cho psycopg2)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt các thư viện Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ source code vào container
COPY . .

# Mở cổng 8000 cho FastAPI
EXPOSE 8000

# Lệnh chạy ứng dụng
CMD ["uvicorn", "app.agent_services:app", "--host", "0.0.0.0", "--port", "8000"]