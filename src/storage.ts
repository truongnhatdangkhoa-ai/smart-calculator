// Lưu/đọc bộ nhớ, lịch sử, cài đặt trên thiết bị (localStorage). Logic thuần để kiểm thử được.
// BigInt không JSON.stringify được nên phân số chính xác được lưu dạng chuỗi "n/d".
import { MAX_LENGTH } from './engine/index.ts';
import type { Frac } from './engine/index.ts';
import { DEFAULT_SETTINGS, MAX_DECIMALS, MAX_HISTORY } from './calculatorState.ts';
import type { CalcState, HistoryEntry, MemoryValue, Persisted, ResultKind, Settings } from './calculatorState.ts';

export const STORAGE_KEY = 'sci-calc:v1';
/** Giao diện tối thiểu của localStorage (để thay thế khi kiểm thử). */
export interface KV { getItem(key: string): string | null; setItem(key: string, value: string): void }

const fracToStr = (f: Frac | null): string | null => (f ? `${f.n}/${f.d}` : null);
function strToFrac(v: unknown): Frac | null {
  if (typeof v !== 'string' || !/^-?\d{1,400}\/\d{1,400}$/.test(v)) return null;
  const [n, d] = v.split('/');
  return BigInt(d) > 0n ? { n: BigInt(n), d: BigInt(d) } : null;
}

export function serialize(s: Pick<CalcState, 'memory' | 'history' | 'settings' | 'angle'>): string {
  return JSON.stringify({
    v: 1,
    angle: s.angle,
    settings: s.settings,
    memory: s.memory ? { value: s.memory.value, exact: fracToStr(s.memory.exact) } : null,
    history: s.history.slice(0, MAX_HISTORY),
  });
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const KINDS: ResultKind[] = ['integer', 'fraction', 'real'];

function parseSettings(x: unknown): Settings {
  if (!isObj(x)) return { ...DEFAULT_SETTINGS };
  const d = x.decimals;
  return {
    decimals: typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= MAX_DECIMALS ? d : null,
    decimalSep: x.decimalSep === ',' ? ',' : '.',
    theme: x.theme === 'light' || x.theme === 'dark' ? x.theme : null,
  };
}
function parseHistory(x: unknown): HistoryEntry[] {
  if (!Array.isArray(x)) return [];
  const out: HistoryEntry[] = [];
  for (const h of x) {
    if (!isObj(h)) continue;
    const { id, expr, result, approximate, kind, fraction, time } = h;
    if (typeof id !== 'number' || !Number.isFinite(id) || typeof expr !== 'string' || expr.length > MAX_LENGTH
      || typeof result !== 'string' || result.length > 400 || typeof time !== 'number' || !Number.isFinite(time)
      || !KINDS.includes(kind as ResultKind)) continue;
    out.push({
      id, expr, result, approximate: approximate === true, kind: kind as ResultKind,
      fraction: typeof fraction === 'string' && fraction.length <= 400 ? fraction : null, time,
    });
    if (out.length >= MAX_HISTORY) break;
  }
  return out;
}

/** Đọc dữ liệu đã lưu; dữ liệu hỏng hoặc thiếu thì dùng mặc định (không bao giờ ném lỗi). */
export function deserialize(raw: string | null): Persisted {
  const empty: Persisted = { memory: null, history: [], settings: { ...DEFAULT_SETTINGS }, angle: 'deg' };
  if (!raw) return empty;
  try {
    const x: unknown = JSON.parse(raw);
    if (!isObj(x) || x.v !== 1) return empty;
    let memory: MemoryValue | null = null;
    if (isObj(x.memory) && typeof x.memory.value === 'number' && Number.isFinite(x.memory.value))
      memory = { value: x.memory.value, exact: strToFrac(x.memory.exact) };
    return {
      memory, history: parseHistory(x.history), settings: parseSettings(x.settings), angle: x.angle === 'rad' ? 'rad' : 'deg',
    };
  } catch {
    return empty;
  }
}

export function loadPersisted(storage: KV | null): Persisted {
  try { return deserialize(storage ? storage.getItem(STORAGE_KEY) : null); } catch { return deserialize(null); }
}
/** Trả về false nếu không lưu được (ví dụ bị chặn hoặc đầy bộ nhớ). */
export function savePersisted(storage: KV | null, s: Pick<CalcState, 'memory' | 'history' | 'settings' | 'angle'>): boolean {
  try { storage?.setItem(STORAGE_KEY, serialize(s)); return !!storage; } catch { return false; }
}

// ---- Sao lưu / khôi phục lịch sử qua file JSON ----
export const BACKUP_APP = 'scientific-calculator-history';
export const MAX_BACKUP_CHARS = 2_000_000;

/** Chuỗi JSON sao lưu lịch sử (có thể lưu thành file hoặc sao chép). */
export function exportHistory(history: HistoryEntry[], now: number = Date.now()): string {
  return JSON.stringify({ app: BACKUP_APP, v: 1, exportedAt: now, history: history.slice(0, MAX_HISTORY) }, null, 2);
}

export type ImportResult = { ok: true; entries: HistoryEntry[]; skipped: number } | { ok: false; error: string };

/** Đọc file sao lưu; bản ghi sai định dạng bị bỏ qua (đếm trong `skipped`), không bao giờ ném lỗi. */
export function parseHistoryImport(raw: string): ImportResult {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, error: 'Nội dung trống.' };
  if (raw.length > MAX_BACKUP_CHARS) return { ok: false, error: 'File quá lớn để là bản sao lưu lịch sử.' };
  let x: unknown;
  try { x = JSON.parse(raw); } catch { return { ok: false, error: 'Không đọc được: không phải JSON hợp lệ.' }; }
  if (!isObj(x) || x.app !== BACKUP_APP || x.v !== 1 || !Array.isArray(x.history))
    return { ok: false, error: 'Đây không phải file sao lưu lịch sử của ứng dụng này.' };
  const entries = parseHistory(x.history);
  return { ok: true, entries, skipped: x.history.length - entries.length };
}

/** Gộp bản ghi nhập vào lịch sử hiện có: bỏ trùng (cùng biểu thức, kết quả, thời gian), cấp id mới, mới nhất trước, tối đa MAX_HISTORY. */
export function mergeHistory(current: HistoryEntry[], imported: HistoryEntry[]): { history: HistoryEntry[]; added: number } {
  const key = (h: HistoryEntry) => `${h.time}\u0000${h.expr}\u0000${h.result}`;
  const seen = new Set(current.map(key));
  let nextId = current.reduce((m, h) => Math.max(m, h.id), 0) + 1;
  const fresh: HistoryEntry[] = [];
  for (const h of imported) {
    if (seen.has(key(h))) continue;
    seen.add(key(h));
    fresh.push({ ...h, id: nextId++ });
  }
  const history = [...current, ...fresh].sort((a, b) => b.time - a.time).slice(0, MAX_HISTORY);
  return { history, added: fresh.filter((f) => history.includes(f)).length };
}
