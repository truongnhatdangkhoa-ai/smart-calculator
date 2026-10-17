import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { compile, evaluate } from './engine/index.ts';
import type { AngleMode } from './engine/index.ts';
import {
  analyze, autoYRange, DEFAULT_VIEW, describeAnalysis, DISCLAIMER, panView, pickPoint, sample, ticks, validateView, zoomView,
} from './graph.ts';
import type { Analysis, View } from './graph.ts';

const fmtN = (n: number): string => {
  if (n === 0) return '0';
  const a = Math.abs(n);
  return a < 1e-4 || a >= 1e7 ? n.toExponential(3).replace(/\.?0+e/, 'e') : String(Number(n.toPrecision(6)));
};
const VIEW_KEYS = ['xmin', 'xmax', 'ymin', 'ymax'] as const;
const VIEW_LABEL: Record<(typeof VIEW_KEYS)[number], string> = { xmin: 'x nhỏ nhất', xmax: 'x lớn nhất', ymin: 'y nhỏ nhất', ymax: 'y lớn nhất' };

interface Colors { bg: string; ink: string; line: string; curve: string; accent: string }
function readColors(): Colors {
  const cs = getComputedStyle(document.documentElement);
  const g = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return { bg: g('--key', '#fff'), ink: g('--ink', '#000'), line: g('--line', 'rgba(0,0,0,.14)'), curve: g('--focus', '#2563eb'), accent: g('--accent', '#e39b1f') };
}

function draw(c: HTMLCanvasElement, w: number, h: number, view: View, an: Analysis | null, picked: { x: number; y: number | null } | null, col: Colors) {
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const X = (x: number) => ((x - view.xmin) / (view.xmax - view.xmin)) * w;
  const Y = (y: number) => h - ((y - view.ymin) / (view.ymax - view.ymin)) * h;
  ctx.fillStyle = col.bg; ctx.fillRect(0, 0, w, h);
  ctx.font = '11px system-ui, sans-serif';
  // lưới
  ctx.lineWidth = 1; ctx.strokeStyle = col.line; ctx.fillStyle = col.ink; ctx.globalAlpha = 1;
  const tx = ticks(view.xmin, view.xmax, Math.max(3, Math.floor(w / 60)));
  const ty = ticks(view.ymin, view.ymax, Math.max(3, Math.floor(h / 50)));
  ctx.beginPath();
  for (const t of tx) { const px = Math.round(X(t)) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, h); }
  for (const t of ty) { const py = Math.round(Y(t)) + 0.5; ctx.moveTo(0, py); ctx.lineTo(w, py); }
  ctx.stroke();
  // trục
  ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5; ctx.beginPath();
  const ax = X(0), ay = Y(0);
  if (ax >= 0 && ax <= w) { ctx.moveTo(ax, 0); ctx.lineTo(ax, h); }
  if (ay >= 0 && ay <= h) { ctx.moveTo(0, ay); ctx.lineTo(w, ay); }
  ctx.stroke();
  // nhãn
  const lx = Math.min(Math.max(ax + 4, 2), w - 40), ly = Math.min(Math.max(ay + 13, 12), h - 4);
  ctx.textAlign = 'center';
  for (const t of tx) if (t !== 0) ctx.fillText(fmtN(t), Math.min(Math.max(X(t), 14), w - 14), ly);
  ctx.textAlign = 'left';
  for (const t of ty) if (t !== 0) ctx.fillText(fmtN(t), lx, Math.min(Math.max(Y(t) - 3, 11), h - 2));
  // đường cong
  if (an) {
    ctx.strokeStyle = col.curve; ctx.fillStyle = col.curve; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    const cl = (v: number) => Math.max(-1e5, Math.min(h + 1e5, v));
    for (const seg of an.segments) {
      if (seg.length === 1) { ctx.beginPath(); ctx.arc(X(seg[0].x), cl(Y(seg[0].y)), 1.5, 0, 7); ctx.fill(); continue; }
      ctx.beginPath();
      seg.forEach((p, i) => (i ? ctx.lineTo(X(p.x), cl(Y(p.y))) : ctx.moveTo(X(p.x), cl(Y(p.y)))));
      ctx.stroke();
    }
  }
  // điểm được chọn
  if (picked) {
    const px = X(picked.x);
    ctx.strokeStyle = col.accent; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke(); ctx.setLineDash([]);
    if (picked.y !== null) {
      ctx.fillStyle = col.accent; ctx.beginPath(); ctx.arc(px, Math.max(-50, Math.min(h + 50, Y(picked.y))), 5, 0, 7); ctx.fill();
      ctx.strokeStyle = col.ink; ctx.lineWidth = 1; ctx.stroke();
    }
  }
}

export default function GraphPanel({ theme, sep }: { theme: string; sep: '.' | ',' }) {
  const [angle, setAngle] = useState<AngleMode>('rad'); // đồ thị dùng đơn vị góc riêng, mặc định radian
  const [src, setSrc] = useState('sin(x)');
  const [applied, setApplied] = useState('sin(x)');
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ x: number; y: number | null } | null>(null);
  const [width, setWidth] = useState(320);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const height = Math.round(Math.min(340, Math.max(240, width * 0.8)));
  const d = (s: string) => (sep === ',' ? s.replace(/\./g, ',') : s);

  const compiled = useMemo(() => compile(applied.replace(/^\s*y\s*=/i, ''), { angleMode: angle }), [applied, angle]);
  const analysis = useMemo(() => {
    if (!compiled.ok) return null;
    return analyze(sample(compiled.f, view.xmin, view.xmax, Math.ceil(width * 1.5)), view);
  }, [compiled, view, width]);

  useEffect(() => { // đồng bộ ô nhập với khung nhìn
    setFields({ xmin: fmtN(view.xmin), xmax: fmtN(view.xmax), ymin: fmtN(view.ymin), ymax: fmtN(view.ymax) });
  }, [view]);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const upd = () => setWidth(Math.max(200, Math.floor(el.clientWidth)));
    upd();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(upd) : null;
    ro?.observe(el);
    window.addEventListener('resize', upd);
    return () => { ro?.disconnect(); window.removeEventListener('resize', upd); };
  }, []);
  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, width, height, view, analysis, picked, readColors());
  }, [width, height, view, analysis, picked, theme]);

  // cuộn chuột để phóng to/thu nhỏ (cần listener không-passive để chặn cuộn trang)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect(), v = viewRef.current;
      const cx = v.xmin + ((e.clientX - r.left) / r.width) * (v.xmax - v.xmin);
      const cy = v.ymax - ((e.clientY - r.top) / r.height) * (v.ymax - v.ymin);
      setView(zoomView(v, e.deltaY < 0 ? 0.8 : 1.25, cx, cy));
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, []);

  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, pinch: 0 });
  const toData = (clientX: number, clientY: number, v: View) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: v.xmin + ((clientX - r.left) / r.width) * (v.xmax - v.xmin), y: v.ymax - ((clientY - r.top) / r.height) * (v.ymax - v.ymin) };
  };
  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = { moved: 0, pinch: 0 };
  };
  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev) return;
    const r = e.currentTarget.getBoundingClientRect(), v = viewRef.current;
    if (ptrs.current.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      gesture.current.moved += Math.abs(dx) + Math.abs(dy);
      if (gesture.current.moved > 4)
        setView(panView(v, -(dx / r.width) * (v.xmax - v.xmin), (dy / r.height) * (v.ymax - v.ymin)));
    } else if (ptrs.current.size === 2) {
      const other = [...ptrs.current.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      gesture.current.moved += 10;
      if (before > 0 && after > 0) {
        const mid = toData((e.clientX + other.x) / 2, (e.clientY + other.y) / 2, v);
        setView(zoomView(v, before / after, mid.x, mid.y));
      }
    }
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (ptrs.current.size === 1 && gesture.current.moved <= 4 && compiled.ok) {
      setPicked(pickPoint(compiled.f, toData(e.clientX, e.clientY, viewRef.current).x));
    }
    ptrs.current.delete(e.pointerId);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const v = view, sx = (v.xmax - v.xmin) * 0.1, sy = (v.ymax - v.ymin) * 0.1;
    const m: Record<string, () => View> = {
      ArrowLeft: () => panView(v, -sx, 0), ArrowRight: () => panView(v, sx, 0), ArrowUp: () => panView(v, 0, sy), ArrowDown: () => panView(v, 0, -sy),
      '+': () => zoomView(v, 0.8), '=': () => zoomView(v, 0.8), '-': () => zoomView(v, 1.25), _: () => zoomView(v, 1.25),
    };
    if (m[e.key]) { e.preventDefault(); setView(m[e.key]()); }
  };

  const plot = () => { setApplied(src); setPicked(null); setMsg(null); };
  const applyFields = () => {
    const vals: number[] = [];
    for (const k of VIEW_KEYS) {
      const r = evaluate((fields[k] ?? '').replace(/,/g, '.'));
      if (!r.ok) { setMsg(`${VIEW_LABEL[k]}: ${r.error.message}`); return; }
      vals.push(r.value);
    }
    const nv: View = { xmin: vals[0], xmax: vals[1], ymin: vals[2], ymax: vals[3] };
    const e = validateView(nv);
    if (e) { setMsg(e); return; }
    setMsg(null); setView(nv);
  };
  const autoY = () => {
    if (!compiled.ok) return;
    const r = autoYRange(sample(compiled.f, view.xmin, view.xmax, 800));
    if (!r) { setMsg('Hàm không xác định trong khoảng x này nên không chọn được khoảng y.'); return; }
    setMsg(null); setView({ ...view, ymin: r[0], ymax: r[1] });
  };
  const nudge = (v: View) => { setMsg(null); setView(v); };
  const sx = (view.xmax - view.xmin) * 0.25, sy = (view.ymax - view.ymin) * 0.25;
  const notes = analysis && compiled.ok ? describeAnalysis(analysis, (n) => d(fmtN(n))) : [];
  const readout = picked === null ? 'Chạm hoặc bấm vào đồ thị để xem tọa độ gần đúng.'
    : picked.y === null ? `Hàm không xác định tại x ≈ ${d(fmtN(picked.x))}.`
    : `x ≈ ${d(fmtN(picked.x))}, y ≈ ${d(fmtN(picked.y))} (gần đúng)`;

  return (
    <section className="panel graph" aria-label="Đồ thị hàm số">
      <h2>Đồ thị y = f(x)</h2>
      <form className="gform" onSubmit={(e) => { e.preventDefault(); plot(); }}>
        <label htmlFor="gfx">y =</label>
        <input id="gfx" className="field" value={src} spellCheck={false} autoCapitalize="off" autoComplete="off"
          onChange={(e) => setSrc(e.target.value)} placeholder="ví dụ: x^2 − 3x + 1" aria-describedby="gerr" />
        <button type="submit" className="chip primary">Vẽ</button>
      </form>
      <div id="gerr" role="alert" className="gerr">
        {!compiled.ok ? compiled.error.message : msg}
      </div>
      <div ref={wrapRef} className="gwrap">
        <canvas ref={canvasRef} className="gcanvas" style={{ width, height }} tabIndex={0} role="img"
          aria-label={`Đồ thị y = ${applied}. Dùng phím mũi tên để di chuyển, + và − để thu phóng.`}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={(e) => ptrs.current.delete(e.pointerId)}
          onKeyDown={onKey} />
      </div>
      <div className="readout" aria-live="polite">{readout}</div>
      {notes.map((n) => <p key={n} className="note">{n}</p>)}
      {compiled.ok && <p className="note small">{DISCLAIMER}</p>}
      <div className="gbtns" role="group" aria-label="Điều khiển đồ thị">
        <button type="button" className="chip" aria-label="Phóng to" onClick={() => nudge(zoomView(view, 0.7))}>＋</button>
        <button type="button" className="chip" aria-label="Thu nhỏ" onClick={() => nudge(zoomView(view, 1 / 0.7))}>－</button>
        <button type="button" className="chip" aria-label="Sang trái" onClick={() => nudge(panView(view, -sx, 0))}>←</button>
        <button type="button" className="chip" aria-label="Sang phải" onClick={() => nudge(panView(view, sx, 0))}>→</button>
        <button type="button" className="chip" aria-label="Lên" onClick={() => nudge(panView(view, 0, sy))}>↑</button>
        <button type="button" className="chip" aria-label="Xuống" onClick={() => nudge(panView(view, 0, -sy))}>↓</button>
        <button type="button" className="chip" aria-label={`Đơn vị góc của đồ thị: ${angle === 'rad' ? 'radian' : 'độ'}. Bấm để đổi`}
          onClick={() => setAngle(angle === 'rad' ? 'deg' : 'rad')}>Góc: {angle === 'rad' ? 'RAD' : 'DEG'}</button>
        <button type="button" className="chip" onClick={autoY}>Tự động y</button>
        <button type="button" className="chip" onClick={() => { setView(DEFAULT_VIEW); setMsg(null); }}>Đặt lại</button>
      </div>
      <form className="gfields" onSubmit={(e) => { e.preventDefault(); applyFields(); }}>
        {VIEW_KEYS.map((k) => (
          <label key={k} className="row">{VIEW_LABEL[k]}
            <input className="field" inputMode="decimal" value={d(fields[k] ?? '')} autoComplete="off"
              onChange={(e) => setFields({ ...fields, [k]: e.target.value })} onBlur={applyFields} />
          </label>
        ))}
        <button type="submit" className="chip">Áp dụng khoảng</button>
      </form>
    </section>
  );
}
