// 커스텀 엣지 컴포넌트: 클릭 가능한 라벨 + 화살표
import { type EdgeProps, getBezierPath, BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import { useFlowStore, type FlowEdgeData } from './store';

export function FlowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as unknown as FlowEdgeData | undefined;
  const setSelection = useFlowStore((s) => s.setSelection);
  const setSidebarOpen = useFlowStore((s) => s.setSidebarOpen);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const labelShort = edgeData?.labelShort || '';
  const displayLabel = labelShort.length > 10 ? labelShort.slice(0, 10) + '…' : labelShort;

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelection({ kind: 'edge', id });
    setSidebarOpen(true);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? '#3b82f6' : '#94a3b8',
          strokeWidth: selected ? 2.5 : 1.5,
        }}
        markerEnd={selected ? 'url(#arrow-selected)' : 'url(#arrow)'}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors border ${
            selected
              ? 'bg-blue-100 border-blue-400 text-blue-800'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
          onClick={handleLabelClick}
        >
          {displayLabel || (
            <span className="text-gray-400 italic">설명 추가</span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}