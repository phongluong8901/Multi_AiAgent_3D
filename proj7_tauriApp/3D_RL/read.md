# AI Child Simulation — Mô Phỏng AI Trẻ Em 3D (20m x 20m)

Môi trường mô phỏng không gian sống 3D hoàn chỉnh kết hợp giữa **Cơ thể sinh học** (Năng lượng Kcal, Mệt mỏi, Tốc độ) và **Tư duy nội tại** (7 Nhu cầu Drives, Thử-sai, Học từ Người hướng dẫn).

---

## 1. Cấu Trúc Bản Đồ Thế Giới (20m x 20m)

- **Khu Giường Ngủ (Bed Zone) `[2.5, 2.5]`**: Nơi bé nghỉ ngơi, hồi phục thể lực, giảm mỏi cơ (`fatigue`) và xoa dịu đau đớn (`pain`).
- **Khu Bếp & Thức Ăn (Kitchen & Food Zone) `[3.0, 17.0]`**: Bàn tròn và đĩa thức ăn vàng cam. Khi bé đói (`hunger`), di chuyển đến đây để nạp Kcal.
- **Khu Vòi Nước Uống (Water Fountain) `[17.0, 3.0]`**: Bồn nước mát màu xanh ngọc. Khi bé khát (`thirst`), di chuyển đến đây để giải khát.
- **Điểm Mục Tiêu Khám Phá (Goal Target) `[17.0, 17.0]`**: Khối ngọc phát sáng xanh lá kích thích tính tò mò (`curiosity`).
- **Khu Vực Thảm Chơi Trẻ Em `[10.0, 10.0]`**: Trung tâm sân chơi với thảm tròn, khối xếp hình rubik đỏ, kim tự tháp vàng và bóng đồ chơi xanh lá.
- **6 Vùng Chướng Ngại Vật & Nguy Hiểm**:
  - Lò lửa sưởi ấm (`[6.5, 6.5]`): Chạm vào gây bỏng và kích hoạt cơn đau (`pain`), làm bé sợ hãi (`fear`).
  - Cọc chông nhọn (`[13.5, 6.5]`): Vật cản sắc nhọn.
  - Các thùng gỗ, tủ cao và vách ngăn (`[6.5, 13.5]`, `[13.5, 13.5]`, `[10.0, 4.5]`, `[10.0, 15.5]`).
- **Tường Rào Bao Quanh**: Ngăn bé không đi lạc ra ngoài không gian vô tận.
- **Cây Xanh Bóng Mát**: Bố trí quanh các góc sân tạo không gian sinh động.

---

## 2. Ý Nghĩa Các Chỉ Số Nội Tại (Internal Systems)

1. **Dự Trữ Năng Lượng (Energy Kcal)**: Năng lượng tối đa 1000 Kcal. Di chuyển và suy nghĩ tiêu tốn Kcal. Khi năng lượng dưới 30%, thể lực tối đa của bé giảm mạnh.
2. **Độ Đói (Hunger)**: Tự tăng theo thời gian; giảm khi bé đến khu Bếp ăn hoặc khi người hướng dẫn bấm "Cho Ăn".
3. **Độ Khát (Thirst)**: Tăng đều; giảm khi bé đến khu Vòi nước.
4. **Mệt Mỏi (Fatigue)**: Tăng khi vận động liên tục; giảm khi bé nằm nghỉ trên Giường.
5. **Cơn Đau (Pain)**: Tăng vọt khi va đụng vào chướng ngại vật hoặc lò lửa; kích hoạt phản xạ giật lùi.
6. **Sợ Hãi (Fear)**: Tăng khi bé ở gần vùng nguy hiểm; giảm khi bé ở nơi an toàn gần giường ngủ.
7. **Tò Mò (Curiosity)**: Tự động tăng cao khi bé đã no nê, thoải mái và an toàn, thúc đẩy bé tự đi khám phá.
8. **Độ Dễ Chịu (Comfort)**: Điểm cân bằng nội tại tổng thể của bé.

---

## 3. Cách Sử Dụng & Điều Khiển

### Bước 1: Khởi động Backend (Python AI Engine)
```bash
cd backend
.venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Bước 2: Khởi động Giao diện Frontend (React + Three.js)
```bash
cd frontend
npm run build
npm run dev
```

### Bước 3: Điều khiển bé bằng Bàn phím (Chế độ Người Hướng Dẫn)
1. Trên giao diện, tìm bảng **BẢNG NGƯỜI HƯỚNG DẪN (TEACHER)** ở cột bên phải.
2. Nhấn nút **"Bật Lái Phím (WASD)"**.
3. Dùng các phím sau trên bàn phím:
   - `W` hoặc phím `Mũi tên Lên`: Đi lên phía Bắc (về phía Bếp ăn).
   - `S` hoặc phím `Mũi tên Xuống`: Đi xuống phía Nam (về phía Giường ngủ).
   - `A` hoặc phím `Mũi tên Trái`: Đi sang phía Tây.
   - `D` hoặc phím `Mũi tên Phải`: Đi sang phía Đông (về phía Vòi nước / Đích).
4. Hệ thống sẽ tự động ghi nhận các bước bạn lái (`Demos`) vào cơ sở dữ liệu SQLite local để làm dữ liệu mẫu dạy bé học bắt chước.
5. Nhấn **"Cho Ăn (+250 Kcal)"** khi thấy thanh Độ đói tăng cao.
6. Nhấn **"Lưu Trạng Thái"** để lưu lại thể trạng của bé vào ổ đĩa.
