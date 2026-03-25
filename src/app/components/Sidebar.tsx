// 우측 사이드바: 노드/엣지 정보 편집 (속성 / 노트 탭)
import { useState, useRef, useCallback } from 'react';
import { useFlowStore, type NodeCategory } from './store';
import { MarkdownEditor } from './MarkdownEditor';
import { X, PanelRightOpen, Trash2, AlertCircle, Check } from 'lucide-react';

const CATEGORIES: NodeCategory[] = [
  'generic',
  'user input',
  'frontend',
  'backend',
  'ai',
  'database',
  'external api',
];

const CATEGORY_COLORS: Record<NodeCategory, string> = {
  'user input': 'bg-blue-100 text-blue-700 border-blue-300',
  frontend: 'bg-green-100 text-green-700 border-green-300',
  backend: 'bg-purple-100 text-purple-700 border-purple-300',
  ai: 'bg-amber-100 text-amber-700 border-amber-300',
  database: 'bg-red-100 text-red-700 border-red-300',
  'external api': 'bg-cyan-100 text-cyan-700 border-cyan-300',
  generic: 'bg-gray-100 text-gray-700 border-gray-300',
};

type SidebarTab = 'properties' | 'notes' | 'json';

const SIDEBAR_MIN_W = 300;
const SIDEBAR_MAX_W = 600;
const SIDEBAR_DEFAULT_W = 340;

export function Sidebar() {
  const sidebarOpen = useFlowStore((s) => s.sidebarOpen);
  const setSidebarOpen = useFlowStore((s) => s.setSidebarOpen);
  const selection = useFlowStore((s) => s.selection);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const updateEdgeData = useFlowStore((s) => s.updateEdgeData);
  const deleteNode = useFlowStore((s) => s.deleteNode);
  const deleteEdge = useFlowStore((s) => s.deleteEdge);
  const setSelection = useFlowStore((s) => s.setSelection);

  const [tab, setTab] = useState<SidebarTab>('properties');
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_W);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startW = width;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX;
      const newW = Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, startW + delta));
      setWidth(newW);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  if (!sidebarOpen) {
    return (
      <div className="w-auto h-full flex items-start justify-end pt-3 pr-3 relative">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          title="사이드바 열기"
        >
          <PanelRightOpen size={18} />
        </button>
      </div>
    );
  }

  const selectedNode = selection?.kind === 'node' ? nodes.find((n) => n.id === selection.id) : null;
  const selectedEdge = selection?.kind === 'edge' ? edges.find((e) => e.id === selection.id) : null;
  const hasSelection = selectedNode || selectedEdge;

  return (
    <div
      className="border-l border-gray-200 bg-white h-full flex flex-col overflow-hidden relative"
      style={{ width, minWidth: SIDEBAR_MIN_W, maxWidth: SIDEBAR_MAX_W }}
    >
      {/* 리사이즈 핸들 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/40 active:bg-blue-500/50 transition-colors z-10"
        onMouseDown={handleMouseDown}
      />
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm text-gray-700">
          {selectedNode ? '노드' : selectedEdge ? '연결' : '속성 패널'}
        </h2>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X size={16} />
        </button>
      </div>

      {/* 탭 */}
      {hasSelection && (
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-2 text-xs transition-colors ${
              tab === 'properties'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab('properties')}
          >
            속성
          </button>
          <button
            className={`flex-1 py-2 text-xs transition-colors ${
              tab === 'notes'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab('notes')}
          >
            노트
          </button>
          <button
            className={`flex-1 py-2 text-xs transition-colors ${
              tab === 'json'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setTab('json')}
          >
            JSON
          </button>
        </div>
      )}

      {/* 내용 */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
        {selectedNode ? (
          tab === 'properties' ? (
            <NodeProperties
              key={selectedNode.id}
              node={selectedNode}
              updateNodeData={updateNodeData}
              onDelete={() => {
                deleteNode(selectedNode.id);
                setSelection(null);
              }}
            />
          ) : tab === 'notes' ? (
            <NodeNotes
              key={selectedNode.id}
              node={selectedNode}
              updateNodeData={updateNodeData}
            />
          ) : (
            <NodeJSON
              key={selectedNode.id}
              node={selectedNode}
              updateNodeData={updateNodeData}
            />
          )
        ) : selectedEdge ? (
          tab === 'properties' ? (
            <EdgeProperties
              key={selectedEdge.id}
              edge={selectedEdge}
              updateEdgeData={updateEdgeData}
              nodes={nodes}
              onDelete={() => {
                deleteEdge(selectedEdge.id);
                setSelection(null);
              }}
            />
          ) : tab === 'notes' ? (
            <EdgeNotes
              key={selectedEdge.id}
              edge={selectedEdge}
              updateEdgeData={updateEdgeData}
            />
          ) : (
            <EdgeJSON
              key={selectedEdge.id}
              edge={selectedEdge}
              updateEdgeData={updateEdgeData}
            />
          )
        ) : (
          <div className="text-sm text-gray-400 text-center mt-12">
            <p>노드 또는 화살표를 선택하면</p>
            <p>여기서 상세 정보를 편집할 수 있습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 노드: 속성 탭 ──
function NodeProperties({
  node,
  updateNodeData,
  onDelete,
}: {
  node: ReturnType<typeof useFlowStore.getState>['nodes'][number];
  updateNodeData: (id: string, data: any) => void;
  onDelete: () => void;
}) {
  const data = node.data;
  return (
    <div className="space-y-4 flex flex-col flex-1 min-h-0">
      <div className="text-xs text-gray-400">ID: {node.id}</div>

      {/* 제목 */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">제목</label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={data.title}
          onChange={(e) => updateNodeData(node.id, { title: e.target.value })}
        />
      </div>

      {/* 카테고리 선택 */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">카테고리</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const isActive = data.category === c;
            const colors = CATEGORY_COLORS[c];
            return (
              <button
                key={c}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                  isActive
                    ? `${colors} border-current shadow-sm`
                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600'
                }`}
                onClick={() => updateNodeData(node.id, { category: c })}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* 삭제 */}
      <div className="pt-4 mt-auto border-t border-gray-100">
        <button
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
          onClick={onDelete}
        >
          <Trash2 size={13} />
          노드 삭제
        </button>
      </div>
    </div>
  );
}

// ── 노드: 노트 탭 ──
function NodeNotes({
  node,
  updateNodeData,
}: {
  node: ReturnType<typeof useFlowStore.getState>['nodes'][number];
  updateNodeData: (id: string, data: any) => void;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <label className="block text-xs text-gray-500 mb-1">상세 설명</label>
      <MarkdownEditor
        value={node.data.description}
        onChange={(v) => updateNodeData(node.id, { description: v })}
        placeholder="마크다운으로 노드의 상세 설명을 작성하세요…"
      />
    </div>
  );
}

// ── 노드: JSON 탭 ──
function NodeJSON({
  node,
  updateNodeData,
}: {
  node: ReturnType<typeof useFlowStore.getState>['nodes'][number];
  updateNodeData: (id: string, data: any) => void;
}) {
  const [json, setJson] = useState(node.data.json || '');
  const [isValid, setIsValid] = useState(true);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJson(val);
    updateNodeData(node.id, { json: val });
    if (val.trim() === '') {
      setIsValid(true);
      return;
    }
    try {
      JSON.parse(val);
      setIsValid(true);
    } catch {
      setIsValid(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs text-gray-500">JSON 데이터</label>
        {json.trim() && (
          <span className={`text-xs flex items-center gap-0.5 ${isValid ? 'text-green-500' : 'text-red-500'}`}>
            {isValid ? <Check size={12} /> : <AlertCircle size={12} />}
            {isValid ? '유효' : '오류'}
          </span>
        )}
      </div>
      <textarea
        className={`w-full border ${
          !json.trim() ? 'border-gray-200' : isValid ? 'border-green-300' : 'border-red-400'
        } rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-blue-400 flex-1 resize-none`}
        style={{ minHeight: 0 }}
        value={json}
        onChange={handleJsonChange}
        placeholder='{\n  "key": "value"\n}'
      />
    </div>
  );
}

// ── 엣지: 속성 탭 ──
function EdgeProperties({
  edge,
  updateEdgeData,
  nodes,
  onDelete,
}: {
  edge: ReturnType<typeof useFlowStore.getState>['edges'][number];
  updateEdgeData: (id: string, data: any) => void;
  nodes: ReturnType<typeof useFlowStore.getState>['nodes'];
  onDelete: () => void;
}) {
  const data = edge.data!;
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  return (
    <div className="space-y-4 flex flex-col flex-1 min-h-0">
      <div className="text-xs text-gray-400">
        {sourceNode?.data.title ?? edge.source} → {targetNode?.data.title ?? edge.target}
      </div>

      {/* 짧은 라벨 */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">짧은 라벨 (캔버스 표시용)</label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
          value={data.labelShort}
          onChange={(e) => updateEdgeData(edge.id, { labelShort: e.target.value })}
          placeholder="최대 10자 권장"
          maxLength={30}
        />
      </div>

      {/* 삭제 */}
      <div className="pt-4 mt-auto border-t border-gray-100">
        <button
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
          onClick={onDelete}
        >
          <Trash2 size={13} />
          연결 삭제
        </button>
      </div>
    </div>
  );
}

// ── 엣지: 노트 탭 ──
function EdgeNotes({
  edge,
  updateEdgeData,
}: {
  edge: ReturnType<typeof useFlowStore.getState>['edges'][number];
  updateEdgeData: (id: string, data: any) => void;
}) {
  const data = edge.data!;
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <label className="block text-xs text-gray-500 mb-1">상세 설명</label>
      <MarkdownEditor
        value={data.description}
        onChange={(v) => updateEdgeData(edge.id, { description: v })}
        placeholder="마크다운으로 연결에 대한 설명을 작성하세요…"
      />
    </div>
  );
}

// ── 엣지: JSON 탭 ──
function EdgeJSON({
  edge,
  updateEdgeData,
}: {
  edge: ReturnType<typeof useFlowStore.getState>['edges'][number];
  updateEdgeData: (id: string, data: any) => void;
}) {
  const [json, setJson] = useState(edge.data?.json || '');
  const [isValid, setIsValid] = useState(true);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJson(val);
    updateEdgeData(edge.id, { json: val });
    if (val.trim() === '') {
      setIsValid(true);
      return;
    }
    try {
      JSON.parse(val);
      setIsValid(true);
    } catch {
      setIsValid(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs text-gray-500">JSON 데이터</label>
        {json.trim() && (
          <span className={`text-xs flex items-center gap-0.5 ${isValid ? 'text-green-500' : 'text-red-500'}`}>
            {isValid ? <Check size={12} /> : <AlertCircle size={12} />}
            {isValid ? '유효' : '오류'}
          </span>
        )}
      </div>
      <textarea
        className={`w-full border ${
          !json.trim() ? 'border-gray-200' : isValid ? 'border-green-300' : 'border-red-400'
        } rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-blue-400 flex-1 resize-none`}
        style={{ minHeight: 0 }}
        value={json}
        onChange={handleJsonChange}
        placeholder='{\n  "key": "value"\n}'
      />
    </div>
  );
}