import { useRef, useState } from 'react';
import { displayExpression, displayNumber, resultLiteral, searchHistory } from './calculatorState.ts';
import type { Action, CalcState, DecimalSep, HistoryEntry } from './calculatorState.ts';
import { exportHistory, MAX_BACKUP_CHARS, mergeHistory, parseHistoryImport } from './storage.ts';
import { copyText } from './util.ts';

const fmtTime = (t: number) => new Date(t).toLocaleString('vi-VN', { hour12: false, dateStyle: 'short', timeStyle: 'medium' });
const histResult = (h: HistoryEntry, sep: DecimalSep) => `${h.approximate ? '≈ ' : ''}${displayNumber(h.result, sep)}`;

export default function HistoryView({ state, dispatch, onUse, onNotice }: {
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
    <section className="panel history" aria-label="Lịch sử tính toán">
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
      <details className="backup">
        <summary>Sao lưu và khôi phục lịch sử</summary>
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
      </details>
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
