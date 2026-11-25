/**
 * Autonomous Learning Panel Component.
 * Enables the user to direct the AI agent to independently research a specific topic,
 * browse web documents, digest findings, and store distilled facts into Qdrant memory.
 */

import { CheckCircle2, FileText, Sparkles, Shuffle, X } from 'lucide-react';

/**
 * Result model representing the completed autonomous research summary.
 */
export interface AutonomousLearningResult {
  topic: string;
  summary: string;
  timestamp: string;
}

interface AutonomousLearningPanelProps {
  topic: string;
  isProcessing: boolean;
  latestResult?: AutonomousLearningResult | null;
  onTopicChange: (value: string) => void;
  onLearn: () => void;
  onDismissResult?: () => void;
}

/**
 * Categorized topic presets across technology, economics, business, strategy, and science.
 */
const TOPIC_PRESETS = [
  {
    category: 'IT / Tech',
    topics: [
      'Kiến trúc Zero-Copy Buffer và Event-Driven trong gRPC',
      'Tối ưu hóa chỉ mục HNSW trong Qdrant Vector Database',
      'Tính năng nổi bật của Python 3.13 không GIL (Free-threaded)',
      'Kỹ thuật phân bổ bộ nhớ Page-Locked trên GPU cho AI Inference',
      'Mô hình DeepSeek MoE và cách tối ưu VRAM',
    ],
  },
  {
    category: 'Kinh tế',
    topics: [
      'Tác động của chu kỳ điều chỉnh lãi suất FED tới kinh tế toàn cầu',
      'Cơ chế kiểm soát lạm phát và chính sách tiền tệ nới lỏng',
      'Tác động của thuế quan bảo hộ thương mại tới chuỗi cung ứng bán dẫn',
      'Xu hướng thanh toán song phương và tiền tệ kỹ thuật số ngân hàng trung ương (CBDC)',
    ],
  },
  {
    category: 'Kinh doanh',
    topics: [
      'Chiến lược tăng trưởng Product-Led Growth (PLG) cho SaaS B2B',
      'Mô hình Unit Economics và tối ưu tỷ lệ LTV trên CAC',
      'Chiến lược xây dựng rào cản cạnh tranh (Economic Moat) thời đại AI',
      'Tối ưu hóa vận hành chuỗi cung ứng tinh gọn (Lean Logistics)',
    ],
  },
  {
    category: 'Chiến tranh / Chiến lược',
    topics: [
      'Vai trò của tác chiến điện tử và UAV tự hành trong chiến sự hiện đại',
      'Nghệ thuật hậu cần quân sự và bài học từ Chiến dịch Normandy',
      'Địa chính trị và an ninh các eo biển hàng hải huyết mạch toàn cầu',
      'Chiến lược phòng ngự chiều sâu và kiểm soát không phận',
    ],
  },
  {
    category: 'Khoa học',
    topics: [
      'Đột phá trong công nghệ pin thể rắn và lưu trữ năng lượng tái tạo',
      'Cơ chế hoạt động của bộ xử lý lượng tử siêu dẫn',
      'Ứng dụng AI Transformer trong giải mã cấu trúc Protein',
      'Cơ chế đồng hóa tri thức và tái cấu trúc liên kết nơ-ron trong não bộ',
    ],
  },
];

export default function AutonomousLearningPanel({
  topic,
  isProcessing,
  latestResult,
  onTopicChange,
  onLearn,
  onDismissResult,
}: AutonomousLearningPanelProps) {
  /**
   * Selects a random topic across all preset categories.
   */
  const handleRandomAny = () => {
    const all = TOPIC_PRESETS.flatMap((p) => p.topics);
    const pick = all[Math.floor(Math.random() * all.length)];
    onTopicChange(pick);
  };

  /**
   * Selects a random topic within a specific chosen category.
   */
  const handlePickCategory = (category: string) => {
    const group = TOPIC_PRESETS.find((p) => p.category === category);
    if (group) {
      const pick = group.topics[Math.floor(Math.random() * group.topics.length)];
      onTopicChange(pick);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-indigo-400">
          <Sparkles className="h-4 w-4" />
          AI tự nghiên cứu chủ đề mới
        </h2>

        <button
          onClick={handleRandomAny}
          type="button"
          title="Chọn ngẫu nhiên một chủ đề bất kỳ từ đa lĩnh vực"
          className="flex items-center gap-1 rounded bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition"
        >
          <Shuffle className="h-3 w-3" />
          Random ngẫu nhiên
        </button>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Giao một chủ đề độc lập để AI tự thu thập tài liệu trên web, phân tích và nạp dữ kiện vào Qdrant.
      </p>

      {/* Quick Category Chips */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <span className="text-[10px] text-slate-500 self-center mr-0.5">Chọn nhanh:</span>
        {TOPIC_PRESETS.map((preset) => (
          <button
            key={preset.category}
            type="button"
            onClick={() => handlePickCategory(preset.category)}
            className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300 border border-slate-700/60 hover:bg-indigo-600/40 hover:text-indigo-200 transition"
          >
            {preset.category}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={topic}
          onChange={(event) => onTopicChange(event.target.value)}
          placeholder="Nhập chủ đề hoặc bấm chọn nhanh phía trên..."
          className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={onLearn}
          disabled={isProcessing || !topic.trim()}
          className="whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
        >
          Tự học ngay
        </button>
      </div>

      {/* Render independent research summary when available */}
      {latestResult && (
        <div className="mt-1 rounded-xl border border-indigo-900/60 bg-indigo-950/40 p-3 text-xs">
          <div className="mb-2 flex items-center justify-between border-b border-indigo-900/50 pb-2">
            <div className="flex items-center gap-1.5 text-indigo-300 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Đã hoàn tất nghiên cứu</span>
            </div>
            {onDismissResult && (
              <button
                type="button"
                onClick={onDismissResult}
                className="rounded p-0.5 text-slate-400 hover:text-white"
                aria-label="Đóng kết quả nghiên cứu"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200 truncate max-w-[200px]">
              Chủ đề: {latestResult.topic}
            </span>
            <span className="text-[10px] text-slate-500">{latestResult.timestamp}</span>
          </div>

          <div className="max-h-36 overflow-y-auto rounded bg-slate-950/80 p-2.5 text-slate-300 leading-relaxed font-sans border border-slate-800/80 text-[11px] whitespace-pre-wrap">
            {latestResult.summary}
          </div>

          <p className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Đã tự động trích xuất tri thức vào bộ nhớ Qdrant
          </p>
        </div>
      )}
    </section>
  );
}
