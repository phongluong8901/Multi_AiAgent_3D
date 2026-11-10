/**
 * Root Application Component.
 * Coordinates WebSocket communication with the Gateway Service, manages session state,
 * synchronizes real-time memory events, and switches between Interactive Chat and Deep Knowledge Synthesis views.
 */

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

/**
 * Main application dashboard rendering navigation, chat/synthesis tabs,
 * and cognitive memory metrics panels.
 */
export default function App() {
  // Navigation active tab: interactive chat vs deep knowledge synthesis
  const [activeTab, setActiveTab] = useState<'chat' | 'synthesis'>('chat');
  
  // Real-time Socket.IO client instance
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Session tracking and input state
  const [sessionId, setSessionId] = useState<string>('session_phong_01');
  const [input, setInput] = useState<string>('');
  const [learnTopic, setLearnTopic] = useState<string>('');
  
  // Operational and UI status tracking
  const [status, setStatus] = useState<string>('Sẵn sàng');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Conversation and cognitive trace collections
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traces, setTraces] = useState<string[]>([]);
  
  // Stored knowledge memory feed
  const [learnedItems, setLearnedItems] = useState<LearnedMemoryItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  
  // Result state for autonomous learning triggered from UI
  const [latestAutonomousResult, setLatestAutonomousResult] =
    useState<AutonomousLearningResult | null>(null);
    
  // Memory volume statistics
  const [stats, setStats] = useState<MemoryStats>({
    total_knowledge_facts: 0,
    total_experiences: 0,
  });

  /**
   * Fetches the latest memory counts from Gateway REST API.
   */
  const fetchMemoryStats = async () => {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/memory-stats`);
      const data: MemoryStats = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  /**
   * Fetches stored memory items (knowledge and experiences) from Gateway REST API.
   */
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

  /**
   * Establishes Socket.IO event listeners for real-time memory and chat updates.
   */
  useEffect(() => {
    fetchMemoryStats();
    fetchLearnedItems();
    const newSocket = io(GATEWAY_URL);
    setSocket(newSocket);

    // Agent status notification event
    newSocket.on('agent_status', (data: { status: string }) => {
      setStatus(data.status);
    });

    // Final agent chat response event
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

    // Real-time memory update event broadcasted from Gateway
    newSocket.on('memory_updated', (data: { stats: MemoryStats; items: LearnedMemoryItem[] }) => {
      setStats(data.stats);
      setLearnedItems(data.items);
      setStatus('Bộ nhớ Qdrant & danh sách tri thức đã được cập nhật realtime!');
    });

    // Dedicated autonomous learning completion event
    newSocket.on('autonomous_learned', (data: { topic: string; summary: string }) => {
      setIsProcessing(false);
      setLatestAutonomousResult({
        topic: data.topic,
        summary: data.summary,
        timestamp: new Date().toLocaleTimeString(),
      });
      setStatus(`Đã tự học xong chủ đề: "${data.topic}"!`);
    });

    // Error handler event
    newSocket.on('agent_error', (data: { error: string }) => {
      setIsProcessing(false);
      setStatus(`Lỗi: ${data.error}`);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  /**
   * Submits user message to the Gateway via Socket.IO.
   */
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

  /**
   * Manually triggers immediate autonomous learning for a specific topic.
   */
  const handleTriggerAutonomousLearn = () => {
    if (!learnTopic.trim() || !socket || isProcessing) return;
    setIsProcessing(true);
    socket.emit('trigger_learn_now', { topic: learnTopic.trim() });
    setLearnTopic('');
  };

  /**
   * Generates a fresh session ID, clearing short-term chat feed while preserving long-term memory.
   */
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
