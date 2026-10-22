import { ChatMessage } from '@/lib/api'

export const MOCK_SCENARIO_MESSAGES: ChatMessage[] = [
    // ----------------------------------------------------
    // KỊCH BẢN 1: TAB THÀNH VIÊN (User - User)
    // ----------------------------------------------------
    {
        _id: 'm_1',
        roomId: 'room_test',
        senderId: 'user_1',
        senderName: 'Phong Luong',
        senderType: 'user',
        message: 'Mọi người ơi, kiểm tra giúp mình xem dữ liệu quý này đã update lên hệ thống chưa?',
        createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    },
    {
        _id: 'm_2',
        roomId: 'room_test',
        senderId: 'user_2',
        senderName: 'Thanh Tung',
        senderType: 'user',
        message: 'Mình vừa check rồi ông nhé, đồng bộ xong hết rồi đấy.',
        createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
        _id: 'm_3',
        roomId: 'room_test',
        senderId: 'system',
        senderName: 'System',
        senderType: 'system',
        message: 'Thanh Tung đã tải lên tệp đính kèm: report_q3.xlsx',
        createdAt: new Date(Date.now() - 1000 * 60 * 17).toISOString(),
    },

    // ----------------------------------------------------
    // KỊCH BẢN 2: TAB HỎI ĐÁP AGENT (User - Agent)
    // ----------------------------------------------------
    {
        _id: 'm_4',
        roomId: 'room_test',
        senderId: 'user_1',
        senderName: 'Phong Luong',
        senderType: 'user',
        message: '@agent_search Hãy tra cứu giúp tôi các quy định mới nhất về bảo mật API năm 2026.',
        createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
        _id: 'm_5',
        roomId: 'room_test',
        senderId: 'agent_search',
        senderName: 'Search Expert',
        senderType: 'agent',
        message: 'Dạ thưa anh Phong, em đã tra cứu xong. Các tiêu chuẩn bảo mật API mới nhất yêu cầu bắt buộc phải xác thực qua OAuth2 và mã hóa mTLS.',
        metadata: {
            usedTools: ['tavily_search', 'api_validator'],
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    },
    {
        _id: 'm_6',
        roomId: 'room_test',
        senderId: 'user_1',
        senderName: 'Phong Luong',
        senderType: 'user',
        message: '@agent_analyst Hãy phân tích số liệu từ file report_q3.xlsx vừa rồi.',
        createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    },
    {
        _id: 'm_7',
        roomId: 'room_test',
        senderId: 'agent_analyst',
        senderName: 'Data Analyst',
        senderType: 'agent',
        message: 'Đã hoàn tất phân tích. Doanh thu quý 3 tăng trưởng 18.5% so với quý trước, trong đó mảng microservices chiếm đa số.',
        metadata: {
            usedTools: ['pandas_read_excel', 'calculate_growth'],
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    },

    // ----------------------------------------------------
    // KỊCH BẢN 3: TAB AGENT TEAM PIPELINE (Agent - Agent)
    // ----------------------------------------------------
    {
        _id: 'm_8',
        roomId: 'room_test',
        senderId: 'agent_manager',
        senderName: 'Manager Agent',
        senderType: 'agent',
        message: '[Pipeline] Bắt đầu điều phối chuỗi tác vụ tự động: Thu thập dữ liệu $\rightarrow$ Phân tích $\rightarrow$ Tóm tắt.',
        metadata: {
            isAgentToAgent: true,
            workflowTrace: {
                id: 'trace_pipeline_01',
                name: 'Automated Team Workflow',
            } as any,
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    },
    {
        _id: 'm_9',
        roomId: 'room_test',
        senderId: 'agent_analyst',
        senderName: 'Data Analyst',
        senderType: 'agent',
        message: '[Pipeline Step 2] Đã nhận dữ liệu thô từ Manager, đang thực hiện tiền xử lý và chạy mô hình hồi quy.',
        metadata: {
            isAgentToAgent: true,
            usedTools: ['data_preprocessing', 'regression_model'],
            workflowTrace: {
                id: 'trace_pipeline_02',
                name: 'Analytics Sub-routine',
            } as any,
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    },
    {
        _id: 'm_10',
        roomId: 'room_test',
        senderId: 'agent_summarizer',
        senderName: 'Summarizer Agent',
        senderType: 'agent',
        message: '[Pipeline Step 3] Đã nhận kết quả từ Analyst. Đang biên soạn báo cáo tóm tắt cuối cùng cho toàn đội.',
        metadata: {
            isAgentToAgent: true,
            usedTools: ['markdown_formatter', 'email_dispatch'],
            workflowTrace: {
                id: 'trace_pipeline_03',
                name: 'Final Report Generation',
            } as any,
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    },
]