import { useEffect, useReducer, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { formatNumber } from './engine/index.ts';
import {
  createInitialState, displayExpression, displayNumber, getDisplay, MAX_DECIMALS, reducer, resultLiteral, searchHistory,
} from './calculatorState.ts';
import type { Action, CalcState, DecimalSep, HistoryEntry, Settings, Theme } from './calculatorState.ts';
import GraphPanel from './GraphPanel.tsx';
import { exportHistory, loadPersisted, MAX_BACKUP_CHARS, mergeHistory, parseHistoryImport, savePersisted } from './storage.ts';
import type { KV } from './storage.ts';

interface KeyDef { label: string; aria: string; action: Action; kind: 'num' | 'op' | 'fn' | 'eq' | 'util' | 'mem'; wide?: boolean }
const ins = (text: string): Action => ({ type: 'input', text });
const k = (label: string, aria: string, action: Action, kind: KeyDef['kind'], wide = false): KeyDef => ({ label, aria, action, kind, wide });
const num = (d: string) => k(d, d, ins(d), 'num');

const MEM: KeyDef[] = [
  k('MC', 'Xóa bộ nhớ (MC)', { type: 'memClear' }, 'mem'), k('MR', 'Gọi bộ nhớ (MR): chèn M vào biểu thức', { type: 'memRecall' }, 'mem'),
  k('M+', 'Cộng giá trị hiện tại vào bộ nhớ (M+)', { type: 'memAdd' }, 'mem'),
  k('M−', 'Trừ giá trị hiện tại khỏi bộ nhớ (M−)', { type: 'memSub' }, 'mem'),
  k('MS', 'Lưu giá trị hiện tại vào bộ nhớ (MS)', { type: 'memStore' }, 'mem'),
];
const MAIN: KeyDef[] = [
  k('AC', 'Xóa tất cả', { type: 'clear' }, 'util'), k('⌫', 'Xóa ký tự cuối', { type: 'backspace' }, 'util'),
  k('(', 'Mở ngoặc', ins('('), 'fn'), k(')', 'Đóng ngoặc', ins(')'), 'fn'), k('÷', 'Chia', ins('÷'), 'op'),
  num('7'), num('8'), num('9'), k('%', 'Phần trăm', ins('%'), 'fn'), k('×', 'Nhân', ins('×'), 'op'),
  num('4'), num('5'), num('6'), k('±', 'Đổi dấu', { type: 'negate' }, 'fn'), k('−', 'Trừ', ins('−'), 'op'),
  num('1'), num('2'), num('3'), k('Ans', 'Kết quả trước', ins('Ans'), 'fn'), k('+', 'Cộng', ins('+'), 'op'),
  { ...num('0'), wide: true }, num('.'), { ...k('=', 'Bằng', { type: 'equals' }, 'eq'), wide: true },
];
const fn = (label: string, aria: string, text: string) => k(label, aria, ins(text), 'fn');
type Tab = 'basic' | 'trig' | 'log' | 'arith' | 'comb';
const TABS: { id: Tab; label: string }[] = [
  { id: 'basic', label: 'Cơ bản' }, { id: 'trig', label: 'Lượng giác' },
  { id: 'log', label: 'Log & mũ' }, { id: 'arith', label: 'Số học' }, { id: 'comb', label: 'Tổ hợp' },
];
const SCI: Record<Tab, KeyDef[]> = {
  basic: [
    fn('x²', 'Bình phương', '^2'), fn('x³', 'Lập phương', '^3'), fn('xʸ', 'Lũy thừa', '^'), fn('1/x', 'Nghịch đảo', '^(−1)'),
    fn('√', 'Căn bậc hai', '√('), fn('∛', 'Căn bậc ba', 'cbrt('), fn('ⁿ√', 'Căn bậc n: root(n, x)', 'root('), fn('|x|', 'Giá trị tuyệt đối', 'abs('),
    fn('n!', 'Giai thừa', '!'), fn('π', 'Số pi', 'π'), fn('e', 'Số e', 'e'), fn(',', 'Dấu phẩy ngăn cách đối số', ','),
  ],
  trig: [
    fn('sin', 'Sin', 'sin('), fn('cos', 'Cos', 'cos('), fn('tan', 'Tan', 'tan('), fn('π', 'Số pi', 'π'),
    fn('sin⁻¹', 'Arcsin', 'asin('), fn('cos⁻¹', 'Arccos', 'acos('), fn('tan⁻¹', 'Arctan', 'atan('), fn(',', 'Dấu phẩy', ','),
    fn('sinh', 'Sinh', 'sinh('), fn('cosh', 'Cosh', 'cosh('), fn('tanh', 'Tanh', 'tanh('), fn('(', 'Mở ngoặc', '('),
    fn('sinh⁻¹', 'Arsinh', 'asinh('), fn('cosh⁻¹', 'Arcosh', 'acosh('), fn('tanh⁻¹', 'Artanh', 'atanh('), fn(')', 'Đóng ngoặc', ')'),
  ],
  log: [
    fn('log', 'Logarit cơ số 10', 'log('), fn('ln', 'Logarit tự nhiên', 'ln('), fn('logₐ', 'Logarit cơ số tùy chỉnh: logb(cơ số, x)', 'logb('), fn('eˣ', 'Hàm mũ exp', 'exp('),
    fn('10ˣ', 'Mười mũ x', '10^'), fn('2ˣ', 'Hai mũ x', '2^'), fn('e^', 'e mũ', 'e^'), fn('xʸ', 'Lũy thừa', '^'),
    fn('e', 'Số e', 'e'), fn('π', 'Số pi', 'π'), fn(',', 'Dấu phẩy', ','), fn('√', 'Căn bậc hai', '√('),
  ],
  arith: [
    fn('gcd', 'Ước chung lớn nhất', 'gcd('), fn('lcm', 'Bội chung nhỏ nhất', 'lcm('), fn('mod', 'Chia lấy dư', 'mod('), fn(',', 'Dấu phẩy', ','),
    fn('⌊x⌋', 'Phần nguyên (floor)', 'floor('), fn('⌈x⌉', 'Làm tròn lên (ceil)', 'ceil('), fn('round', 'Làm tròn', 'round('), fn('frac', 'Phần lẻ', 'frac('),
    fn('n!', 'Giai thừa', '!'), fn('|x|', 'Giá trị tuyệt đối', 'abs('), fn('a/b', 'Nhập phân số a/b', '÷'),
    k('⇄', 'Chuyển đổi phân số và số thập phân', { type: 'toggleFraction' }, 'fn'),
  ],
  comb: [
    fn('nPr', 'Chỉnh hợp nPr(n, k)', 'nPr('), fn('nCr', 'Tổ hợp nCr(n, k)', 'nCr('), fn('n!', 'Hoán vị n! (giai thừa)', '!'), fn(',', 'Dấu ngăn cách đối số', ','),
    fn('P(m,n)', 'Xác suất m trường hợp thuận lợi trên n: prob(m, n)', 'prob('), fn('binom', 'Xác suất nhị thức: binom(n, k, p)', 'binom('),
    fn('(', 'Mở ngoặc', '('), fn(')', 'Đóng ngoặc', ')'),
  ],
};

const KEYMAP: Record<string, Action> = {
  '+': ins('+'), '-': ins('−'), '*': ins('×'), '/': ins('÷'), '^': ins('^'), '(': ins('('), ')': ins(')'),
  '!': ins('!'), '%': ins('%'), '.': ins('.'), ',': ins(','), ';': ins(','), '=': { type: 'equals' },
  Backspace: { type: 'backspace' }, Escape: { type: 'clear' },
};

function getStorage(): KV | null {
  try { return window.localStorage; } catch { return null; }
}
function initState(): CalcState {
  const p = loadPersisted(getStorage());
  if (p.settings.theme === null) { // đọc khóa 'theme' cũ của giai đoạn trước
    try {
      const old = localStorage.getItem('theme');
      if (old === 'light' || old === 'dark') p.settings.theme = old;
    } catch { /* bỏ qua */ }
  }
  return createInitialState(p);
}
function systemTheme(): Theme {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
}
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}
const fmtTime = (t: number) => new Date(t).toLocaleString('vi-VN', { hour12: false, dateStyle: 'short', timeStyle: 'medium' });
const histResult = (h: HistoryEntry, sep: DecimalSep) => `${h.approximate ? '≈ ' : ''}${displayNumber(h.result, sep)}`;

type View = 'calc' | 'history' | 'settings' | 'graph';

function HistoryPanel({ state, dispatch, onUse, onNotice }: {
  state: CalcState; dispatch: (a: Action) => void; onUse: (a: Action) => void; onNotice: (m: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const sep = state.settings.decimalSep;
  const list = searchHistory(state.history, query);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const doImport = (raw: string) => {
    const r = parseHistoryImport(raw);
    if (!r.ok) { onNotice(r.error); return; }
    const m = mergeHistory(state.history, r.entries);
    dispatch({ type: 'historySet', history: m.history });
    onNotice(`Đã nhập ${m.added} bản ghi mới${r.skipped ? `, bỏ qua ${r.skipped} bản ghi lỗi` : ''}.`);
    setPasteOpen(false); setPasteText('');
  };
  const exportFile = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportHistory(state.history)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `lich-su-may-tinh-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      onNotice('Đã tạo file sao lưu. Nếu máy không tải được file, dùng “Sao chép sao lưu”.');
    } catch { onNotice('Không tạo được file. Hãy dùng “Sao chép sao lưu”.'); }
  };
  const exportCopy = async () =>
    onNotice((await copyText(exportHistory(state.history))) ? 'Đã sao chép bản sao lưu. Dán vào ghi chú để giữ.' : 'Không sao chép được.');
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_BACKUP_CHARS) { onNotice('File quá lớn để là bản sao lưu lịch sử.'); return; }
    try { doImport(await f.text()); } catch { onNotice('Không đọc được file.'); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const copy = async (h: HistoryEntry) =>
    onNotice((await copyText(`${displayExpression(h.expr, sep)} = ${displayNumber(h.result, sep)}`)) ? 'Đã sao chép.' : 'Không sao chép được.');
  return (
    <section className="panel" aria-label="Lịch sử tính toán">
      <div className="panel-head">
        <h2>Lịch sử ({state.history.length})</h2>
        {state.history.length > 0 && !confirmAll && (
          <button type="button" className="chip danger" onClick={() => setConfirmAll(true)}>Xóa tất cả</button>
        )}
      </div>
      {confirmAll && (
        <div className="confirm" role="alertdialog" aria-label="Xác nhận xóa lịch sử">
          <span>Xóa toàn bộ {state.history.length} bản ghi? Không thể hoàn tác.</span>
          <button type="button" className="chip danger" onClick={() => { dispatch({ type: 'historyClear' }); setConfirmAll(false); }}>Xóa</button>
          <button type="button" className="chip" onClick={() => setConfirmAll(false)}>Hủy</button>
        </div>
      )}
      <div className="backup-row" role="group" aria-label="Sao lưu lịch sử">
        <button type="button" className="chip" disabled={state.history.length === 0} onClick={exportFile}>Lưu file sao lưu</button>
        <button type="button" className="chip" disabled={state.history.length === 0} onClick={() => void exportCopy()}>Sao chép sao lưu</button>
        <button type="button" className="chip" onClick={() => fileRef.current?.click()}>Nhập từ file</button>
        <button type="button" className="chip" onClick={() => setPasteOpen((v) => !v)} aria-expanded={pasteOpen}>Dán sao lưu</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Chọn file sao lưu" onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {pasteOpen && (
        <div className="confirm">
          <textarea className="field" rows={4} placeholder="Dán nội dung sao lưu (JSON) vào đây…" aria-label="Nội dung sao lưu"
            value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
          <button type="button" className="chip" onClick={() => doImport(pasteText)}>Nhập</button>
          <button type="button" className="chip" onClick={() => { setPasteOpen(false); setPasteText(''); }}>Hủy</button>
        </div>
      )}
      <input type="search" className="field" placeholder="Tìm biểu thức hoặc kết quả…" aria-label="Tìm trong lịch sử"
        value={query} onChange={(e) => setQuery(e.target.value)} />
      {state.history.length === 0 ? <p className="empty">Chưa có phép tính nào. Bấm “=” để lưu vào lịch sử.</p>
        : list.length === 0 ? <p className="empty">Không có bản ghi nào khớp “{query}”.</p>
        : (
          <ul className="hist">
            {list.map((h) => (
              <li key={h.id} className="hist-item">
                <div className="hist-expr">{displayExpression(h.expr, sep)}</div>
                <div className="hist-res">= {histResult(h, sep)}{h.kind === 'fraction' && h.fraction ? <span className="hist-sub"> ({h.fraction})</span> : null}</div>
                <div className="hist-time">{fmtTime(h.time)}</div>
                <div className="hist-actions">
                  <button type="button" className="chip" onClick={() => onUse({ type: 'setExpression', text: h.expr })}>Dùng biểu thức</button>
                  <button type="button" className="chip" onClick={() => onUse({ type: 'input', text: resultLiteral(h) })}>Dùng kết quả</button>
                  <button type="button" className="chip" onClick={() => void copy(h)}>Sao chép</button>
                  <button type="button" className="chip danger" aria-label={`Xóa bản ghi ${h.expr}`}
                    onClick={() => dispatch({ type: 'historyDelete', id: h.id })}>Xóa</button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

function SettingsPanel({ state, dispatch, saveOk }: { state: CalcState; dispatch: (a: Action) => void; saveOk: boolean }) {
  const st = state.settings;
  const set = (patch: Partial<Settings>) => dispatch({ type: 'setSettings', patch });
  const decimals = Array.from({ length: MAX_DECIMALS + 1 }, (_, i) => i);
  return (
    <section className="panel" aria-label="Cài đặt">
      <h2>Cài đặt</h2>
      <label className="row">Số chữ số thập phân
        <select className="field" value={st.decimals === null ? 'auto' : String(st.decimals)}
          onChange={(e) => set({ decimals: e.target.value === 'auto' ? null : Number(e.target.value) })}>
          <option value="auto">Tự động (tối đa 12 chữ số có nghĩa)</option>
          {decimals.map((d) => <option key={d} value={d}>{d} chữ số sau dấu thập phân</option>)}
        </select>
      </label>
      <label className="row">Dấu thập phân
        <select className="field" value={st.decimalSep} onChange={(e) => set({ decimalSep: e.target.value as DecimalSep })}>
          <option value=".">Dấu chấm (3.14), ngăn đối số bằng “,”</option>
          <option value=",">Dấu phẩy (3,14), ngăn đối số bằng “;”</option>
        </select>
      </label>
      <label className="row">Giao diện
        <select className="field" value={st.theme ?? 'system'}
          onChange={(e) => set({ theme: e.target.value === 'system' ? null : (e.target.value as Theme) })}>
          <option value="system">Theo hệ thống</option><option value="light">Sáng</option><option value="dark">Tối</option>
        </select>
      </label>
      <label className="row">Đơn vị góc
        <select className="field" value={state.angle} onChange={(e) => dispatch({ type: 'setAngle', angle: e.target.value as 'deg' | 'rad' })}>
          <option value="deg">Độ (DEG)</option><option value="rad">Radian (RAD)</option>
        </select>
      </label>
      <p className="note">{saveOk
        ? 'Bộ nhớ, lịch sử và cài đặt được lưu tự động trên thiết bị này.'
        : 'Không lưu được dữ liệu trên thiết bị này (trình duyệt đang chặn lưu trữ). Dữ liệu sẽ mất khi đóng ứng dụng.'}</p>
    </section>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [sciOpen, setSciOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('basic');
  const [view, setView] = useState<View>('calc');
  const [notice, setNotice] = useState('');
  const [saveOk, setSaveOk] = useState(true);
  const exprRef = useRef<HTMLDivElement>(null);
  const sep = state.settings.decimalSep;
  const theme: Theme = state.settings.theme ?? systemTheme();

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  useEffect(() => { setSaveOk(savePersisted(getStorage(), state)); },
    [state.memory, state.history, state.settings, state.angle]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (exprRef.current) exprRef.current.scrollLeft = exprRef.current.scrollWidth;
  }, [state.expression]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (view !== 'calc') { if (e.key === 'Escape' && (e.target as HTMLElement | null)?.tagName !== 'CANVAS') setView('calc'); return; } // Esc đóng Lịch sử/Cài đặt
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const onButton = tag === 'BUTTON';
      let action: Action | undefined;
      if (/^[0-9]$/.test(e.key)) action = ins(e.key);
      else if (/^[a-zA-Z]$/.test(e.key)) action = ins(e.key);
      else if (e.key === 'Enter') { if (onButton) return; action = { type: 'equals' }; }
      else if (e.key === ',' && sep === ',') action = ins('.'); // dấu phẩy thập phân
      else action = KEYMAP[e.key];
      if (!action) return;
      e.preventDefault();
      dispatch(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, sep]);

  const press = (action: Action) => (e: MouseEvent<HTMLButtonElement>) => {
    dispatch(action);
    if (e.detail > 0) e.currentTarget.blur(); // chuột/cảm ứng: trả Enter về cho phím "="
  };
  const labelOf = (key: KeyDef) => {
    if (key.action.type !== 'input') return key.label;
    if (key.action.text === '.' && key.label === '.') return sep;
    if (key.action.text === ',' && key.label === ',') return sep === ',' ? ';' : ',';
    return key.label;
  };
  const renderKey = (key: KeyDef) => (
    <button key={key.aria + key.label} type="button" className={`key ${key.kind}${key.wide ? ' wide' : ''}`}
      aria-label={key.aria} onClick={press(key.action)}>{labelOf(key)}</button>
  );
  const toggleView = (v: View) => setView(view === v ? 'calc' : v);
  const useFromHistory = (a: Action) => { dispatch(a); setView('calc'); };
  const copyResult = async () => {
    if (state.result === null) return;
    setNotice((await copyText(displayNumber(state.showFraction && state.fraction ? state.fraction : state.result, sep))) ? 'Đã sao chép kết quả.' : 'Không sao chép được.');
  };

  const d = getDisplay(state);
  const memText = state.memory
    ? displayNumber(formatNumber(state.memory.value, { decimals: state.settings.decimals }).text, sep) : null;

  return (
    <main className="app">
      <section className="calc" aria-label="Máy tính khoa học">
        <header className="bar">
          <h1>Máy tính khoa học</h1>
          <div className="bar-actions">
            <button type="button" className="chip mode-chip" onClick={() => dispatch({ type: 'toggleAngle' })}
              aria-label={`Chế độ góc: ${state.angle === 'deg' ? 'độ (DEG)' : 'radian (RAD)'}. Bấm để đổi`}>
              {state.angle === 'deg' ? 'DEG' : 'RAD'}
            </button>
            <button type="button" className="chip" onClick={() => dispatch({ type: 'undo' })}
              disabled={state.undoStack.length === 0}>Hoàn tác</button>
            <button type="button" className="chip" aria-pressed={view === 'graph'} onClick={() => toggleView('graph')}>Đồ thị</button>
            <button type="button" className="chip" aria-pressed={view === 'history'} onClick={() => toggleView('history')}>Lịch sử</button>
            <button type="button" className="chip" aria-pressed={view === 'settings'} onClick={() => toggleView('settings')}>Cài đặt</button>
          </div>
        </header>
        <div className="lcd">
          <div className="lcd-top">
            <span className="mode" aria-hidden="true">{state.angle === 'deg' ? 'DEG' : 'RAD'}</span>
            {memText !== null && <span className="mode" title={`Bộ nhớ: ${memText}`}>M</span>}
            <div className="expr" ref={exprRef} aria-label="Biểu thức">{displayExpression(state.expression, sep) || ' '}</div>
          </div>
          {d.error ? (
            <div className="out error" role="alert">{d.error}</div>
          ) : (
            <div aria-live="polite">
              <div className={`out${d.dim ? ' dim' : ''}`}>
                {d.approximate && <span className="approx" title="Kết quả gần đúng" aria-label="gần đúng">≈ </span>}
                {d.main}
              </div>
              {d.secondary && <div className="sub">{d.secondary}</div>}
              {d.kindLabel && <div className="kind">{d.kindLabel}</div>}
              {d.info && <div className="kind">{d.info}</div>}
            </div>
          )}
        </div>
        <div className="meta" aria-live="polite">
          <span className="memo">{notice || (memText !== null ? `Bộ nhớ M = ${memText}` : 'Bộ nhớ trống')}</span>
          {state.result !== null && <button type="button" className="chip small" onClick={() => void copyResult()}>Sao chép kết quả</button>}
        </div>
        {view === 'history' && (
          <HistoryPanel state={state} dispatch={dispatch} onUse={useFromHistory} onNotice={setNotice} />
        )}
        {view === 'graph' && <GraphPanel theme={theme} sep={sep} />}
        {view === 'settings' && <SettingsPanel state={state} dispatch={dispatch} saveOk={saveOk} />}
        {view === 'calc' && (
          <>
            <button type="button" className="sci-toggle" aria-expanded={sciOpen} aria-controls="sci"
              onClick={() => setSciOpen(!sciOpen)}>{sciOpen ? 'Thu gọn hàm khoa học' : 'Hàm khoa học'}</button>
            {sciOpen && (
              <div id="sci" className="sci-wrap">
                <div className="tabs" role="tablist" aria-label="Nhóm hàm">
                  {TABS.map((t) => (
                    <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                      className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
                  ))}
                </div>
                <div className="pad sci" role="tabpanel">{SCI[tab].map(renderKey)}</div>
              </div>
            )}
            <div className="pad mem">{MEM.map(renderKey)}</div>
            <div className="pad">{MAIN.map(renderKey)}</div>
          </>
        )}
      </section>
    </main>
  );
}
