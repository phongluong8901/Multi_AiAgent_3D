FROM node:20-alpine

# Thiết lập thư mục làm việc mặc định bên trong container là /app
WORKDIR /app

# Sao chép file package.json và package-lock.json vào thư mục /app
COPY package*.json ./

# Cài đặt các công cụ biên dịch bổ trợ (python3, make, g++) cho các thư viện C++ và chạy lệnh npm install để tải các gói phụ thuộc
RUN apk add --no-cache python3 make g++ \
    && npm install

# Sao chép toàn bộ mã nguồn còn lại từ máy host vào thư mục /app trong container
COPY . .
# Chạy lệnh biên dịch mã nguồn
RUN npm run build

# Khai báo để Docker biết ứng dụng bên trong container sẽ lắng nghe tại cổng 5001
EXPOSE 5001

CMD ["npm", "start"]