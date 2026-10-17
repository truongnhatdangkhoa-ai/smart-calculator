// Logic nhập liệu của máy tính (thuần, không phụ thuộc React) để kiểm thử được.
import { describeInteger, evaluate, formatNumber, fracAdd, fracSub, MAX_LENGTH } from './engine/index.ts';
import type { AngleMode, Frac } from './engine/index.ts';

export type ResultKind = 'integer' | 'fraction' | 'real';
interface Snapshot {
  expression: string;
  result: string | null;
  approximate: boolean;
  error: string | null;
  justEvaluated: boolean;
  ans: number | null;
  ansExact: Frac | null;
  kind: ResultKind | null;
  fraction: string | null;
}
export type DecimalSep = '.' | ',';
export type Theme = 'light' | 'dark';
/** decimals: null = tự động; theme: null = theo hệ thống. */
export interface Settings { decimals: number | null; decimalSep: DecimalSep; theme: Theme | null }
export const DEFAULT_SETTINGS: Settings = { decimals: null, decimalSep: '.', theme: null };
export const MAX_DECIMALS = 10;
export const MAX_HISTORY = 200;
export interface MemoryValue { value: number; exact: Frac | null }
/** Biểu thức và kết quả luôn dùng dấu thập phân "." bên trong; chỉ đổi khi hiển thị. */
export interface HistoryEntry {
  id: number; expr: string; result: string; approximate: boolean; kind: ResultKind; fraction: string | null; time: number;
}
/** Phần được lưu bền vững trên thiết bị (xem storage.ts). */
export interface Persisted { memory: MemoryValue | null; history: HistoryEntry[]; settings: Settings; angle: AngleMode }
/** angle, showFraction, memory, history, settings không nằm trong lịch sử hoàn tác. */
export interface CalcState extends Snapshot {
  undoStack: Snapshot[]; angle: AngleMode; showFraction: boolean;
  memory: MemoryValue | null; history: HistoryEntry[]; settings: Settings;
}
export type Action =
  | { type: 'input'; text: string }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'equals'; now?: number }
  | { type: 'negate' }
  | { type: 'undo' }
  | { type: 'toggleAngle' }
  | { type: 'toggleFraction' }
  | { type: 'memClear' } | { type: 'memRecall' } | { type: 'memAdd' } | { type: 'memSub' } | { type: 'memStore' }
  | { type: 'setExpression'; text: string }
  | { type: 'historyDelete'; id: number }
  | { type: 'historyClear' }
  | { type: 'historySet'; history: HistoryEntry[] }
  | { type: 'setSettings'; patch: Partial<Settings> }
  | { type: 'setAngle'; angle: AngleMode };

export function createInitialState(p?: Partial<Persisted>): CalcState {
  return {
    expression: '', result: null, approximate: false, error: null, justEvaluated: false, ans: null,
    ansExact: null, kind: null, fraction: null, undoStack: [], angle: p?.angle ?? 'deg', showFraction: false,
    memory: p?.memory ?? null, history: p?.history ?? [], settings: p?.settings ?? DEFAULT_SETTINGS,
  };
}
export const initialState: CalcState = createInitialState();
const NO_RESULT = { result: null, approximate: false, error: null, justEvaluated: false, kind: null, fraction: null } as const;

const BIN = '+−×÷^';
const isBin = (c: string) => c.length === 1 && BIN.includes(c);
const isPostfix = (c: string) => c === '!' || c === '%';

function snap(s: CalcState): Snapshot {
  return {
    expression: s.expression, result: s.result, approximate: s.approximate, error: s.error,
    justEvaluated: s.justEvaluated, ans: s.ans, ansExact: s.ansExact, kind: s.kind, fraction: s.fraction,
  };
}
function withUndo(s: CalcState, patch: Partial<Snapshot>): CalcState {
  return { ...s, ...patch, undoStack: [...s.undoStack, snap(s)].slice(-100) };
}
/** Thêm các dấu ")" còn thiếu để bản ghi lịch sử là biểu thức hoàn chỉnh (giống cách bấm "=" tự đóng ngoặc). */
function closeParens(expr: string): string {
  let bal = 0;
  for (const c of expr) { if (c === '(') bal++; else if (c === ')' && bal > 0) bal--; }
  return expr + ')'.repeat(bal);
}
function balancedInner(expr: string): boolean {
  let bal = 0;
  for (const c of expr) {
    if (c === '(') bal++;
    if (c === ')' && --bal < 0) return false;
  }
  return bal === 0;
}

export function reducer(s: CalcState, a: Action): CalcState {
  switch (a.type) {
    case 'input': {
      let base = s.expression;
      let text = a.text;
      if (s.justEvaluated) {
        if (isBin(text) || isPostfix(text)) base = s.ans !== null ? 'Ans' : '';
        else base = '';
      }
      if (isBin(text)) {
        if (base === '' && text !== '−') return s;
        if (base !== '' && isBin(base.slice(-1))) {
          if (!(text === '−' && '×÷^'.includes(base.slice(-1)))) { base = base.slice(0, -1); }
        }
      } else if (isPostfix(text) && (base === '' || isBin(base.slice(-1)) || base.slice(-1) === '(')) return s;
      if (base.length + text.length > MAX_LENGTH)
        return { ...s, error: `Đã đạt giới hạn ${MAX_LENGTH} ký tự.` };
      return withUndo(s, { ...NO_RESULT, expression: base + text });
    }
    case 'backspace': {
      if (s.expression === '') return s;
      const next = s.expression.replace(/(?:[a-z]+[0-9]*\(|Ans)$|.$/, '');
      return withUndo(s, { ...NO_RESULT, expression: next });
    }
    case 'clear':
      if (s.expression === '' && s.result === null && s.error === null) return s;
      return withUndo(s, { ...NO_RESULT, expression: '' });
    case 'equals': {
      if (s.expression === '' || s.justEvaluated) return s;
      const r = evaluate(s.expression, evalOpts(s));
      if (!r.ok) return withUndo(s, { ...NO_RESULT, error: r.error.message });
      const out = renderResult(r.value, r.exact, s.settings.decimals);
      const entry: HistoryEntry = {
        id: (s.history[0]?.id ?? 0) + 1, expr: closeParens(s.expression), result: out.result, approximate: out.approximate,
        kind: out.kind, fraction: out.fraction, time: a.now ?? Date.now(),
      };
      return {
        ...withUndo(s, { ...NO_RESULT, ...out, justEvaluated: true, ans: r.value, ansExact: r.exact }),
        history: [entry, ...s.history].slice(0, MAX_HISTORY),
      };
    }
    case 'negate': {
      let expr: string;
      if (s.justEvaluated) expr = s.ans !== null ? '−(Ans)' : '';
      else if (s.expression === '') expr = '−';
      else {
        const m = /^−\((.*)\)$/.exec(s.expression);
        expr = m && balancedInner(m[1]) ? m[1] : `−(${s.expression})`;
      }
      return withUndo(s, { ...NO_RESULT, expression: expr });
    }
    case 'toggleAngle': return { ...s, angle: s.angle === 'deg' ? 'rad' : 'deg' };
    case 'toggleFraction': return { ...s, showFraction: !s.showFraction };
    case 'undo': {
      const prev = s.undoStack[s.undoStack.length - 1];
      return prev ? refresh({ ...s, ...prev, undoStack: s.undoStack.slice(0, -1) }) : s;
    }
    case 'setAngle': return { ...s, angle: a.angle };
    case 'setExpression': {
      const text = a.text.slice(0, MAX_LENGTH);
      return withUndo(s, { ...NO_RESULT, expression: text });
    }
    case 'historyDelete': return { ...s, history: s.history.filter((h) => h.id !== a.id) };
    case 'historySet': return { ...s, history: a.history.slice(0, MAX_HISTORY) };
    case 'historyClear': return s.history.length ? { ...s, history: [] } : s;
    case 'setSettings': {
      const settings = { ...s.settings, ...a.patch };
      const d = settings.decimals;
      if (d !== null && !(Number.isInteger(d) && d >= 0 && d <= MAX_DECIMALS)) settings.decimals = s.settings.decimals;
      if (settings.decimalSep !== '.' && settings.decimalSep !== ',') settings.decimalSep = s.settings.decimalSep;
      return refresh({ ...s, settings });
    }
    case 'memClear': return s.memory ? { ...s, memory: null } : s;
    case 'memRecall':
      if (!s.memory) return withUndo(s, { ...NO_RESULT, error: 'Bộ nhớ đang trống.' });
      return reducer(s, { type: 'input', text: 'M' });
    case 'memStore': case 'memAdd': case 'memSub': {
      const cur = currentValue(s);
      if ('error' in cur) return withUndo(s, { ...NO_RESULT, error: cur.error });
      const op = a.type;
      const base: MemoryValue = s.memory ?? { value: 0, exact: { n: 0n, d: 1n } };
      let next: MemoryValue;
      if (op === 'memStore') next = cur;
      else {
        const value = op === 'memAdd' ? base.value + cur.value : base.value - cur.value;
        if (!Number.isFinite(value)) return withUndo(s, { ...NO_RESULT, error: 'Kết quả vượt giới hạn biểu diễn.' });
        const exact = base.exact && cur.exact ? (op === 'memAdd' ? fracAdd : fracSub)(base.exact, cur.exact) : null;
        next = { value, exact };
      }
      return { ...s, memory: next };
    }
  }
}

const evalOpts = (s: CalcState) => ({
  ans: s.ans, ansExact: s.ansExact, mem: s.memory?.value ?? null, memExact: s.memory?.exact ?? null,
  angleMode: s.angle, autoCloseParens: true,
});

/** Giá trị hiện tại để lưu vào bộ nhớ: kết quả vừa tính, hoặc giá trị biểu thức đang gõ. */
function currentValue(s: CalcState): MemoryValue | { error: string } {
  if (s.justEvaluated && s.ans !== null) return { value: s.ans, exact: s.ansExact };
  if (s.expression === '') return { error: 'Chưa có giá trị để đưa vào bộ nhớ.' };
  const r = evaluate(s.expression, evalOpts(s));
  return r.ok ? { value: r.value, exact: r.exact } : { error: r.error.message };
}

/** Định dạng kết quả để hiển thị (giá trị nội bộ không bị làm tròn). */
export function renderResult(value: number, exact: Frac | null, decimals: number | null) {
  let kind: ResultKind = 'real';
  let fraction: string | null = null;
  let f = formatNumber(value, { decimals });
  if (exact) {
    if (exact.d === 1n) {
      kind = 'integer';
      const digits = exact.n.toString();
      if (digits.replace('-', '').length <= 30)
        f = { text: decimals ? `${digits}.${'0'.repeat(decimals)}` : digits, approximate: false };
    } else {
      const frac = `${exact.n}/${exact.d}`;
      if (frac.length <= 40) { kind = 'fraction'; fraction = frac; }
    }
  }
  return { result: f.text, approximate: f.approximate, kind, fraction };
}
/** Tính lại chuỗi kết quả khi đổi cài đặt số chữ số thập phân hoặc sau hoàn tác. */
function refresh(s: CalcState): CalcState {
  if (s.result === null || s.ans === null) return s;
  const { result, approximate } = renderResult(s.ans, s.ansExact, s.settings.decimals);
  return { ...s, result, approximate };
}

/** Mọi thứ màn hình cần hiển thị (thuần, có test). */
export interface Display {
  error: string | null;
  main: string;
  approximate: boolean;
  dim: boolean;
  secondary: string | null;
  kindLabel: string | null;
  info: string | null;
}
const KIND_LABEL = { integer: 'Số nguyên', fraction: 'Phân số chính xác' } as const;

export function getDisplay(s: CalcState): Display {
  const sep = s.settings.decimalSep;
  const base: Display = { error: null, main: '0', approximate: false, dim: true, secondary: null, kindLabel: null, info: null };
  if (s.error) return { ...base, error: s.error, main: '' };
  if (s.result !== null && s.kind) {
    const out: Display = { ...base, main: s.result, approximate: s.approximate, dim: false };
    if (s.kind === 'fraction' && s.fraction) {
      if (s.showFraction) {
        out.main = s.fraction; out.approximate = false;
        out.secondary = `${s.approximate ? '≈' : '='} ${s.result}`;
      } else out.secondary = `= ${s.fraction}`;
    }
    out.kindLabel = s.kind === 'real' ? (s.approximate ? 'Số thực gần đúng' : 'Số thực') : KIND_LABEL[s.kind];
    if (s.kind === 'integer' && s.ansExact) out.info = describeInteger(s.ansExact.n);
    out.main = displayNumber(out.main, sep);
    if (out.secondary) out.secondary = displayNumber(out.secondary, sep);
    return out;
  }
  const p = getPreview(s);
  return p ? { ...base, main: displayNumber(p.text, sep), approximate: p.approximate } : base;
}

/** Kết quả xem trước khi đang gõ (ẩn nếu biểu thức lỗi hoặc chỉ là một số). */
export function getPreview(s: CalcState): { text: string; approximate: boolean } | null {
  if (s.expression === '' || s.justEvaluated || /^[\d.]+$/.test(s.expression)) return null;
  const r = evaluate(s.expression, evalOpts(s));
  return r.ok ? formatNumber(r.value, { decimals: s.settings.decimals }) : null;
}

/** Số/kết quả: đổi dấu thập phân "." thành dấu đã chọn (chỉ khi hiển thị). */
export function displayNumber(text: string, sep: DecimalSep): string {
  return sep === '.' ? text : text.replace(/\./g, ',');
}
/** Biểu thức: với dấu thập phân "," thì dấu ngăn cách đối số hiển thị là ";" (bên trong vẫn là ","). */
export function displayExpression(expr: string, sep: DecimalSep): string {
  return sep === '.' ? expr : expr.replace(/[.,]/g, (c) => (c === '.' ? ',' : ';'));
}

/** Văn bản số của một bản ghi lịch sử để chèn vào biểu thức mới (giữ chính xác với phân số). */
export function resultLiteral(h: HistoryEntry): string {
  if (h.kind === 'fraction' && h.fraction) return h.fraction.startsWith('-') ? `(−${h.fraction.slice(1)})` : `(${h.fraction})`;
  const m = /^(-?)([\d.]+)e([+-]\d+)$/.exec(h.result);
  if (m) return `(${m[1] ? '−' : ''}${m[2]}×10^(${m[3].replace('-', '−')}))`;
  return h.result.startsWith('-') ? `(−${h.result.slice(1)})` : h.result;
}

/** Tìm trong lịch sử theo biểu thức, kết quả hoặc phân số (không phân biệt hoa thường). */
export function searchHistory(list: HistoryEntry[], query: string): HistoryEntry[] {
  const q = query.trim().toLowerCase().replace(/,/g, '.').replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
  if (q === '') return list;
  return list.filter((h) => [h.expr, h.result, h.fraction ?? ''].some((t) => t.toLowerCase().replace(/-/g, '−').replace(/\//g, '÷').includes(q)));
}
