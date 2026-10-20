// src/docs/user.docs.ts

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Quản lý hồ sơ cá nhân, trạng thái hoạt động, agent sở hữu và phần cứng Hardware Node
 */

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Lấy danh sách toàn bộ người dùng trong hệ thống
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Trả về danh sách user thành công.
 */

/**
 * @swagger
 * /api/v1/users/hardware-nodes:
 *   get:
 *     summary: Lấy danh sách toàn bộ các Hardware Node có năng lực chạy AI trên hệ thống
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Trả về danh sách các hardware node thành công.
 */

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Lấy thông tin chi tiết hồ sơ cá nhân của user đang đăng nhập
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về thông tin profile thành công.
 *       401:
 *         description: Chưa xác thực hoặc thiếu token.
 *   put:
 *     summary: Cập nhật thông tin hồ sơ cá nhân của user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: phongluong
 *               bio:
 *                 type: string
 *                 example: Fullstack & AI Developer
 *               avatarUrl:
 *                 type: string
 *                 example: https://res.cloudinary.com/...
 *     responses:
 *       200:
 *         description: Cập nhật profile thành công.
 */

/**
 * @swagger
 * /api/v1/users/me/status:
 *   put:
 *     summary: Cập nhật trạng thái hoạt động trực tuyến (online, offline, busy)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [online, offline, busy]
 *                 example: online
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công.
 */

/**
 * @swagger
 * /api/v1/users/me/avatar:
 *   put:
 *     summary: Tải lên và cập nhật ảnh đại diện (avatar) qua Cloudinary Buffer
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh đại diện cần tải lên
 *     responses:
 *       200:
 *         description: Cập nhật avatar thành công.
 */

/**
 * @swagger
 * /api/v1/users/me/hardware-node:
 *   get:
 *     summary: Lấy cấu hình phần cứng Hardware Node của người dùng hiện tại
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về thông tin hardware node thành công.
 *   post:
 *     summary: Cập nhật hoặc đăng ký thông số phần cứng nút tính toán AI (Hardware Node)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nodeName:
 *                 type: string
 *                 example: Edge Node 01
 *               gpuModel:
 *                 type: string
 *                 example: NVIDIA RTX 4090
 *     responses:
 *       200:
 *         description: Lưu cấu hình Hardware Node thành công.
 */

/**
 * @swagger
 * /api/v1/users/me/agents:
 *   get:
 *     summary: Lấy danh sách mã định danh các Agent mà người dùng sở hữu
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về danh sách agent IDs thành công.
 */

/**
 * @swagger
 * /api/v1/users/me/agents/{agentId}:
 *   post:
 *     summary: Thêm (đăng ký sở hữu) một Agent mới vào hồ sơ người dùng
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của agent cần thêm
 *     responses:
 *       200:
 *         description: Thêm agent thành công.
 *   delete:
 *     summary: Xóa (hủy sở hữu) một Agent khỏi hồ sơ người dùng
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của agent cần xóa
 *     responses:
 *       200:
 *         description: Xóa agent thành công.
 */

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết một người dùng theo ID (Public Profile)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của user cần lấy thông tin
 *     responses:
 *       200:
 *         description: Trả về thông tin user thành công.
 *       404:
 *         description: Không tìm thấy user.
 */