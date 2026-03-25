// 커스텀 노드 컴포넌트: 방향별 + 버튼, 핸들, 카테고리 색상
import React, { useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { useFlowStore, type FlowNodeData, type NodeCategory } from './store';

const CATEGORY_COLORS: Record<NodeCategory, { bg: string; border: string; badge: string }> = {
  'user input': { bg: 'bg-blue-50', border: 'border-blue-400', badge: 'bg-blue-100 text-blue-700' },
  frontend: { bg: 'bg-green-50', border: 'border-green-400', badge: 'bg-green-100 text-green-700' },
  backend: { bg: 'bg-purple-50', border: 'border-purple-400', badge: 'bg-purple-100 text-purple-700' },
  ai: { bg: 'bg-amber-50', border: 'border-amber-400', badge: 'bg-amber-100 text-amber-700' },
  database: { bg: 'bg-red-50', border: 'border-red-400', badge: 'bg-red-100 text-red-700' },
  'external api': { bg: 'bg-cyan-50', border: 'border-cyan-400', badge: 'bg-cyan-100 text-cyan-700' },
  generic: { bg: 'bg-gray-50', border: 'border-gray-400', badge: 'bg-gray-100 text-gray-700' },
};

const DIRECTIONS = [
  { dir: 'top' as const, pos: Position.Top, btnStyle: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2', hitStyle: 'top-[-8px] left-1/2 -translate-x-1/2' },
  { dir: 'bottom' as const, pos: Position.Bottom, btnStyle: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', hitStyle: 'bottom-[-8px] left-1/2 -translate-x-1/2' },
  { dir: 'left' as const, pos: Position.Left, btnStyle: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2', hitStyle: 'left-[-8px] top-1/2 -translate-y-1/2' },
  { dir: 'right' as const, pos: Position.Right, btnStyle: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2', hitStyle: 'right-[-8px] top-1/2 -translate-y-1/2' },
] as const;

export function FlowNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const [hovered, setHovered] = useState(false);
  const mode = useFlowStore((s) => s.mode);
  const addNodeInDirection = useFlowStore((s) => s.addNodeInDirection);
  const setSelection = useFlowStore((s) => s.setSelection);
  const setSidebarOpen = useFlowStore((s) => s.setSidebarOpen);
  const connectSource = useFlowStore((s) => s.connectSource);
  const setConnectSource = useFlowStore((s) => s.setConnectSource);
  const updateEdges = useFlowStore((s) => s.updateEdges);

  const colors = CATEGORY_COLORS[nodeData.category] || CATEGORY_COLORS.generic;

  const handleNodeClick = useCallback(
    (e: React.MouseEvent) => {
      setSelection({ kind: 'node', id });
      setSidebarOpen(true);
    },
    [id, setSelection, setSidebarOpen]
  );

  // 연결 모드: 핸들 클릭 처리
  const handleConnectClick = useCallback(
    (handleId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const source = connectSource;
      if (!source) {
        // 첫 번째 클릭: source handle로 기록
        setConnectSource({ nodeId: id, handleId: `${handleId}-source` });
        setSelection({ kind: 'node', id });
        setSidebarOpen(true);
      } else {
        if (source.nodeId !== id) {
          const edgeId = `edge-${source.nodeId}-${id}-${Date.now()}`;
          updateEdges((prev) => [
            ...prev,
            {
              id: edgeId,
              source: source.nodeId,
              target: id,
              sourceHandle: source.handleId,
              targetHandle: `${handleId}-target`,
              type: 'flowEdge',
              data: { labelShort: '', description: '', json: '' },
            },
          ]);
          setSelection({ kind: 'edge', id: edgeId });
          setSidebarOpen(true);
        }
        setConnectSource(null);
      }
    },
    [connectSource, id, setConnectSource, updateEdges, setSelection, setSidebarOpen]
  );

  const isConnectSourceNode = connectSource?.nodeId === id;

  return (
    <div
      className={`relative group ${colors.bg} ${colors.border} border-2 rounded-xl px-4 pt-2.5 pb-3.5 min-w-[160px] max-w-[220px] shadow-sm transition-shadow ${
        selected ? 'shadow-lg ring-2 ring-blue-500' : ''
      } ${isConnectSourceNode ? 'ring-2 ring-orange-400' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleNodeClick}
    >
      {/* 카테고리 뱃지 */}
      <div className={`text-[10px] px-1.5 py-0.5 rounded-full ${colors.badge} mb-2 inline-block`}>
        {nodeData.category}
      </div>

      {/* 제목 */}
      <div className="text-sm text-gray-900 truncate">{nodeData.title}</div>

      {/* 4방향 핸들: source + target 모두 배치 */}
      {DIRECTIONS.map(({ dir, pos, btnStyle, hitStyle }) => {
        const isActiveHandle = connectSource?.nodeId === id && connectSource?.handleId === `${dir}-source`;

        return (
          <React.Fragment key={dir}>
            {/* Source Handle */}
            <Handle
              type="source"
              position={pos}
              id={`${dir}-source`}
              isConnectable={mode !== 'connect'}
              className={`!w-3 !h-3 !border-2 transition-all ${
                mode === 'connect'
                  ? `!border-orange-400 ${isActiveHandle ? '!bg-orange-500 !border-orange-600' : '!bg-orange-200'} cursor-crosshair`
                  : '!border-gray-400 !bg-white'
              }`}
              style={{ pointerEvents: mode === 'connect' ? 'none' : 'auto' }}
            />

            {/* Target Handle (같은 위치, 투명하게 겹침) */}
            <Handle
              type="target"
              position={pos}
              id={`${dir}-target`}
              isConnectable={mode !== 'connect'}
              className="!w-3 !h-3 !bg-transparent !border-none"
              style={{ pointerEvents: mode === 'connect' ? 'none' : 'auto' }}
            />

            {/* 연결 모드: 핸들 위 클릭 오버레이 */}
            {mode === 'connect' && (
              <div
                className={`absolute ${hitStyle} w-6 h-6 z-20 rounded-full cursor-crosshair`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleConnectClick(dir, e);
                }}
              />
            )}

            {/* 선택 모드: 방향별 + 버튼 */}
            {mode === 'select' && hovered && (
              <button
                className={`absolute ${btnStyle} z-10 w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md transition-opacity`}
                onClick={(e) => {
                  e.stopPropagation();
                  addNodeInDirection(id, dir);
                }}
                title={`${dir} 방향에 노드 추가`}
              >
                <Plus size={12} />
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}