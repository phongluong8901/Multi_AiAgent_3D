/**
 * @openapi
 * tags:
 *   name: User-User Room
 *   description: Quản lý không gian phòng làm việc, thành viên và lời mời
 */

/**
 * @openapi
 * /api/rooms:
 *   get:
 *     summary: Lấy danh sách tất cả các phòng
 *     tags: [User-User Room]
 *     responses:
 *       200:
 *         description: Danh sách các phòng
 *   post:
 *     summary: Tạo phòng làm việc mới
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Virtual Office Team HQ
 *               description:
 *                 type: string
 *                 example: Không gian làm việc chung
 *               maxCapacity:
 *                 type: integer
 *                 example: 30
 *               ownerName:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: Tạo phòng thành công
 *       400:
 *         description: Thiếu dữ liệu bắt buộc
 *
 * /api/rooms/invites/me:
 *   get:
 *     summary: Lấy danh sách lời mời vào phòng của người dùng hiện tại
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách lời mời
 *
 * /api/rooms/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết phòng theo ID
 *     tags: [User-User Room]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin chi tiết phòng
 *       404:
 *         description: Không tìm thấy phòng
 *   put:
 *     summary: Cập nhật thông tin phòng
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cập nhật thông tin phòng thành công
 *       404:
 *         description: Không tìm thấy phòng
 *   delete:
 *     summary: Xóa phòng (Chỉ dành cho Chủ phòng)
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã xóa phòng thành công
 *
 * /api/rooms/{id}/join:
 *   post:
 *     summary: Tham gia vào phòng (Kiểm tra mật khẩu bcrypt nếu phòng private)
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Alice
 *               avatar:
 *                 type: string
 *               color:
 *                 type: string
 *                 example: "#3b82f6"
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Tham gia phòng thành công
 *
 * /api/rooms/{id}/leave:
 *   post:
 *     summary: Rời khỏi phòng
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rời phòng thành công
 *
 * /api/rooms/{id}/members:
 *   post:
 *     summary: Thêm thành viên vào phòng
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *               - memberType
 *             properties:
 *               memberId:
 *                 type: string
 *               memberType:
 *                 type: string
 *                 example: user
 *     responses:
 *       200:
 *         description: Thêm thành viên thành công
 *
 * /api/rooms/{id}/members/{memberId}:
 *   delete:
 *     summary: Xóa thành viên khỏi phòng
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành viên thành công
 *
 * /api/rooms/{id}/invites:
 *   post:
 *     summary: Gửi lời mời tham gia phòng
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *               userName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Gửi lời mời thành công
 *
 * /api/rooms/{id}/invites/accept:
 *   post:
 *     summary: Chấp nhận lời mời vào phòng
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chấp nhận lời mời thành công
 *
 * /api/rooms/{id}/invites/decline:
 *   post:
 *     summary: Từ chối lời mời vào phòng
 *     tags: [User-User Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Từ chối lời mời thành công
 */