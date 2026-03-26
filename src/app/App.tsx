import { ReactFlowProvider } from '@xyflow/react';
import { Toolbar } from './components/Toolbar';
import { FlowCanvas } from './components/FlowCanvas';
import { Sidebar } from './components/Sidebar';
import { LeftSidebar } from './components/LeftSidebar';
import { useFlowStore } from './components/store';
import { useEffect, useRef } from 'react';

export default function App() {
  const saveToDb = useFlowStore((s) => s.saveToDb);
  const loadFromDb = useFlowStore((s) => s.loadFromDb);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const flows = useFlowStore((s) => s.flows);
  const activeFlowId = useFlowStore((s) => s.activeFlowId);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialized = useRef(false);

  // 앱 시작 시 데이터 로드
  useEffect(() => {
    loadFromDb().then(() => {
      isInitialized.current = true;
    });
  }, [loadFromDb]);

  // 변경 시 자동 저장 (1초 디바운스)
  useEffect(() => {
    if (!isInitialized.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveToDb().catch(() => {});
    }, 1000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [nodes, edges, flows, activeFlowId, saveToDb]);

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