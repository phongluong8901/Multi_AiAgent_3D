import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import AppHeader from './components/AppHeader';
import AutonomousLearningPanel, {
  type AutonomousLearningResult,
} from './components/AutonomousLearningPanel';
import ChatPanel from './components/ChatPanel';
import LearnedKnowledgeTable from './components/LearnedKnowledgeTable';
import MemoryStatsPanel from './components/MemoryStatsPanel';
import ReasoningTracePanel from './components/ReasoningTracePanel';
import KnowledgeSynthesisPage from './components/KnowledgeSynthesisPage';
import type {
  AICoreChatResponse,
  ChatMessage,
  LearnedMemoryItem,
  MemoryStats,
} from './types';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'synthesis'>('chat');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionId, setSessionId] = useState<string>('session_phong_01');
  const [input, setInput] = useState<string>('');
  const [learnTopic, setLearnTopic] = useState<string>('');
  const [status, setStatus] = useState<string>('Sẵn sàng');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traces, setTraces] = useState<string[]>([]);
  const [learnedItems, setLearnedItems] = useState<LearnedMemoryItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [latestAutonomousResult, setLatestAutonomousResult] =
    useState<AutonomousLearningResult | null>(null);
  const [stats, setStats] = useState<MemoryStats>({
    total_knowledge_facts: 0,
    total_experiences: 0,
  });

  const fetchMemoryStats = async () => {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/memory-stats`);
      const data: MemoryStats = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchLearnedItems = async () => {
    setIsLoadingItems(true);
    setItemsError(null);
    try {
      const response = await fetch(`${GATEWAY_URL}/api/memory-items?limit=100`);
      if (!response.ok) {
        throw new Error(`Failed to fetch learned items (${response.status})`);
      }
      const data: { items: LearnedMemoryItem[] } = await response.json();
      setLearnedItems(data.items);
    } catch (error) {
      console.error('Failed to fetch learned items:', error);
      setItemsError('Không thể tải danh sách nội dung đã học.');
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchMemoryStats();
    fetchLearnedItems();
    const newSocket = io(GATEWAY_URL);
    setSocket(newSocket);

    newSocket.on('agent_status', (data: { status: string }) => {
      setStatus(data.status);
    });

    newSocket.on('agent_response', (data: AICoreChatResponse) => {
      setIsProcessing(false);
      setStatus('Đang tiêu hóa tri thức vào Qdrant...');
      setMessages((previous) => [
        ...previous,
        {
          id: Date.now().toString(),
          role: 'ai',
          content: data.answer,
          usedWebSearch: data.used_web_search,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setTraces(data.reasoning_trace);
    });

    // Cập nhật realtime từ Socket.IO ngay khi Qdrant có thay đổi
    newSocket.on('memory_updated', (data: { stats: MemoryStats; items: LearnedMemoryItem[] }) => {
      setStats(data.stats);
      setLearnedItems(data.items);
      setStatus('Bộ nhớ Qdrant & danh sách tri thức đã được cập nhật realtime!');
    });

    // Tách riêng luồng Tự học chủ động: Không in vào khung chat mà lưu vào panel bên phải
    newSocket.on('autonomous_learned', (data: { topic: string; summary: string }) => {
      setIsProcessing(false);
      setLatestAutonomousResult({
        topic: data.topic,
        summary: data.summary,
        timestamp: new Date().toLocaleTimeString(),
      });
      setStatus(`Đã tự học xong chủ đề: "${data.topic}"!`);
    });

    newSocket.on('agent_error', (data: { error: string }) => {
      setIsProcessing(false);
      setStatus(`Lỗi: ${data.error}`);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleSendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || !socket || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setIsProcessing(true);
    socket.emit('user_message', { sessionId, message: userMessage.content });
    setInput('');
  };

  const handleTriggerAutonomousLearn = () => {
    if (!learnTopic.trim() || !socket || isProcessing) return;
    setIsProcessing(true);
    socket.emit('trigger_learn_now', { topic: learnTopic.trim() });
    setLearnTopic('');
  };

  const handleNewSession = () => {
    const newId = `session_${Math.random().toString(36).substring(2, 7)}`;
    setSessionId(newId);
    setMessages([]);
    setTraces([
      `Đã đổi sang phiên mới (${newId}) - Bộ nhớ ngắn hạn Redis trống, nhưng bộ nhớ dài hạn Qdrant vẫn còn nguyên.`,
    ]);
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* Top Application Navbar */}
      <AppHeader
        status={status}
        sessionId={sessionId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewSession={handleNewSession}
      />

      {/* Main Content Area based on Active Tab */}
      {activeTab === 'chat' ? (
        <main className="flex flex-1 gap-4 overflow-hidden p-4">
          <ChatPanel
            messages={messages}
            input={input}
            isProcessing={isProcessing}
            onInputChange={setInput}
            onSubmit={handleSendMessage}
          />

          <aside className="flex w-96 shrink-0 flex-col gap-4 overflow-y-auto">
            <MemoryStatsPanel stats={stats} onRefresh={fetchMemoryStats} />
            <LearnedKnowledgeTable
              items={learnedItems}
              isLoading={isLoadingItems}
              error={itemsError}
              onRefresh={fetchLearnedItems}
            />
            <AutonomousLearningPanel
              topic={learnTopic}
              isProcessing={isProcessing}
              latestResult={latestAutonomousResult}
              onTopicChange={setLearnTopic}
              onLearn={handleTriggerAutonomousLearn}
              onDismissResult={() => setLatestAutonomousResult(null)}
            />
            <ReasoningTracePanel traces={traces} />
          </aside>
        </main>
      ) : (
        <main className="flex flex-1 overflow-hidden">
          <KnowledgeSynthesisPage gatewayUrl={GATEWAY_URL} />
        </main>
      )}
    </div>
  );
}
