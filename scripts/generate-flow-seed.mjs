import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const databasePath = path.join(rootDir, 'data', 'flows.db');
const outputDir = path.join(rootDir, 'public', 'data');
const outputPath = path.join(outputDir, 'flows.seed.json');

function parseJsonColumn(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse JSON column from flows.db:', error);
    return fallback;
  }
}

function getNodeCounter(nodes) {
  const maxNodeIndex = nodes.reduce((max, node) => {
    const match = typeof node?.id === 'string' ? node.id.match(/node-(\d+)/) : null;
    const numericId = match ? Number.parseInt(match[1], 10) : Number.NaN;
    return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
  }, 0);

  return maxNodeIndex + 1;
}

const db = new DatabaseSync(databasePath, {
  readOnly: true,
});

const rows = db
  .prepare('SELECT id, name, nodes, edges FROM flows ORDER BY updated_at DESC, created_at DESC')
  .all();

const flows = rows.map((row) => {
  const nodes = parseJsonColumn(row.nodes, []);
  const edges = parseJsonColumn(row.edges, []);

  return {
    id: row.id,
    name: row.name,
    nodes,
    edges,
    _counter: getNodeCounter(nodes),
    _undoStack: [],
  };
});

db.close();

const payload = {
  activeFlowId: flows[0]?.id ?? 'flow-1',
  flows,
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`Generated ${path.relative(rootDir, outputPath)} with ${flows.length} flow(s).`);