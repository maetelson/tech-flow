// React Flow 캔버스: 노드/엣지 렌더링, 줌, 단축키
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useFlowStore } from './store';
import { FlowNodeComponent } from './FlowNodeComponent';
import { FlowEdgeComponent } from './FlowEdgeComponent';

const nodeTypes = { flowNode: FlowNodeComponent };
const edgeTypes = { flowEdge: FlowEdgeComponent };

export function FlowCanvas() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const setNodes = useFlowStore((s) => s.setNodes);
  const setEdges = useFlowStore((s) => s.setEdges);
  
  console.log('📦 FlowCanvas rendered with nodes:', nodes.length);
  
  const mode = useFlowStore((s) => s.mode);
  const toggleMode = useFlowStore((s) => s.toggleMode);
  const setSelection = useFlowStore((s) => s.setSelection);
  const setSidebarOpen = useFlowStore((s) => s.setSidebarOpen);
  const updateEdges = useFlowStore((s) => s.updateEdges);
  const setConnectSource = useFlowStore((s) => s.setConnectSource);
  const setCanvasRef = useFlowStore((s) => s.setCanvasRef);
  const setGetViewportCenter = useFlowStore((s) => s.setGetViewportCenter);

  // 노드 변경 핸들러 (드래그 이동 등)
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      console.log('📍 onNodesChange called with changes:', changes);
      const latestNodes = useFlowStore.getState().nodes;
      const updatedNodes = applyNodeChanges(changes, latestNodes) as any;
      console.log('📍 Setting nodes, count:', updatedNodes.length);
      setNodes(updatedNodes);
    },
    [setNodes]
  );

  // 엣지 변경 핸들러
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const latestEdges = useFlowStore.getState().edges;
      setEdges(applyEdgeChanges(changes, latestEdges) as any);
    },
    [setEdges]
  );

  // React Flow 기본 연결 (드래그 연결)
  const onConnect: OnConnect = useCallback(
    (connection) => {
      const edgeId = `edge-${connection.source}-${connection.target}-${Date.now()}`;
      updateEdges((prev) => [
        ...prev,
        {
          id: edgeId,
          source: connection.source!,
          target: connection.target!,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          type: 'flowEdge',
          data: { labelShort: '', description: '', json: '' },
        },
      ]);
    },
    [updateEdges]
  );

  // 캔버스 빈 공간 클릭 시 선택 해제 + 연결 취소
  const onPaneClick = useCallback(() => {
    setSelection(null);
    setConnectSource(null);
  }, [setSelection, setConnectSource]);

  // 엣지 클릭
  const onEdgeClick = useCallback(
    (_: any, edge: any) => {
      setSelection({ kind: 'edge', id: edge.id });
      setSidebarOpen(true);
    },
    [setSelection, setSidebarOpen]
  );

  // 단축키: V로 모드 전환
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 텍스트 입력 중이면 무시
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        toggleMode();
      }

      // Ctrl+Z / Cmd+Z → Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useFlowStore.getState().undo();
      }

      // Delete / Backspace → 선택 삭제
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useFlowStore.getState();
        const selection = state.selection;
        if (selection?.kind === 'node') {
          e.preventDefault();
          state.deleteNode(selection.id);
          state.setSelection(null);
          state.setSidebarOpen(false);
        }
        if (selection?.kind === 'edge') {
          e.preventDefault();
          state.deleteEdge(selection.id);
          state.setSelection(null);
          state.setSidebarOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleMode]);

  // containerRef를 store에 저장
  useEffect(() => {
    if (containerRef.current) {
      setCanvasRef(containerRef.current);
    }
    return () => setCanvasRef(null);
  }, [setCanvasRef]);

  // 기본 엣지 옵션
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'flowEdge',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
    }),
    []
  );

  // 피그마 수준의 빠른 줌: 기본 React Flow 줌을 끄고 직접 처리
  const { getViewport, setViewport } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  // 뷰포트 중심 좌표 → 플로우 좌표 변환 콜백을 store에 등록
  useEffect(() => {
    const fn = () => {
      const el = containerRef.current;
      const vp = getViewport();
      const w = el ? el.clientWidth : window.innerWidth;
      const h = el ? el.clientHeight : window.innerHeight;
      return {
        x: (w / 2 - vp.x) / vp.zoom,
        y: (h / 2 - vp.y) / vp.zoom,
      };
    };
    setGetViewportCenter(fn);
    return () => setGetViewportCenter(null);
  }, [getViewport, setGetViewportCenter]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ZOOM_SPEED = 0.008; // 피그마 비슷한 감도 (기본 대비 ~3배)
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 4;

    const handleWheel = (e: WheelEvent) => {
      // Ctrl+wheel 또는 pinch(trackpad) → 줌
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const vp = getViewport();
        const rect = el.getBoundingClientRect();
        // 마우스 위치 (뷰포트 내 좌표)
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;

        const delta = -e.deltaY * ZOOM_SPEED;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * (1 + delta)));
        const ratio = newZoom / vp.zoom;

        setViewport({
          x: pointerX - (pointerX - vp.x) * ratio,
          y: pointerY - (pointerY - vp.y) * ratio,
          zoom: newZoom,
        });
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [getViewport, setViewport]);

  return (
    <div ref={containerRef} className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        panOnDrag={mode === 'select'}
        nodesDraggable={mode === 'select'}
        connectOnClick={false}
        minZoom={0.1}
        maxZoom={4}
        zoomOnScroll={false}
        zoomOnPinch={false}
        panOnScroll={false}
        className={mode === 'connect' ? 'cursor-crosshair' : ''}
      >
        {/* 화살표 마커 정의 */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="10"
              markerHeight="10"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
            <marker
              id="arrow-selected"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="10"
              markerHeight="10"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
            </marker>
          </defs>
        </svg>
        <Background gap={20} size={1} color="#e5e7eb" />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(n: any) => {
            const cat = n.data?.category;
            const map: Record<string, string> = {
              'user input': '#93c5fd',
              frontend: '#86efac',
              backend: '#c4b5fd',
              ai: '#fcd34d',
              database: '#fca5a5',
              'external api': '#67e8f9',
              generic: '#d1d5db',
            };
            return map[cat] || '#d1d5db';
          }}
          style={{ width: 160, height: 100 }}
        />
      </ReactFlow>
    </div>
  );
}