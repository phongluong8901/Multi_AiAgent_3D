# AI Child Simulation — Mô Phỏng AI Trẻ Em 3D (Thành Phố 60m x 60m)

Môi trường mô phỏng không gian sống 3D đa tác tử (Bé Bo & Bé Bi) kết hợp giữa **Cơ thể sinh học** (Năng lượng Kcal, Mệt mỏi, Nhịp ngày đêm), **Tư duy nội tại** (7 Nhu cầu Drives, Khám phá sương mù), **Residual Reinforcement Learning (RRL)** và **Hệ thống 3 Giai đoạn Trưởng thành Nhận thức**.

---

## 1. Cấu Trúc Bản Đồ Thành Phố 60m x 60m

- **Biệt Thự Gia Đình (Villa Bed Zone) `[12.0, 12.0]`**: Nơi nghỉ ngơi ban đêm, hồi phục thể lực, củng cố mạng nơ-ron qua giấc ngủ.
- **Quầy Nước Mát Hồ Bơi (Water Zone) `[39.0, 8.0]`**: Giải khát, giảm cơn khát (`thirst`).
- **Khu Hồ Bơi Nghỉ Dưỡng (Resort Pool) `[45.0, 14.0]`**: Khu hồ bơi và dù tắm nắng.
- **Bếp Ăn & Ẩm Thực Phố (Kitchen Zone) `[46.0, 44.0]`**: Nạp Kcal, giảm cơn đói (`hunger`).
- **Công Viên Cây Xanh & Thảm Chơi `[14.0, 44.0]`**: Cầu trượt, xích đu, thảm cỏ, kích thích tính tò mò (`curiosity`).
- **14 Vật Thể Kiến Trúc & Vật Lý Đô Thị**: Tòa nhà chung cư, siêu thị Mini Mart, nhà phố, xe sedan, SUV, xe van giao hàng, taxi... có va chạm vật lý cứng.

---

## 2. Hệ Thống Học Tăng Cường & Trưởng Thành Nhận Thức Mới

### 2.1. Residual Reinforcement Learning (RRL - Trao Vô Lăng Cho Mạng Nơ-ron)
- Hành động vận động thực tế được kết hợp giữa Tầng Nhận Thức (Base Planning) và Tầng Nơ-ron Actor-Critic (Neural Action):
  $$\vec{a}_{\text{final}} = (1 - \alpha) \cdot \vec{a}_{\text{base}} + \alpha \cdot \vec{a}_{\text{neural}}$$
- $\alpha$ (Chỉ số thuần thục - Competence): Tăng dần từ `0.20` lên đến `0.88` theo thời gian trải nghiệm. Mạng nơ-ron trực tiếp học cách bẻ lái, cắt góc cua, lách vật cản tinh tế.

### 2.2. Cơ Chế Tự Đúc Kết Kinh Nghiệm (Memory Consolidation & Reflection)
- Định kỳ sau mỗi 120 bước di chuyển hoặc khi về phòng ngủ trong Villa ban đêm:
  - Bé tự động đúc kết ra bài học cuộc sống: `"Sau chặng đường dài, mình nhận ra đi vòng qua bãi đỗ xe an toàn hơn chạy thẳng..."`.
  - Mạng nơ-ron kích hoạt quá trình củng cố ký ức offline (Offline Experience Replay) với các batch ưu tiên để tinh chỉnh trọng số khớp thần kinh.

### 2.3. Hệ Thống 3 Giai Đoạn Trưởng Thành Nhận Thức (Piagetian Stages)
1. **Giai đoạn 1: Chập Chững & Tò Mò (0 - 350 bước)**:
   - Bước đi còn vụng về, nhiễu khám phá cao, nơ-ron học hỏi từ những cú va chạm đầu đời.
2. **Giai đoạn 2: Khám Phá & Định Hình Phản Xạ (350 - 1.200 bước)**:
   - Thuộc làu bản đồ 60x60, ghi nhớ vết bỏng và góc xe, mạng nơ-ron tự bẻ lái né va chạm mượt mà.
3. **Giai đoạn 3: Tự Lập & Hợp Tác Gắn Kết (> 1.200 bước)**:
   - Mục tiêu là **tự hoàn thiện bản thân và gắn kết đồng đội**, loại bỏ cạnh tranh đối đầu tiêu cực.
   - Khi bạn đói hơn mình, bé chủ động nhường bữa ăn cho bạn và đi dạo công viên; khi no ấm, cả hai cùng đi dạo và chia sẻ nguồn nước mát.

### 2.4. Chu Kỳ Ngày / Đêm & Camera Theo Chân (Follow Cam POV)
- Chu kỳ ngày đêm 120 giây (Bình minh, Ban ngày, Hoàng hôn, Ban đêm).
- Đèn đường và cửa sổ tự động bật sáng lung linh khi về đêm; thúc đẩy bản năng về Villa ngủ.
- Nhấn phím `1`, `2`, `3` trên bàn phím để chuyển đổi linh hoạt giữa Toàn Cảnh, Theo chân Bé Bo và Theo chân Bé Bi.

---

## 2. Tính Năng Mới & Cách Tương Tác Với Bé

### 2.1. Chế Độ Tự Hành Sinh Tồn 24/7 (Autonomous Life)
- Khi mở ứng dụng lên, **Bé tự động sống, suy nghĩ và di chuyển 24/7** mà không cần bạn phải bấm nút dạy học:
  - Khi đói bụng -> tự đi tìm Bếp ăn nạp Kcal.
  - Khi khát nước -> tự đi lại Vòi nước uống.
  - Khi mệt mỏi -> tự về Giường ngủ nghỉ ngơi.
  - Khi gặp lò lửa nguy hiểm -> tự giác né tránh và giật lùi khi bị nóng.
  - Khi no ấm, thoải mái -> tự ra Thảm chơi xếp hình hoặc Cột sáng khám phá.

### 2.2. Bong Bóng Độc Thoại Nội Tâm 3D (Thought Bubble)
- Hiển thị trực tiếp trên đầu bé trong không gian 3D những câu suy nghĩ thời gian thực (Ví dụ: `"Bụng đói cồn cào rồi, đến Bếp ăn thôi..."`, `"Nước mát quá!"`, `"Được người hướng dẫn khen, thích quá!"`).

### 2.3. Click Chuột Lên Sàn Để Chỉ Đường (Click-to-Move)
- Click bất kỳ đâu trên mặt sàn 3D, một **Cột sáng ngọc xanh** sẽ cắm xuống vị trí đó và bé sẽ lập tức đi đến điểm bạn chỉ định.

### 2.4. Giáo Dục & Khen Thưởng / Phạt Thời Gian Thực (Micro-RLHF)
- Bấm nút **"Khen Thưởng (+1)"** (hoặc nhấn phím `R`): Khen ngợi bé khi làm việc tốt.
- Bấm nút **"Phạt Răn Đe (-1)"** (hoặc nhấn phím `P`): Nhắc nhở bé khi đến gần khu vực nguy hiểm.

### 2.5. Điều Chỉnh Tốc Độ Mô Phỏng
- Bạn có thể chỉnh tốc độ cuộc sống của bé: **Dừng (0x)**, **Chuẩn (1x)**, **Nhanh (2x)**, **Siêu tốc (5x)**.

---

## 3. Cách Khởi Chạy Ứng Dụng

### Bước 1: Chạy Backend Python AI Engine
Mở Terminal 1:
```bash
cd d:\A_Self_Proj\learn_mlflow\proj7_tauriApp\3D_RL\backend
.venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Bước 2: Chạy Desktop App (Tauri Dev Live)
Mở Terminal 2:
```bash
cd d:\A_Self_Proj\learn_mlflow\proj7_tauriApp\3D_RL\desktop
npm run dev
```
*(Cửa sổ ứng dụng Desktop sẽ mở lên với thế giới 3D sống động, bé tự động đi lại, ăn uống và trò chuyện ngay lập tức)*
