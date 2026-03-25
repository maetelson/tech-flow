import { ReactFlowProvider } from '@xyflow/react';
import { Toolbar } from './components/Toolbar';
import { FlowCanvas } from './components/FlowCanvas';
import { Sidebar } from './components/Sidebar';
import { LeftSidebar } from './components/LeftSidebar';
import { useFlowStore } from './components/store';
import { useEffect } from 'react';

export default function App() {
  const saveToDb = useFlowStore((s) => s.saveToDb);
  const loadFromDb = useFlowStore((s) => s.loadFromDb);

  // 앱 시작 시 데이터 로드
  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

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