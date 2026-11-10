/**
 * Learned Knowledge & Experience Table Component.
 * Visualizes active Qdrant memories separated into Declarative Knowledge facts
 * and Procedural Experience lessons, with sorting and refresh controls.
 */

import { useState } from 'react';
import { BookOpen, Lightbulb, RefreshCw } from 'lucide-react';
import type { LearnedMemoryItem } from '../types';

interface LearnedKnowledgeTableProps {
  items: LearnedMemoryItem[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function LearnedKnowledgeTable({
  items,
  isLoading,
  error,
  onRefresh,
}: LearnedKnowledgeTableProps) {
  // Toggle between Declarative Knowledge and Procedural Experience
  const [activeTab, setActiveTab] = useState<'knowledge' | 'experience'>('knowledge');

  // Filter and sort items chronologically descending
  const knowledgeItems = items
    .filter((item) => item.kind === 'knowledge')
    .sort((a, b) => new Date(b.learned_at).getTime() - new Date(a.learned_at).getTime());

  const experienceItems = items
    .filter((item) => item.kind === 'experience')
    .sort((a, b) => new Date(b.learned_at).getTime() - new Date(a.learned_at).getTime());

  const displayedItems = activeTab === 'knowledge' ? knowledgeItems : experienceItems;

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-sky-400">Nội dung đã học</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Làm mới danh sách nội dung đã học"
          className="rounded-md p-1 text-slate-400 transition hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs chuyển đổi giữa Kiến thức và Kinh nghiệm */}
      <div className="mb-3 flex rounded-xl border border-slate-800 bg-slate-950 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('knowledge')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
            activeTab === 'knowledge'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Kiến thức</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              activeTab === 'knowledge'
                ? 'bg-sky-700 text-sky-100'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {knowledgeItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('experience')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
            activeTab === 'experience'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          <span>Kinh nghiệm</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              activeTab === 'experience'
                ? 'bg-amber-700 text-amber-100'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {experienceItems.length}
          </span>
        </button>
      </div>

      {error ? (
        <p role="alert" className="py-4 text-center text-xs text-rose-400">
          {error}
        </p>
      ) : isLoading && items.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          Đang tải nội dung đã học...
        </p>
      ) : displayedItems.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">
          {activeTab === 'knowledge'
            ? 'Chưa có tri thức thực tế nào trong knowledge_base.'
            : 'Chưa có bài học kinh nghiệm nào trong agent_experiences.'}
        </p>
      ) : (
        <div className="max-h-64 overflow-auto rounded-lg border border-slate-800">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="sticky top-0 bg-slate-950 text-slate-400">
              <tr>
                <th scope="col" className="w-1/3 px-3 py-2 font-medium">
                  {activeTab === 'knowledge' ? 'Chủ đề' : 'Dạng nhiệm vụ'}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {activeTab === 'knowledge' ? 'Tri thức ghi nhớ' : 'Bài học rút ra'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {displayedItems.map((item) => (
                <tr key={item.id} className="align-top text-slate-300">
                  <td className="break-words px-3 py-2">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        activeTab === 'knowledge'
                          ? 'border border-sky-800/60 bg-sky-950/60 text-sky-300'
                          : 'border border-amber-800/60 bg-amber-950/60 text-amber-300'
                      }`}
                    >
                      {item.category || 'Chưa phân loại'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-200">
                      {item.document}
                    </p>
                    {item.learned_at && (
                      <time
                        dateTime={item.learned_at}
                        className="mt-1 block text-[10px] text-slate-500"
                      >
                        {new Date(item.learned_at).toLocaleString()}
                      </time>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
