// 상단 툴바: 노드 추가, 모드 전환, 현재 모드 표시
import { useFlowStore } from './store';
import { Plus, MousePointer, Link, Undo2, Save, Download, Upload, DatabaseBackup } from 'lucide-react';
import { useState, useRef } from 'react';

export function Toolbar() {
  const mode = useFlowStore((s) => s.mode);
  const toggleMode = useFlowStore((s) => s.toggleMode);
  const addNode = useFlowStore((s) => s.addNode);
  const connectSource = useFlowStore((s) => s.connectSource);
  const setConnectSource = useFlowStore((s) => s.setConnectSource);
  const saveToDb = useFlowStore((s) => s.saveToDb);
  const isSaving = useFlowStore((s) => s.isSaving);
  const canvasRef = useFlowStore((s) => s.canvasRef);
  const exportAllFlows = useFlowStore((s) => s.exportAllFlows);
  
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2000);
  };

  const handleSave = async () => {
    try {
      await saveToDb();
      showToast('success', '저장 완료!');
    } catch (error) {
      showToast('error', '저장 실패');
    }
  };

  // 플로우 데이터를 JSON 파일로 백업
  const handleBackup = () => {
    const raw = localStorage.getItem('tech-flow:flows:v1');
    if (!raw) { showToast('error', '저장된 데이터 없음'); return; }
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tech-flow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', '백업 파일 다운로드!');
  };

  // JSON 파일을 불러와서 복원
  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        JSON.parse(text); // 유효성 검사
        localStorage.setItem('tech-flow:flows:v1', text);
        await useFlowStore.getState().loadFromDb();
        await useFlowStore.getState().saveToDb();
        showToast('success', '데이터 복원 완료!');
      } catch {
        showToast('error', '파일이 올바르지 않음');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportAllFlows(canvasRef);
      showToast('success', '내보내기 완료!');
    } catch (error) {
      showToast('error', '내보내기 실패');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
      {/* 로고 */}
      <span className="text-sm text-gray-800 mr-2">유저 플로우 에디터</span>

      <div className="w-px h-6 bg-gray-200" />

      {/* 노드 추가 */}
      <button
        onClick={() => {
          console.log('🔴 Node add button clicked');
          addNode();
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
      >
        <Plus size={14} />
        노드 추가
      </button>

      <div className="w-px h-6 bg-gray-200" />

      {/* 모드 전환 */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => mode !== 'select' && toggleMode()}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
            mode === 'select' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MousePointer size={13} />
          선택
        </button>
        <button
          onClick={() => mode !== 'connect' && toggleMode()}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
            mode === 'connect' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Link size={13} />
          연결
        </button>
      </div>

      {/* 현재 모드 표시 */}
      <span className="text-[11px] text-gray-400">
        현재 모드: <span className={mode === 'connect' ? 'text-orange-500' : 'text-blue-500'}>{mode === 'select' ? '선택' : '연결'}</span>
        <span className="ml-1 text-gray-300">(V키로 전환)</span>
      </span>

      {/* 연결 중 표시 및 취소 */}
      {connectSource && (
        <div className="flex items-center gap-1.5 ml-2 px-2 py-1 bg-orange-50 border border-orange-200 rounded text-[11px] text-orange-600">
          연결 시작점 선택됨
          <button
            onClick={() => setConnectSource(null)}
            className="hover:text-orange-800"
            title="연결 취소"
          >
            <Undo2 size={12} />
          </button>
        </div>
      )}

      {/* 저장 및 내보내기 버튼 */}
      <div className="ml-auto flex items-center gap-2">
        {/* 숨겨진 파일 인풋 */}
        <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleRestore} />

        <button
          onClick={handleBackup}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          title="플로우 데이터를 JSON 파일로 백업"
        >
          <DatabaseBackup size={14} />
          백업
        </button>

        <button
          onClick={() => importInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
          title="JSON 백업 파일에서 데이터 복원"
        >
          <Upload size={14} />
          복원
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          title="브라우저에 저장 (Ctrl+S)"
        >
          <Save size={14} />
          {isSaving ? '저장 중...' : '저장'}
        </button>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          title="모든 플로우를 이미지로 내보내기"
        >
          <Download size={14} />
          {isExporting ? '내보내는 중...' : '내보내기'}
        </button>
      </div>

      {/* 플로팅 토스트 */}
      {toast && (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-opacity duration-300"
          style={{
            backgroundColor: toast.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: toast.type === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
