import { useEffect, useRef, type FormEvent } from 'react';
import { Globe, Send, Sparkles, MessageSquare } from 'lucide-react';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  isProcessing: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function ChatPanel({
  messages,
  input,
  isProcessing,
  onInputChange,
  onSubmit,
}: ChatPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white">Khung Trò chuyện & Truy xuất Tri thức</span>
        </div>
        <span className="text-[11px] text-slate-400">Tự động kết hợp Redis + Qdrant Long-Term Memory</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length === 0 && (
          <div className="mt-20 space-y-2 text-center text-slate-500">
            <Sparkles className="mx-auto h-10 w-10 text-slate-600" />
            <p className="text-sm">
              Hãy hỏi một sự kiện mới hoặc dạy cho AI một kiến thức riêng của bạn.
            </p>
            <p className="text-xs text-slate-600">
              Tạo session mới để kiểm tra AI có thể lấy kiến thức từ Qdrant hay không.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-none'
                  : 'bg-slate-800/90 text-slate-200 rounded-bl-none border border-slate-700/60'
                }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {msg.usedWebSearch && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-300">
                  <Globe className="h-3 w-3" />
                  <span>Đã tra cứu dữ liệu thời gian thực từ Web</span>
                </div>
              )}
            </div>
            <span className="mt-1 text-[10px] text-slate-500">{msg.timestamp}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 border-t border-slate-800 bg-slate-900/80 p-4"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Nhập tin nhắn để trò chuyện hoặc dạy kiến thức mới..."
          disabled={isProcessing}
          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isProcessing || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Gửi
        </button>
      </form>
    </section>
  );
}
