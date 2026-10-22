/**
 * @openapi
 * tags:
 *   name: Agent-Agent Room
 *   description: Đồng bộ và quản lý các Agent chung đang kích hoạt trong phòng
 */

/**
 * @openapi
 * /api/rooms/{id}/agents:
 *   post:
 *     summary: Đồng bộ danh sách các Agent hoạt động trong phòng
 *     tags: [Agent-Agent Room]
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
 *               - activeAgents
 *             properties:
 *               activeAgents:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["agent_manager", "agent_ml", "agent_analyst"]
 *     responses:
 *       200:
 *         description: Đồng bộ danh sách Agent thành công
 *       400:
 *         description: activeAgents phải là một mảng
 *
 * /api/rooms/{id}/agents/{agentId}:
 *   post:
 *     summary: Thêm một Agent vào danh sách kích hoạt trong phòng
 *     tags: [Agent-Agent Room]
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
 *         description: Thêm Agent vào phòng thành công
 *       404:
 *         description: Không tìm thấy phòng
 *   delete:
 *     summary: Gỡ một Agent khỏi danh sách kích hoạt trong phòng
 *     tags: [Agent-Agent Room]
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
 *         description: Gỡ Agent khỏi phòng thành công
 *       404:
 *         description: Không tìm thấy phòng
 */