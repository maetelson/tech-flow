import { ReactFlowProvider } from '@xyflow/react';
import { Toolbar } from './components/Toolbar';
import { FlowCanvas } from './components/FlowCanvas';
import { Sidebar } from './components/Sidebar';
import { LeftSidebar } from './components/LeftSidebar';
import { useFlowStore } from './components/store';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

export default function App() {
  const saveToDb = useFlowStore((s) => s.saveToDb);
  const loadFromDb = useFlowStore((s) => s.loadFromDb);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const activeFlowId = useFlowStore((s) => s.activeFlowId);
  const setNodes = useFlowStore((s) => s.setNodes);
  const setEdges = useFlowStore((s) => s.setEdges);
  const isRemoteUpdating = useFlowStore((s) => s.isRemoteUpdating);
  const setIsRemoteUpdating = useFlowStore((s) => s.setIsRemoteUpdating);

  const socketRef = useRef<Socket | null>(null);

  // 앱 시작 시 데이터 로드
  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  // 실시간 소켓 연결 + 동기화
  useEffect(() => {
    const socket = io('https://tech-flow-jxfe.onrender.com');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Realtime connected to server:', socket.id);
      socket.emit('flow:get');
    });

    socket.on('flow:init', (flow) => {
      if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) return;
      setIsRemoteUpdating(true);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setIsRemoteUpdating(false);
    });

    socket.on('flow:update', (flow) => {
      if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) return;
      setIsRemoteUpdating(true);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setIsRemoteUpdating(false);
    });

    socket.on('disconnect', () => {
      console.log('Realtime disconnected');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [setNodes, setEdges, setIsRemoteUpdating]);

  // 로컬 변경 -> 서버로 푸시 (throttle)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected || isRemoteUpdating) return;

    const timeout = window.setTimeout(() => {
      socket.emit('flow:update', { id: activeFlowId, nodes, edges });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [activeFlowId, nodes, edges, isRemoteUpdating]);

  // Ctrl+S 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveToDb().catch(() => {
          // 에러 처리는 Toolbar에서 함
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveToDb]);

  return (
    <ReactFlowProvider>
      <div className="h-screen min-h-screen flex flex-col bg-gray-50">
        {/* 상단 툴바 */}
        <Toolbar />

        {/* 메인 영역: 좌측 사이드바 + 캔버스 + 우측 사이드바 */}
        <div className="flex flex-1 overflow-hidden relative">
          <LeftSidebar />
          <FlowCanvas />
          <Sidebar />
        </div>
      </div>
    </ReactFlowProvider>
  );
}