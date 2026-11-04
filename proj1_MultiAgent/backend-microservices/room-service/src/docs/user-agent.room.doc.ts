/**
 * @openapi
 * tags:
 *   name: User-Agent Room
 *   description: Quản lý liên kết giữa User và Agent cá nhân trong phòng
 */

/**
 * @openapi
 * /api/rooms/{id}/user-agents:
 *   post:
 *     summary: Gán Agent cá nhân vào phòng
 *     tags: [User-Agent Room]
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
 *               - agentId
 *             properties:
 *               userId:
 *                 type: string
 *               userName:
 *                 type: string
 *                 example: John
 *               userColor:
 *                 type: string
 *                 example: "#3b82f6"
 *               agentId:
 *                 type: string
 *                 example: agent_coder
 *               agentName:
 *                 type: string
 *                 example: AI Developer
 *     responses:
 *       200:
 *         description: Gán Agent thành công
 *       400:
 *         description: Thiếu dữ liệu hoặc vượt quá giới hạn số lượng Agent cho phép
 *
 * /api/rooms/{id}/user-agents/{agentId}:
 *   delete:
 *     summary: Hủy gán Agent cá nhân khỏi phòng
 *     tags: [User-Agent Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hủy gán Agent thành công
 *       404:
 *         description: Không tìm thấy phòng
 */