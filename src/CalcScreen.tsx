import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { formatNumber } from './engine/index.ts';
import { displayExpression, displayNumber, getDisplay } from './calculatorState.ts';
import type { Action, CalcState, DecimalSep } from './calculatorState.ts';
import { FN_KEYS, FN_TABS, MAIN, QUICK_TRIES, fnHint } from './keys.ts';
import type { FnTab, KeyDef } from './keys.ts';
import { IconChevron, IconCopy, IconFormula, IconUndo } from './Icons.tsx';
import { Seg } from './Seg.tsx';

interface Props {
  state: CalcState;
  dispatch: (a: Action) => void;
  sep: DecimalSep;
  fnTab: FnTab;
  setFnTab: (t: FnTab) => void;
  fnOpen: boolean;
  setFnOpen: (open: boolean) => void;
  onCopy: () => void;
  onGoFormulas: () => void;
  showIntro: boolean;
  onDismissIntro: () => void;
}

export default function CalcScreen(p: Props) {
  const { state, dispatch, sep } = p;
  const exprRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (exprRef.current) exprRef.current.scrollLeft = exprRef.current.scrollWidth;
  }, [state.expression]);

  const press = (action: Action) => (e: MouseEvent<HTMLButtonElement>) => {
    dispatch(action);
    if (e.detail > 0) e.currentTarget.blur(); // chuột/cảm ứng: trả phím Enter về cho nút "="
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

  const d = getDisplay(state);
  const memText = state.memory
    ? displayNumber(formatNumber(state.memory.value, { decimals: state.settings.decimals }).text, sep) : null;
  const empty = state.expression === '' && state.result === null && !d.error;

  return (
    <div className="calc-screen">
      {p.showIntro && (
        <section className="intro" aria-label="Hướng dẫn nhanh">
          <h2>Bắt đầu nhanh</h2>
          <ol>
            <li>Gõ phép tính bằng các phím số, rồi bấm <b>=</b> để xem kết quả.</li>
            <li>Cần sin, cos, log, căn…? Chọn nhóm hàm ngay phía trên bàn phím.</li>
            <li>Muốn tra hằng đẳng thức, công thức lượng giác hay diện tích? Mở <b>Công thức</b> ở thanh dưới.</li>
          </ol>
          <button type="button" className="btn primary" onClick={p.onDismissIntro}>Đã hiểu</button>
        </section>
      )}

      <div className="toolbar">
        <div className="tool-group">
          <span className="lbl">Góc</span>
          <Seg value={state.angle} label="Đơn vị góc" onChange={(angle) => dispatch({ type: 'setAngle', angle })}
            options={[{ value: 'deg', label: 'Độ' }, { value: 'rad', label: 'Radian' }]} />
        </div>
        <div className="tool-group">
          <button type="button" className="tbtn" onClick={() => dispatch({ type: 'undo' })} disabled={state.undoStack.length === 0}>
            <IconUndo />Hoàn tác
          </button>
          <button type="button" className="tbtn" onClick={p.onCopy} disabled={state.result === null} aria-label="Sao chép kết quả">
            <IconCopy />Sao chép
          </button>
        </div>
      </div>

      <div className="lcd">
        <div className="lcd-top">
          <span className="mode" aria-hidden="true">{state.angle === 'deg' ? 'DEG' : 'RAD'}</span>
          {memText !== null && <span className="mode" title={`Bộ nhớ: ${memText}`}>M</span>}
          <div className="expr" ref={exprRef} aria-label="Biểu thức">{displayExpression(state.expression, sep) || ' '}</div>
        </div>
        {d.error ? (
          <div className="out error" role="alert">{d.error}</div>
        ) : (
          <div aria-live="polite">
            {empty && <div className="placeholder">Nhập phép tính rồi bấm =</div>}
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
      {memText !== null && <div className="meta" aria-live="polite">{`Bộ nhớ M = ${memText}`}</div>}

      {empty && (
        <div className="tries" role="group" aria-label="Phép tính mẫu">
          <span className="lbl">Thử:</span>
          <div className="tries-list">
            {QUICK_TRIES.map((t) => (
              <button key={t} type="button" className="chip" onClick={() => dispatch({ type: 'setExpression', text: t })}>
                {displayExpression(t, sep)}
              </button>
            ))}
            <button type="button" className="chip accent" onClick={p.onGoFormulas}><IconFormula />Công thức</button>
          </div>
        </div>
      )}

      <section className="fn" aria-label="Hàm khoa học">
        <div className="fn-head">
          <div className="tabs" role="tablist" aria-label="Nhóm hàm">
            {FN_TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={p.fnTab === t.id}
                className={`tab${p.fnTab === t.id ? ' on' : ''}`}
                onClick={() => { p.setFnTab(t.id); p.setFnOpen(true); }}>{t.label}</button>
            ))}
          </div>
          <button type="button" className="fn-toggle" aria-expanded={p.fnOpen} aria-label={p.fnOpen ? 'Thu gọn các phím hàm' : 'Mở các phím hàm'}
            onClick={() => p.setFnOpen(!p.fnOpen)}>
            <IconChevron className={p.fnOpen ? 'up' : ''} />
          </button>
        </div>
        {p.fnOpen && (
          <>
            <p className="fn-hint">{fnHint(p.fnTab, state.angle)}</p>
            <div className="pad fn-pad" role="tabpanel">{FN_KEYS[p.fnTab].map(renderKey)}</div>
          </>
        )}
      </section>

      <div className="pad main-pad">{MAIN.map(renderKey)}</div>
    </div>
  );
}
