// 유저 플로우 에디터 전역 상태 (Zustand)
import { create } from 'zustand';
import { formatRgb, parse } from 'culori/fn';
import type { Node, Edge } from '@xyflow/react';

// 노드 카테고리 타입
export type NodeCategory =
  | 'user input'
  | 'frontend'
  | 'backend'
  | 'ai'
  | 'database'
  | 'external api'
  | 'generic';

// 커스텀 노드 데이터
export interface FlowNodeData {
  title: string;
  category: NodeCategory;
  description: string;
  json: string;
  [key: string]: unknown;
}

// 커스텀 엣지 데이터
export interface FlowEdgeData {
  labelShort: string;
  description: string;
  json: string;
  [key: string]: unknown;
}

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge<FlowEdgeData>;

// 편집 모드
export type EditorMode = 'select' | 'connect';

// 사이드바 선택 대상
export type SelectionType =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null;

// 플로우 데이터
export interface FlowData {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  _counter: number;
  _undoStack: { nodes: FlowNode[]; edges: FlowEdge[] }[];
}

interface FlowState {
  // 멀티 플로우
  flows: FlowData[];
  activeFlowId: string;
  addFlow: () => void;
  deleteFlow: (id: string) => void;
  renameFlow: (id: string, name: string) => void;
  switchFlow: (id: string) => void;
  leftSidebarOpen: boolean;
  setLeftSidebarOpen: (v: boolean) => void;

  // 현재 활성 플로우의 노드/엣지
  nodes: FlowNode[];
  edges: FlowEdge[];
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: FlowEdge[]) => void;
  updateNodes: (updater: (prev: FlowNode[]) => FlowNode[]) => void;
  updateEdges: (updater: (prev: FlowEdge[]) => FlowEdge[]) => void;

  // Undo (5단계)
  _undoStack: { nodes: FlowNode[]; edges: FlowEdge[] }[];
  saveSnapshot: () => void;
  undo: () => void;

  // 모드
  mode: EditorMode;
  toggleMode: () => void;
  setMode: (m: EditorMode) => void;

  // 연결 모드: 시작 핸들 선택 상태
  connectSource: { nodeId: string; handleId: string } | null;
  setConnectSource: (s: { nodeId: string; handleId: string } | null) => void;

  // 사이드바
  selection: SelectionType;
  setSelection: (s: SelectionType) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;

  // 노드 추가
  addNode: (partial?: Partial<Pick<FlowNode, 'position'> & { data: Partial<FlowNodeData> }>) => string;
  // 방향별 노드 추가 + 연결
  addNodeInDirection: (sourceId: string, direction: 'top' | 'bottom' | 'left' | 'right') => void;

  // 노드/엣지 데이터 수정
  updateNodeData: (id: string, data: Partial<FlowNodeData>) => void;
  updateEdgeData: (id: string, data: Partial<FlowEdgeData>) => void;

  // 노드/엣지 삭제
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;

  // 카운터 (id 생성용)
  _counter: number;
  // 플로우 id 카운터
  _flowCounter: number;

  // 저장 기능
  isSaving: boolean;
  setIsSaving: (v: boolean) => void;
  saveToDb: () => Promise<void>;
  loadFromDb: () => Promise<void>;

  // Export 기능
  canvasRef: HTMLDivElement | null;
  setCanvasRef: (ref: HTMLDivElement | null) => void;

  // 뷰포트 중심 좌표 제공 콜백 (FlowCanvas에서 등록)
  getViewportCenter: (() => { x: number; y: number }) | null;
  setGetViewportCenter: (fn: (() => { x: number; y: number }) | null) => void;

  exportAllFlows: (canvasElement: HTMLDivElement | null) => Promise<void>;
}

// 방향별 오프셋
const OFFSET: Record<string, { x: number; y: number }> = {
  right: { x: 260, y: 0 },
  left: { x: -260, y: 0 },
  bottom: { x: 0, y: 180 },
  top: { x: 0, y: -180 },
};

// 방향에 따른 소스/타겟 핸들
const HANDLE_MAP: Record<string, { sourceHandle: string; targetHandle: string }> = {
  right: { sourceHandle: 'right-source', targetHandle: 'left-target' },
  left: { sourceHandle: 'left-source', targetHandle: 'right-target' },
  bottom: { sourceHandle: 'bottom-source', targetHandle: 'top-target' },
  top: { sourceHandle: 'top-source', targetHandle: 'bottom-target' },
};

const initialFlowId = 'flow-1';
const LOCAL_STORAGE_KEY = 'tech-flow:flows:v1';
const SEED_DATA_URL = '/data/flows.seed.json';

interface PersistedFlowPayload {
  flows?: FlowData[];
  activeFlowId?: string;
  _seedVersion?: number;
}

function getNodeCounter(nodes: FlowNode[]): number {
  const maxNodeIndex = nodes.reduce((max, node) => {
    const match = node.id.match(/node-(\d+)/);
    const numericId = match ? Number.parseInt(match[1], 10) : Number.NaN;
    return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
  }, 0);

  return maxNodeIndex + 1;
}

function normalizeFlow(flow: Partial<FlowData>): FlowData {
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow.edges) ? flow.edges : [];
  const undoStack = Array.isArray(flow._undoStack) ? flow._undoStack : [];

  return {
    id: flow.id ?? initialFlowId,
    name: flow.name ?? 'tech flow',
    nodes,
    edges,
    _counter: typeof flow._counter === 'number' && flow._counter > 0 ? flow._counter : getNodeCounter(nodes),
    _undoStack: undoStack,
  };
}

function applyPersistedFlows(payload: PersistedFlowPayload): boolean {
  const flows = Array.isArray(payload.flows) ? payload.flows.map(normalizeFlow) : [];
  if (flows.length === 0) {
    return false;
  }

  const initialActiveId = payload.activeFlowId ?? flows[0].id;
  const active = flows.find((flow) => flow.id === initialActiveId) ?? flows[0];
  const maxFlowCounter = flows.reduce((max, flow) => {
    const n = Number.parseInt(flow.id.replace('flow-', ''), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 1);

  useFlowStore.setState({
    flows,
    activeFlowId: active.id,
    nodes: active.nodes,
    edges: active.edges,
    _counter: active._counter,
    _undoStack: active._undoStack,
    _flowCounter: maxFlowCounter,
  });

  return true;
}

async function loadSeedFlows(): Promise<PersistedFlowPayload | null> {
  try {
    const response = await fetch(SEED_DATA_URL, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PersistedFlowPayload;
  } catch (error) {
    console.warn('Failed to load seeded flows:', error);
    return null;
  }
}

// 현재 활성 플로우 상태를 flows 배열에 동기화하는 헬퍼
function syncCurrentToFlows(state: FlowState): FlowData[] {
  return state.flows.map((f) =>
    f.id === state.activeFlowId
      ? { ...f, nodes: state.nodes, edges: state.edges, _counter: state._counter, _undoStack: state._undoStack }
      : f
  );
}

export const useFlowStore = create<FlowState>((set, get) => ({
  // 멀티 플로우
  flows: [{ id: initialFlowId, name: 'tech flow', nodes: [], edges: [], _counter: 1, _undoStack: [] }],
  activeFlowId: initialFlowId,
  leftSidebarOpen: true,
  setLeftSidebarOpen: (v) => set({ leftSidebarOpen: v }),

  addFlow: () => {
    const state = get();
    const newId = `flow-${state._flowCounter + 1}`;
    const newFlow: FlowData = { id: newId, name: 'tech flow', nodes: [], edges: [], _counter: 1, _undoStack: [] };
    // 먼저 현재 플로우를 저장
    const updatedFlows = syncCurrentToFlows(state);
    set({
      flows: [...updatedFlows, newFlow],
      activeFlowId: newId,
      nodes: [],
      edges: [],
      _counter: 1,
      _undoStack: [],
      selection: null,
      connectSource: null,
      _flowCounter: state._flowCounter + 1,
    });
  },

  deleteFlow: (id) => {
    const state = get();
    if (state.flows.length <= 1) return; // 최소 1개
    const updatedFlows = syncCurrentToFlows(state).filter((f) => f.id !== id);
    if (id === state.activeFlowId) {
      const next = updatedFlows[0];
      set({
        flows: updatedFlows,
        activeFlowId: next.id,
        nodes: next.nodes,
        edges: next.edges,
        _counter: next._counter,
        _undoStack: next._undoStack,
        selection: null,
        connectSource: null,
      });
    } else {
      set({ flows: updatedFlows });
    }
  },

  renameFlow: (id, name) => {
    set((s) => ({ flows: s.flows.map((f) => (f.id === id ? { ...f, name } : f)) }));
  },

  switchFlow: (id) => {
    const state = get();
    if (id === state.activeFlowId) return;
    const updatedFlows = syncCurrentToFlows(state);
    const target = updatedFlows.find((f) => f.id === id);
    if (!target) return;
    set({
      flows: updatedFlows,
      activeFlowId: id,
      nodes: target.nodes,
      edges: target.edges,
      _counter: target._counter,
      _undoStack: target._undoStack,
      selection: null,
      connectSource: null,
    });
  },

  nodes: [],
  edges: [],
  setNodes: (nodes) => {
    get().saveSnapshot();
    set({ nodes });
  },
  setEdges: (edges) => {
    get().saveSnapshot();
    set({ edges });
  },
  updateNodes: (updater) => {
    get().saveSnapshot();
    set((s) => ({ nodes: updater(s.nodes) }));
  },
  updateEdges: (updater) => {
    get().saveSnapshot();
    set((s) => ({ edges: updater(s.edges) }));
  },

  _undoStack: [],
  saveSnapshot: () => {
    const { nodes, edges, _undoStack } = get();
    const stack = [..._undoStack, { nodes, edges }];
    if (stack.length > 5) stack.shift();
    set({ _undoStack: stack });
  },
  undo: () => {
    const { _undoStack } = get();
    if (_undoStack.length === 0) return;
    const prev = _undoStack[_undoStack.length - 1];
    set({ nodes: prev.nodes, edges: prev.edges, _undoStack: _undoStack.slice(0, -1) });
  },

  mode: 'select',
  toggleMode: () => set((s) => ({ mode: s.mode === 'select' ? 'connect' : 'select', connectSource: null })),
  setMode: (m) => set({ mode: m, connectSource: null }),

  connectSource: null,
  setConnectSource: (s) => set({ connectSource: s }),

  selection: null,
  setSelection: (s) => set({ selection: s }),
  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  _counter: 1,
  _flowCounter: 1,

  addNode: (partial) => {
    const state = get();
    state.saveSnapshot();
    const id = `node-${state._counter}`;
    const newNode: FlowNode = {
      id,
      type: 'flowNode',
      position: partial?.position ?? (state.getViewportCenter ? state.getViewportCenter() : { x: 100 + state.nodes.length * 30, y: 100 + state.nodes.length * 20 }),
      data: {
          title: '새 노드',
          category: 'generic',
          description: '',
          json: '',
          ...(partial?.data ?? {}),
        },
      };
      
      console.log('✅ addNode: Creating node', id);
      console.log('✅ Current nodes:', state.nodes.length, '-> New:', state.nodes.length + 1);

      set({
        nodes: [...state.nodes, newNode],
        _counter: state._counter + 1,
      });

      return id;
    },

  addNodeInDirection: (sourceId, direction) => {
    const state = get();
    const source = state.nodes.find((n) => n.id === sourceId);
    if (!source) return;

    state.saveSnapshot();

    const off = OFFSET[direction];
    let targetPos = {
      x: source.position.x + off.x,
      y: source.position.y + off.y,
    };

    // 간단한 겹침 방지
    const occupied = state.nodes.some(
      (n) => Math.abs(n.position.x - targetPos.x) < 50 && Math.abs(n.position.y - targetPos.y) < 50
    );
    if (occupied) {
      targetPos = { x: targetPos.x + 30, y: targetPos.y + 20 };
    }

    const id = `node-${state._counter}`;
    const newNode: FlowNode = {
      id,
      type: 'flowNode',
      position: targetPos,
      data: { title: '새 노드', category: 'generic', description: '', json: '' },
    };

    const handles = HANDLE_MAP[direction];
    const newEdge: FlowEdge = {
      id: `edge-${sourceId}-${id}`,
      source: sourceId,
      target: id,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      type: 'flowEdge',
      data: { labelShort: '', description: '', json: '' },
    };

    set({
      nodes: [...state.nodes, newNode],
      edges: [...state.edges, newEdge],
      _counter: state._counter + 1,
    });

    return id;
  },

  updateNodeData: (id, data) => {
    get().saveSnapshot();
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }));
  },

  updateEdgeData: (id, data) => {
    get().saveSnapshot();
    set((s) => ({
      edges: s.edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data!, ...data } } : e
      ),
    }));
  },

  deleteNode: (id) => {
    get().saveSnapshot();
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selection: state.selection?.kind === 'node' && state.selection.id === id ? null : state.selection,
    }));
  },

  deleteEdge: (id) => {
    get().saveSnapshot();
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
      selection: state.selection?.kind === 'edge' && state.selection.id === id ? null : state.selection,
    }));
  },

  // 저장 기능
  isSaving: false,
  setIsSaving: (v) => set({ isSaving: v }),
  saveToDb: async () => {
    const state = get();
    set({ isSaving: true });
    try {
      const flows = syncCurrentToFlows(state);
      // 기존 seedVersion 보존
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const prev = raw ? (JSON.parse(raw) as PersistedFlowPayload) : null;
      const payload = {
        _manualSave: true,
        _seedVersion: prev?._seedVersion ?? 0,
        flows,
        activeFlowId: state.activeFlowId,
      };

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));

      // dev 환경에서는 파일에도 저장 (git push 시 Vercel 배포에 반영됨)
      if (import.meta.env.DEV) {
        fetch('/api/save-flows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }

      console.log('✅ Flow saved to browser storage');
    } catch (error) {
      console.error('❌ Save error:', error);
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },
  loadFromDb: async () => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const local = raw ? (JSON.parse(raw) as PersistedFlowPayload) : null;
      const seeded = await loadSeedFlows();

      const localVersion = local?._seedVersion ?? 0;
      const seedVersion = seeded?._seedVersion ?? 0;

      // seed 파일이 더 새로우면 seed 우선
      if (seeded && seedVersion > localVersion) {
        if (applyPersistedFlows(seeded)) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...seeded, _seedVersion: seedVersion }));
          return;
        }
      }

      // 그 외에는 localStorage 우선
      if (local && applyPersistedFlows(local)) {
        return;
      }

      // localStorage도 없으면 seed 사용
      if (seeded) {
        applyPersistedFlows(seeded);
      }
    } catch (error) {
      console.error('❌ Load error:', error);
    }
  },

  // Export 기능
  canvasRef: null,
  setCanvasRef: (ref) => set({ canvasRef: ref }),

    // 뷰포트 중심 콜백
    getViewportCenter: null,
    setGetViewportCenter: (fn) => set({ getViewportCenter: fn }),

  exportAllFlows: async (canvasElement: HTMLDivElement | null) => {
    if (!canvasElement) {
      console.error('Canvas element not available');
      throw new Error('Canvas element not available');
    }

    const safeStyleText = `
      :root, .dark {
        --background: #ffffff;
        --foreground: #030213;
        --card: #ffffff;
        --card-foreground: #030213;
        --popover: #ffffff;
        --popover-foreground: #030213;
        --primary: #030213;
        --primary-foreground: #ffffff;
        --border: rgba(0, 0, 0, 0.1);
      }
      .react-flow { background: #f9fafb !important; }
      .truncate { white-space: normal !important; overflow: visible !important; text-overflow: unset !important; }
      .react-flow__node { max-width: none !important; width: auto !important; }
    `;

    let initialState: {
      activeFlowId: string;
      nodes: FlowNode[];
      edges: FlowEdge[];
      _counter: number;
      _undoStack: { nodes: FlowNode[]; edges: FlowEdge[] }[];
      flows?: FlowData[];
    } | null = null;

    try {
      // @ts-ignore
      const { default: html2canvas } = await import('html2canvas');
      // @ts-ignore
      const JSZip = await import('jszip').then((m) => m.default);

      const zip = new JSZip();
      const state = get();

      // 현재 활성 플로우 변경을 저장해두고, export에서 사용할 플로우 데이터 동기화
      const flows = syncCurrentToFlows(state);
      set({ flows });

      initialState = {
        activeFlowId: state.activeFlowId,
        nodes: state.nodes,
        edges: state.edges,
        _counter: state._counter,
        _undoStack: state._undoStack,
        flows: state.flows,
      };

      for (const flow of flows) {
        // 각 플로우로 전환
        useFlowStore.setState({
          activeFlowId: flow.id,
          nodes: flow.nodes,
          edges: flow.edges,
          _counter: flow._counter,
          _undoStack: flow._undoStack,
        });

        // 렌더링이 완료되도록 충분히 기다림
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        // 현재 canvas 캡처: React Flow 루트가 있으면 그 요소만 캡처
        const captureTarget = (canvasElement.querySelector('.react-flow') as HTMLElement) || canvasElement;

        const canvas = await html2canvas(captureTarget, {
          backgroundColor: '#f9fafb',
          scale: 2,
          onclone: (clonedDoc) => {
            const safeStyle = clonedDoc.createElement('style');
            safeStyle.textContent = safeStyleText;
            clonedDoc.head.appendChild(safeStyle);

            // Clone된 문서에서 oklch를 RGB로 변환
            const oklchToRgb = (oklchStr: string): string => {
              try {
                const color = parse(oklchStr);
                if (color) {
                  return formatRgb(color);
                }
              } catch (e) {
                console.warn('Failed to parse oklch:', oklchStr, e);
              }
              return '#000000'; // fallback
            };

            clonedDoc.querySelectorAll<HTMLStyleElement>('style').forEach((styleEl) => {
              if (styleEl.textContent?.includes('oklch')) {
                styleEl.textContent = styleEl.textContent.replace(/oklch\([^)]*\)/g, (match) => oklchToRgb(match));
              }
            });

            clonedDoc.querySelectorAll<HTMLElement>('*').forEach((el) => {
              // inline style
              if (el.getAttribute('style')?.includes('oklch')) {
                el.setAttribute('style', el.getAttribute('style')!.replace(/oklch\([^)]*\)/g, (match) => oklchToRgb(match)));
              }

              // svg attributes
              Array.from(el.attributes).forEach((attr) => {
                if (attr.value.includes('oklch')) {
                  el.setAttribute(attr.name, attr.value.replace(/oklch\([^)]*\)/g, (match) => oklchToRgb(match)));
                }
              });
            });
          },
        });

        // PNG로 변환 (Promise 기반)
        await new Promise<void>((resolve) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                zip.file(`${flow.name || flow.id}.png`, blob);
              }
              resolve();
            },
            'image/png'
          );
        });

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // ZIP 생성 및 다운로드
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `flows-export-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      console.log('✅ All flows exported successfully');
    } catch (error) {
      console.error('❌ Export error:', error);
      throw error;
    } finally {
      if (initialState) {
        useFlowStore.setState({
          ...initialState,
          flows: initialState.flows,
        });
      }
    }
  },
}));