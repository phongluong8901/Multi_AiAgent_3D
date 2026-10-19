// src/docs/user.docs.ts

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Quản lý tài khoản người dùng, xác thực OTP, OAuth và Agent ownership
 */

/**
 * @swagger
 * /api/v1/users/register:
 *   post:
 *     summary: Đăng ký tài khoản mới và đẩy luồng gửi email OTP qua RabbitMQ
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: phongluong
 *               email:
 *                 type: string
 *                 example: phong@example.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Đăng ký thành công, vui lòng kiểm tra email để lấy mã OTP.
 *       400:
 *         description: Email đã tồn tại hoặc dữ liệu không hợp lệ.
 */

/**
 * @swagger
 * /api/v1/users/login:
 *   post:
 *     summary: Đăng nhập tài khoản truyền thống
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: phong@example.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về Access Token và lưu Refresh Token vào HttpOnly Cookie.
 *       401:
 *         description: Sai email hoặc mật khẩu.
 *       403:
 *         description: Tài khoản chưa xác thực OTP.
 */

/**
 * @swagger
 * /api/v1/users/google:
 *   post:
 *     summary: Đăng nhập / Đăng ký bằng Google OAuth
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 example: eyJhbGciOiJSUzI1NiIs...
 *     responses:
 *       200:
 *         description: Xác thực Google thành công.
 */

/**
 * @swagger
 * /api/v1/users/github:
 *   post:
 *     summary: Đăng nhập / Đăng ký bằng GitHub OAuth
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: 4a2b3c4d5e6f7g8h
 *     responses:
 *       200:
 *         description: Xác thực GitHub thành công.
 */

/**
 * @swagger
 * /api/v1/users/verify-otp:
 *   post:
 *     summary: Xác thực tài khoản bằng mã OTP 6 số
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 example: phong@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Kích hoạt tài khoản thành công.
 */

/**
 * @swagger
 * /api/v1/users/resend-otp:
 *   post:
 *     summary: Yêu cầu gửi lại mã OTP mới qua RabbitMQ
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: phong@example.com
 *     responses:
 *       200:
 *         description: Đã gửi lại mã OTP mới.
 */

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Lấy danh sách toàn bộ người dùng
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Trả về danh sách user thành công.
 */

/**
 * @swagger
 * /api/v1/users/forgot-password:
 *   post:
 *     summary: Yêu cầu quên mật khẩu (gửi OTP qua RabbitMQ)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: phong@example.com
 *     responses:
 *       200:
 *         description: Đã gửi mã OTP đặt lại mật khẩu.
 */

/**
 * @swagger
 * /api/v1/users/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu mới bằng mã OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 example: phong@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công.
 */

/**
 * @swagger
 * /api/v1/users/refresh-token:
 *   post:
 *     summary: Làm mới Access Token từ Refresh Token (trong Cookie)
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Cấp thành công Access Token mới.
 */

/**
 * @swagger
 * /api/v1/users/logout:
 *   post:
 *     summary: Đăng xuất tài khoản, thu hồi Refresh Token và xóa Cookie
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Đăng xuất thành công.
 */

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Lấy thông tin cá nhân của user đang đăng nhập
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về thông tin profile.
 *   put:
 *     summary: Cập nhật thông tin cá nhân của user
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
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công.
 */

/**
 * @swagger
 * /api/v1/users/change-password:
 *   post:
 *     summary: Đổi mật khẩu khi đã đăng nhập
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
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công.
 */

/**
 * @swagger
 * /api/v1/users/me/agents:
 *   get:
 *     summary: Lấy danh sách các agent thuộc sở hữu của user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về danh sách agent IDs.
 */

/**
 * @swagger
 * /api/v1/users/me/agents/{agentId}:
 *   post:
 *     summary: Thêm một agent vào danh sách sở hữu của user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thêm agent thành công.
 *   delete:
 *     summary: Xóa một agent khỏi danh sách sở hữu của user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa agent thành công.
 */

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Lấy thông tin công khai của bất kỳ user nào theo ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trả về thông tin user.
 *       404:
 *         description: Không tìm thấy user.
 */