// src/docs/profile.docs.ts

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: Quản lý hồ sơ cá nhân, trạng thái hoạt động và agent sở hữu qua API Gateway
 */

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Lấy thông tin chi tiết hồ sơ cá nhân
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về thông tin profile thành công.
 *       401:
 *         description: Chưa xác thực hoặc thiếu token.
 *   put:
 *     summary: Cập nhật thông tin hồ sơ cá nhân
 *     tags: [Profile]
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
 *     summary: Cập nhật trạng thái hoạt động của user (online, offline, busy)
 *     tags: [Profile]
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
 * /api/v1/users/logout:
 *   post:
 *     summary: Đăng xuất người dùng, xóa token và trạng thái offline
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công.
 */

/**
 * @swagger
 * /api/v1/users/me/agents:
 *   get:
 *     summary: Lấy danh sách các agent thuộc quyền sở hữu của user
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về danh sách mã định danh agent.
 */

/**
 * @swagger
 * /api/v1/users/me/agents/{agentId}:
 *   post:
 *     summary: Thêm một agent mới vào danh sách sở hữu của user
 *     tags: [Profile]
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
 *     summary: Xóa một agent khỏi danh sách sở hữu của user
 *     tags: [Profile]
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