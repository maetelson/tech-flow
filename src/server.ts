import express, { Express, Request, Response } from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/flows.db');

const httpServer = http.createServer(app);
const io = new IOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// SQLite 데이터베이스 초기화 (선택)
const dbPath = DB_PATH;
let db: Database.Database | null = null;
let dbAvailable = true;
try {
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log(`✅ SQLite DB ready at ${dbPath}`);
} catch (error) {
  dbAvailable = false;
  console.warn(`⚠️ DB 사용 불가 (읽기 전용 환경 등): ${error}`);
}

// 미들웨어
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Render 헬스체크
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// API 엔드포인트

// 모든 플로우 조회
app.get('/api/flows', (_req: Request, res: Response) => {
  if (!db || !dbAvailable) {
    return res.status(500).json({ error: 'DB unavailable' });
  }

  try {
    const stmt = db.prepare('SELECT id, name, nodes, edges FROM flows ORDER BY updated_at DESC');
    const flows = stmt.all();
    // JSON 파싱
    const parsedFlows = flows.map((flow: any) => ({
      id: flow.id,
      name: flow.name,
      nodes: JSON.parse(flow.nodes),
      edges: JSON.parse(flow.edges),
      _counter: 1, // 기본값
      _undoStack: [],
    }));
    res.json(parsedFlows);
  } catch (error) {
    console.error('Error fetching flows:', error);
    res.status(500).json({ error: 'Failed to fetch flows' });
  }
});

// 특정 플로우 조회
app.get('/api/flows/:id', (req: Request, res: Response) => {
  if (!db || !dbAvailable) {
    return res.status(500).json({ error: 'DB unavailable' });
  }

  try {
    const stmt = db.prepare('SELECT * FROM flows WHERE id = ?');
    const flow = stmt.get(req.params.id) as { id: string; name: string; nodes: string; edges: string } | undefined;
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }
    res.json({
      ...flow,
      nodes: JSON.parse(flow.nodes),
      edges: JSON.parse(flow.edges),
    });
  } catch (error) {
    console.error('Error fetching flow:', error);
    res.status(500).json({ error: 'Failed to fetch flow' });
  }
});

// 플로우 저장 (생성 또는 업데이트)
app.post('/api/flows', (req: Request, res: Response) => {
  if (!db || !dbAvailable) {
    return res.status(500).json({ error: 'DB unavailable' });
  }

  try {
    const { id, name, nodes, edges } = req.body;

    if (!id || !name) {
      res.status(400).json({ error: 'id and name are required' });
      return;
    }

    const stmt = db.prepare(
      `INSERT INTO flows (id, name, nodes, edges)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       nodes = excluded.nodes,
       edges = excluded.edges,
       updated_at = CURRENT_TIMESTAMP`
    );

    stmt.run(
      id,
      name,
      JSON.stringify(nodes),
      JSON.stringify(edges)
    );

    res.json({
      id,
      name,
      message: 'Flow saved successfully',
    });
  } catch (error) {
    console.error('Error saving flow:', error);
    res.status(500).json({ error: 'Failed to save flow' });
  }
});

// 플로우 삭제
app.delete('/api/flows/:id', (req: Request, res: Response) => {
  if (!db || !dbAvailable) {
    return res.status(500).json({ error: 'DB unavailable' });
  }

  try {
    const stmt = db.prepare('DELETE FROM flows WHERE id = ?');
    const result = stmt.run(req.params.id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    res.json({ message: 'Flow deleted successfully' });
  } catch (error) {
    console.error('Error deleting flow:', error);
    res.status(500).json({ error: 'Failed to delete flow' });
  }
});

// 초기값: DB에서 가장 최근 플로우 읽기
let sharedFlow = { id: 'flow-1', name: 'tech flow', nodes: [], edges: [] };
if (db && dbAvailable) {
  try {
    const initialRow = db
      .prepare('SELECT id, name, nodes, edges FROM flows ORDER BY updated_at DESC LIMIT 1')
      .get() as { id: string; name: string; nodes: string; edges: string } | undefined;

    if (initialRow) {
      sharedFlow = {
        id: initialRow.id,
        name: initialRow.name,
        nodes: JSON.parse(initialRow.nodes),
        edges: JSON.parse(initialRow.edges),
      };
      console.log('✅ Loaded sharedFlow from DB:', sharedFlow.id);
    }
  } catch (error) {
    console.error('❌ Failed to load initial sharedFlow from DB', error);
  }
}
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // 클라이언트로 현재 플로우 전달
  socket.emit('flow:init', sharedFlow);

  socket.on('flow:get', () => {
    socket.emit('flow:init', sharedFlow);
  });

  socket.on('flow:update', (data) => {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return;
    sharedFlow = {
      ...sharedFlow,
      nodes: data.nodes,
      edges: data.edges,
    };

    // DB 업데이트 (옵션)
    if (db && dbAvailable) {
      try {
        const stmt = db.prepare(
          `INSERT INTO flows (id, name, nodes, edges) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           nodes = excluded.nodes,
           edges = excluded.edges,
           updated_at = CURRENT_TIMESTAMP`
        );
        stmt.run(sharedFlow.id, sharedFlow.name, JSON.stringify(sharedFlow.nodes), JSON.stringify(sharedFlow.edges));
      } catch (error) {
        console.error('❌ Failed to persist sharedFlow on update', error);
      }
    } else {
      console.warn('⚠️ DB unavailable: flow update in-memory only');
    }

    socket.broadcast.emit('flow:update', sharedFlow);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// 서버 시작
httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
