import { useEffect, useRef, type FormEvent } from 'react';
import { Globe, Send, Sparkles } from 'lucide-react';
import AppHeader from './AppHeader';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  isProcessing: boolean;
  status: string;
  sessionId: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNewSession: () => void;
}

export default function ChatPanel({
  messages,
  input,
  isProcessing,
  status,
  sessionId,
  onInputChange,
  onSubmit,
  onNewSession,
}: ChatPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
      <AppHeader
        status={status}
        sessionId={sessionId}
        onNewSession={onNewSession}
      />

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

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${
              message.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-2xl whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                message.role === 'user'
                  ? 'rounded-br-none bg-emerald-600 text-white'
                  : message.role === 'system'
                    ? 'border border-indigo-700/60 bg-indigo-950/80 text-indigo-200'
                    : 'rounded-bl-none border border-slate-700 bg-slate-800 text-slate-100'
              }`}
            >
              {message.usedWebSearch && (
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-sky-400">
                  <Globe className="h-3.5 w-3.5" />
                  Đã tự động tìm kiếm Internet và nạp vào bộ nhớ
                </div>
              )}
              {message.content}
            </div>
            <span className="mt-1 px-1 text-[10px] text-slate-500">
              {message.timestamp}
            </span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="flex gap-3 border-t border-slate-800 bg-slate-900 p-4"
      >
        <input
          type="text"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          disabled={isProcessing}
          placeholder="Nhập câu hỏi hoặc dạy kiến thức mới cho AI..."
          className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isProcessing || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium transition hover:bg-emerald-500 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Gửi
        </button>
      </form>
    </section>
  );
}
