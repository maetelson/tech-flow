// 좌측 사이드바: 플로우 목록 (피그마 레이어 패널 스타일)
import { useState, useRef, useEffect } from 'react';
import { useFlowStore } from './store';
import { Plus, Trash2, ChevronLeft, ChevronRight, GitBranch } from 'lucide-react';

export function LeftSidebar() {
  const flows = useFlowStore((s) => s.flows);
  const activeFlowId = useFlowStore((s) => s.activeFlowId);
  const addFlow = useFlowStore((s) => s.addFlow);
  const deleteFlow = useFlowStore((s) => s.deleteFlow);
  const renameFlow = useFlowStore((s) => s.renameFlow);
  const switchFlow = useFlowStore((s) => s.switchFlow);
  const open = useFlowStore((s) => s.leftSidebarOpen);
  const setOpen = useFlowStore((s) => s.setLeftSidebarOpen);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      renameFlow(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  // 접힌 상태 - 열기 버튼만 표시
  if (!open) {
    return (
      <div className="w-auto h-full flex items-start justify-start pt-3 pl-3 relative">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          title="플로우 패널 열기"
        >
          <ChevronRight size={16} className="text-gray-500" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-52 border-r border-gray-200 bg-white flex flex-col shrink-0 select-none">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider">Flows</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={addFlow}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            title="새 플로우 추가"
          >
            <Plus size={14} className="text-gray-500" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            title="패널 닫기"
          >
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* 플로우 목록 */}
      <div className="flex-1 overflow-y-auto py-1">
        {flows.map((flow) => {
          const isActive = flow.id === activeFlowId;
          const isEditing = editingId === flow.id;

          return (
            <div
              key={flow.id}
              className={`group flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md cursor-pointer transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => !isEditing && switchFlow(flow.id)}
              onDoubleClick={() => startRename(flow.id, flow.name)}
            >
              <GitBranch
                size={13}
                className={`shrink-0 ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
              />

              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 min-w-0 text-xs bg-white border border-blue-300 rounded px-1 py-0.5 outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 min-w-0 text-xs truncate">{flow.name}</span>
              )}

              {/* 노드 수 뱃지 */}
              <span className={`text-[10px] shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-300'}`}>
                {flow.id === activeFlowId
                  ? useFlowStore.getState().nodes.length
                  : flow.nodes.length}
              </span>

              {/* 삭제 버튼 - hover 시 표시, 최소 1개일 때 비활성 */}
              {flows.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFlow(flow.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 transition-all shrink-0"
                  title="플로우 삭제"
                >
                  <Trash2 size={11} className="text-red-400" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
