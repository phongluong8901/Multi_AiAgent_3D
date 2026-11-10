FROM python:3.11-slim

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt các tiện ích hệ thống tối thiểu
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và cài đặt thư viện
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Tạo người dùng không đặc quyền (non-root) để bảo vệ sandbox
RUN useradd -m -u 1000 sandbox_user && \
    mkdir -p /sandbox/workspace && \
    chown -R sandbox_user:sandbox_user /sandbox /app

# Copy mã nguồn
COPY main.py .

# Chuyển sang người dùng non-root
USER sandbox_user

EXPOSE 5008

ENV PYTHONUNBUFFERED=1
ENV SANDBOX_WORKSPACE=/sandbox/workspace

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5008"]
