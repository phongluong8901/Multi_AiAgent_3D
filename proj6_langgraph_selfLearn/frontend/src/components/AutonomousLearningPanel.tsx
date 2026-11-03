import { Sparkles } from 'lucide-react';

interface AutonomousLearningPanelProps {
  topic: string;
  isProcessing: boolean;
  onTopicChange: (value: string) => void;
  onLearn: () => void;
}

export default function AutonomousLearningPanel({
  topic,
  isProcessing,
  onTopicChange,
  onLearn,
}: AutonomousLearningPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-400">
        <Sparkles className="h-4 w-4" />
        AI tự nghiên cứu chủ đề mới
      </h2>
      <p className="mb-3 text-xs text-slate-400">
        Giao một chủ đề để AI tự tìm hiểu trên web và lưu vào Qdrant.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={topic}
          onChange={(event) => onTopicChange(event.target.value)}
          placeholder="Ví dụ: Tính năng mới của Go 1.24..."
          className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={onLearn}
          disabled={isProcessing || !topic.trim()}
          className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          Tự học ngay
        </button>
      </div>
    </section>
  );
}
