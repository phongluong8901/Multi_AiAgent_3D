// src/docs/auth.docs.ts

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Quản lý đăng ký, đăng nhập, xác thực OTP, OAuth (Google/GitHub) và cấp lại token
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới và gửi mã OTP qua RabbitMQ
 *     tags: [Auth]
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
 *       201:
 *         description: Đăng ký thành công, vui lòng kiểm tra email để lấy mã OTP.
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc email đã tồn tại.
 */

/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Xác thực tài khoản bằng mã OTP 6 số
 *     tags: [Auth]
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
 *       400:
 *         description: Mã OTP không chính xác hoặc đã hết hạn.
 */

/**
 * @swagger
 * /api/v1/auth/resend-otp:
 *   post:
 *     summary: Gửi lại mã OTP mới cho người dùng chưa kích hoạt
 *     tags: [Auth]
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
 * /api/v1/auth/login:
 *   post:
 *     summary: Đăng nhập truyền thống bằng email và mật khẩu
 *     tags: [Auth]
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
 * /api/v1/auth/google:
 *   post:
 *     summary: Đăng nhập / Đăng ký bằng Google OAuth 2.0
 *     tags: [Auth]
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
 *         description: Xác thực Google thành công, trả về Access Token và Cookie.
 */

/**
 * @swagger
 * /api/v1/auth/github:
 *   post:
 *     summary: Đăng nhập / Đăng ký bằng GitHub OAuth
 *     tags: [Auth]
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
 *         description: Xác thực GitHub thành công, trả về Access Token và Cookie.
 */

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Yêu cầu quên mật khẩu (gửi mã OTP qua RabbitMQ)
 *     tags: [Auth]
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
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu mới bằng mã OTP
 *     tags: [Auth]
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
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Đổi mật khẩu tài khoản khi đã đăng nhập
 *     tags: [Auth]
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
 *                 example: oldpassword123
 *               newPassword:
 *                 type: string
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công.
 *       401:
 *         description: Chưa xác thực hoặc sai mật khẩu cũ.
 */

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Cấp lại Access Token mới dựa trên Refresh Token hợp lệ
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Cấp thành công Access Token mới.
 *       403:
 *         description: Refresh Token không hợp lệ hoặc đã hết hạn.
 */

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Đăng xuất tài khoản (thu hồi refresh token và xóa cookie)
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công.
 */