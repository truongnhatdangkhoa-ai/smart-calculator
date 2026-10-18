import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AngleMode } from './engine/index.ts';
import { formatNumber } from './engine/index.ts';
import { FORMULAS, GROUPS, SPECIAL_ANGLES, searchFormulas } from './formulas/catalog.ts';
import type { CalcDef, FormulaDef, Group, IdentityDef, ToolDef } from './formulas/catalog.ts';
import { defaultValues, runCalc, runIdentity } from './formulas/runner.ts';
import { parsePoly, polyText } from './algebra/poly.ts';
import { AlgebraError, parseQ } from './algebra/q.ts';
import type { Q } from './algebra/q.ts';
import { MAX_NEWTON_N, newtonExpansion, solveQuadratic, solveSystem2 } from './algebra/solvers.ts';
import type { SolveResult } from './algebra/solvers.ts';
import { IconCheck, IconChevron, IconCross } from './Icons.tsx';
import { MathText } from './MathText.tsx';
import { Seg } from './Seg.tsx';

type D = (s: string) => string;
const BAD_NUMBER = 'Nhập một số hoặc phân số, ví dụ 2, 0.5 hoặc 1/2.';

function Field({ id, label, value, onChange, error, className }: {
  id: string; label: ReactNode; value: string; onChange: (v: string) => void; error?: string; className?: string;
}) {
  return (
    <div className={`ff${error ? ' bad' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} inputMode="text" autoComplete="off"
        autoCapitalize="off" spellCheck={false} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} />
      {error && <p className="ferr" id={`${id}-err`} role="alert">{error}</p>}
    </div>
  );
}

function SolveView({ r, d }: { r: SolveResult; d: D }) {
  return (
    <div className="solve">
      <ol className="steps">{r.steps.map((s, i) => <li key={i}>{d(s)}</li>)}</ol>
      <div className="answers">
        {r.answers.map((a) => (
          <div key={a.label} className="answer">
            <span className="answer-main">{d(a.text)}</span>
            {a.approx !== undefined && <span className="alt">≈ {d(formatNumber(a.approx).text.replace('-', '−'))}</span>}
          </div>
        ))}
      </div>
      {r.notes.map((n) => <p className="note" key={n}>{d(n)}</p>)}
    </div>
  );
}

function IdentityCard({ def, angle, d, onSend }: { def: IdentityDef; angle: AngleMode; d: D; onSend: (t: string) => void }) {
  const [vals, setVals] = useState(() => defaultValues(def.vars, angle));
  const run = useMemo(() => runIdentity(def, vals, angle), [def, vals, angle]);
  const errors = run.ok ? {} : run.errors;
  return (
    <>
      <div className="ffs">
        {def.vars.map((v) => (
          <Field key={v.name} id={`${def.id}-${v.name}`} label={v.label} value={vals[v.name] ?? ''} error={errors[v.name]}
            onChange={(t) => setVals({ ...vals, [v.name]: t })} />
        ))}
      </div>
      {def.group === 'identity' && <p className="note">Nhập chữ x để khai triển theo x, ví dụ a = 2x và b = 3.</p>}
      {def.group === 'trig' && <p className="note">Nhập số, ví dụ 30 hoặc 1/2{angle === 'rad' ? ', pi/6' : ''}. Đang tính theo {angle === 'deg' ? 'độ' : 'radian'}.</p>}
      {!run.ok && run.message && <p className="ferr" role="alert">{d(run.message)}</p>}
      {run.ok && (
        <>
          <div className="forms">
            {run.forms.map((f, i) => (
              <div key={i} className="eq">
                <div className="eq-label">{i === 0 ? 'Vế trái' : run.forms.length === 2 ? 'Vế phải' : `Vế phải, dạng ${i}`}</div>
                <div className="eq-expr">{d(f.expr)}</div>
                {f.parts && <div className="eq-expr dim">= {d(f.parts)}</div>}
                <div className="eq-total">= {f.approx ? '≈ ' : ''}{d(f.total)}</div>
              </div>
            ))}
          </div>
          <div className={`verdict ${run.verdict.equal ? 'ok' : 'bad'}`} role="status">
            {run.verdict.equal ? <IconCheck /> : <IconCross />}<span>{run.verdict.text}</span>
          </div>
          {run.send && <button type="button" className="btn" onClick={() => onSend(run.send!)}>Đưa vế trái vào máy tính</button>}
        </>
      )}
    </>
  );
}

function CalcCard({ def, angle, d, onSend }: { def: CalcDef; angle: AngleMode; d: D; onSend: (t: string) => void }) {
  const [vals, setVals] = useState(() => defaultValues(def.vars, angle));
  const run = useMemo(() => runCalc(def, vals, angle), [def, vals, angle]);
  const errors = run.ok ? {} : run.errors;
  return (
    <>
      <div className="ffs">
        {def.vars.map((v) => (
          <Field key={v.name} id={`${def.id}-${v.name}`} label={v.label} value={vals[v.name] ?? ''} error={errors[v.name]}
            onChange={(t) => setVals({ ...vals, [v.name]: t })} />
        ))}
      </div>
      <p className="note">Nhập số dương, có thể là phân số (1/2) hoặc có π (ví dụ 2*pi).</p>
      {!run.ok && run.message && <p className="ferr" role="alert">{d(run.message)}</p>}
      {run.ok && (
        <ul className="outs">
          {run.lines.map((l) => (
            <li key={l.label} className="out-item">
              <div className="out-label">{l.label}</div>
              <div className="out-formula"><MathText text={l.formula} /></div>
              <div className="eq-expr dim">= {d(l.substituted)}</div>
              <div className="eq-total">= {l.approx ? '≈ ' : ''}{d(l.main)}{l.alt && <span className="alt"> ≈ {d(l.alt)}</span>}</div>
              <button type="button" className="linkbtn" onClick={() => onSend(l.send)}>Dùng trong máy tính</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AngleTable() {
  return (
    <>
      <div className="table-wrap">
        <table className="angles">
          <caption className="sr-only">Giá trị lượng giác của các góc đặc biệt</caption>
          <thead><tr><th scope="col">Góc</th><th scope="col">sin</th><th scope="col">cos</th><th scope="col">tan</th></tr></thead>
          <tbody>
            {SPECIAL_ANGLES.map((r) => (
              <tr key={r.deg}>
                <th scope="row">{r.deg}° <span className="rad">({r.rad})</span></th>
                <td>{r.sin}</td><td>{r.cos}</td><td className={r.tanE === null ? 'undef' : ''}>{r.tan === 'không xác định' ? 'không xác định' : r.tan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">Đây là giá trị đúng (dạng căn). Muốn số thập phân, gõ ví dụ sin(30) vào máy tính.</p>
    </>
  );
}

const parseAll = (vals: string[]): (Q | null)[] => vals.map((v) => parseQ(v));

function QuadraticTool({ d }: { d: D }) {
  const [v, setV] = useState({ a: '1', b: '-3', c: '2' });
  const q = parseAll([v.a, v.b, v.c]);
  const err = (i: number, s: string) => (s.trim() === '' ? 'Hãy nhập một giá trị.' : q[i] === null ? BAD_NUMBER : undefined);
  const ready = q.every((x) => x !== null);
  let r: SolveResult | null = null, fail: string | null = null;
  if (ready) { try { r = solveQuadratic(q[0]!, q[1]!, q[2]!); } catch (e) { fail = e instanceof AlgebraError ? e.message : 'Không giải được phương trình này.'; } }
  return (
    <>
      <div className="ffs three">
        <Field id="q-a" label={<span><i>a</i> (hệ số của x²)</span>} value={v.a} error={err(0, v.a)} onChange={(t) => setV({ ...v, a: t })} />
        <Field id="q-b" label={<span><i>b</i> (hệ số của x)</span>} value={v.b} error={err(1, v.b)} onChange={(t) => setV({ ...v, b: t })} />
        <Field id="q-c" label={<span><i>c</i> (số hạng tự do)</span>} value={v.c} error={err(2, v.c)} onChange={(t) => setV({ ...v, c: t })} />
      </div>
      <p className="note">Nếu a = 0, ứng dụng giải như phương trình bậc nhất.</p>
      {fail && <p className="ferr" role="alert">{fail}</p>}
      {r && <SolveView r={r} d={d} />}
    </>
  );
}

function SystemTool({ d }: { d: D }) {
  const [v, setV] = useState({ a1: '2', b1: '1', c1: '5', a2: '1', b2: '-1', c2: '1' });
  const keys = ['a1', 'b1', 'c1', 'a2', 'b2', 'c2'] as const;
  const q = parseAll(keys.map((k) => v[k]));
  const err = (k: (typeof keys)[number]) => (v[k].trim() === '' ? 'Hãy nhập.' : parseQ(v[k]) === null ? BAD_NUMBER : undefined);
  let r: SolveResult | null = null, fail: string | null = null;
  if (q.every((x) => x !== null)) {
    try { r = solveSystem2(q[0]!, q[1]!, q[2]!, q[3]!, q[4]!, q[5]!); } catch (e) { fail = e instanceof AlgebraError ? e.message : 'Không giải được hệ này.'; }
  }
  const eq = (n: 1 | 2) => (
    <div className="sys-row">
      <Field id={`s-a${n}`} label={`Hệ số x, dòng ${n}`} value={v[`a${n}`]} error={err(`a${n}`)} onChange={(t) => setV({ ...v, [`a${n}`]: t })} />
      <Field id={`s-b${n}`} label={`Hệ số y, dòng ${n}`} value={v[`b${n}`]} error={err(`b${n}`)} onChange={(t) => setV({ ...v, [`b${n}`]: t })} />
      <Field id={`s-c${n}`} label={`Vế phải, dòng ${n}`} value={v[`c${n}`]} error={err(`c${n}`)} onChange={(t) => setV({ ...v, [`c${n}`]: t })} />
    </div>
  );
  return (
    <>
      <p className="note">Hệ gồm hai phương trình dạng <MathText text="{a}x + {b}y = {c}" />. Mỗi dòng là một phương trình.</p>
      {eq(1)}{eq(2)}
      {fail && <p className="ferr" role="alert">{fail}</p>}
      {r && <SolveView r={r} d={d} />}
    </>
  );
}

const EXPAND_EXAMPLES = ['(x+1)^2', '(x−2)(x+2)', '(2x−1)^3', '(x+1)(x²−x+1)', '(x+2)^2 − (x−2)^2'];
function ExpandTool() {
  const [src, setSrc] = useState('(2x+3)^2');
  const r = useMemo(() => parsePoly(src), [src]);
  return (
    <>
      <Field id="expand-src" label="Biểu thức theo x" value={src} onChange={setSrc} error={r.ok ? undefined : r.error} />
      <p className="note">Viết 2x, 3(x+1), x^2 hoặc x². Chỉ dùng một biến, số và + − × ÷ ^ ( ).</p>
      <div className="chips" role="group" aria-label="Ví dụ">
        {EXPAND_EXAMPLES.map((e) => <button key={e} type="button" className="chip small" onClick={() => setSrc(e)}>{e}</button>)}
      </div>
      {r.ok && <div className="answers"><div className="answer"><span className="answer-main">= {polyText(r.poly, r.variable ?? 'x')}</span></div></div>}
    </>
  );
}

function NewtonTool() {
  const [n, setN] = useState('5');
  const [sign, setSign] = useState<'plus' | 'minus'>('plus');
  const k = /^\d{1,3}$/.test(n.trim()) ? Number(n) : NaN;
  const bad = !Number.isInteger(k) || k > MAX_NEWTON_N;
  const res = bad ? null : newtonExpansion(k, sign === 'minus');
  return (
    <>
      <Field id="newton-n" label={<span>Số mũ <i>n</i> (từ 0 đến {MAX_NEWTON_N})</span>} value={n} onChange={setN}
        error={bad ? `Nhập số nguyên từ 0 đến ${MAX_NEWTON_N}.` : undefined} />
      <Seg value={sign} label="Dấu giữa a và b" onChange={setSign}
        options={[{ value: 'plus', label: '(a + b)' }, { value: 'minus', label: '(a − b)' }]} />
      {res && !bad && (
        <div className="solve">
          <div className="answers"><div className="answer"><span className="answer-main">(a {sign === 'plus' ? '+' : '−'} b)<sup>{k}</sup> = {res.text}</span></div></div>
          <p className="note">Hệ số lấy từ hàng thứ {k} của tam giác Pascal: {res.row.join(', ')}.</p>
        </div>
      )}
    </>
  );
}

function ToolCard({ def, d }: { def: ToolDef; d: D }) {
  switch (def.tool) {
    case 'quadratic': return <QuadraticTool d={d} />;
    case 'system': return <SystemTool d={d} />;
    case 'expand': return <ExpandTool />;
    case 'newton': return <NewtonTool />;
  }
}

function Body({ def, angle, d, onSend }: { def: FormulaDef; angle: AngleMode; d: D; onSend: (t: string) => void }) {
  switch (def.kind) {
    case 'identity': return <IdentityCard key={`${def.id}-${angle}`} def={def} angle={angle} d={d} onSend={onSend} />;
    case 'calc': return <CalcCard key={`${def.id}-${angle}`} def={def} angle={angle} d={d} onSend={onSend} />;
    case 'tool': return <ToolCard def={def} d={d} />;
    case 'table': return <AngleTable />;
  }
}

export default function FormulaView({ sep, angle, onSetAngle, onSend }: {
  sep: '.' | ','; angle: AngleMode; onSetAngle: (a: AngleMode) => void; onSend: (text: string) => void;
}) {
  const [group, setGroup] = useState<Group>('identity');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const searching = query.trim() !== '';
  const d: D = (s) => (sep === ',' ? s.replace(/(\d)\.(\d)/g, '$1,$2') : s);
  const list = useMemo(() => (searching ? searchFormulas(query) : FORMULAS.filter((f) => f.group === group)), [searching, query, group]);
  const meta = GROUPS.find((g) => g.id === group)!;

  const renderCard = (f: FormulaDef) => {
    const open = openId === f.id;
    const title = f.kind === 'identity' && angle === 'rad' && f.titleRad ? f.titleRad : f.title;
    return (
      <li key={f.id} className={`fcard${open ? ' open' : ''}`}>
        <button type="button" className="fcard-head" aria-expanded={open} aria-controls={`fb-${f.id}`} onClick={() => setOpenId(open ? null : f.id)}>
          <span className="fhead-text">
            <span className="fname">{f.name}</span>
            <span className="ftitle"><MathText text={title} /></span>
          </span>
          <IconChevron className={`chev${open ? ' up' : ''}`} />
        </button>
        {open && <div id={`fb-${f.id}`} className="fcard-body"><Body def={f} angle={angle} d={d} onSend={onSend} /></div>}
      </li>
    );
  };

  const renderList = (items: FormulaDef[], withSections: boolean) => {
    const out: ReactNode[] = [];
    let last: string | undefined;
    for (const f of items) {
      if (withSections && f.section && f.section !== last) { out.push(<li key={`s-${f.section}`} className="section" role="presentation"><h3>{f.section}</h3></li>); }
      last = f.section;
      out.push(renderCard(f));
    }
    return <ul className="fcards">{out}</ul>;
  };

  return (
    <div className="formula-screen">
      <input type="search" className="field" placeholder="Tìm công thức: sin, hình tròn, bậc hai…" aria-label="Tìm công thức"
        value={query} onChange={(e) => { setQuery(e.target.value); setOpenId(null); }} />
      {!searching && (
        <>
          <div className="chips scroll" role="tablist" aria-label="Nhóm công thức">
            {GROUPS.map((g) => (
              <button key={g.id} type="button" role="tab" aria-selected={group === g.id} className={`tab${group === g.id ? ' on' : ''}`}
                onClick={() => { setGroup(g.id); setOpenId(null); }}>{g.label}</button>
            ))}
          </div>
          <p className="lead">{meta.lead}</p>
          {group === 'trig' && (
            <div className="angle-row"><span className="lbl">Đơn vị góc</span>
              <Seg value={angle} label="Đơn vị góc" onChange={onSetAngle} options={[{ value: 'deg', label: 'Độ' }, { value: 'rad', label: 'Radian' }]} />
            </div>
          )}
          {renderList(list, true)}
        </>
      )}
      {searching && (list.length === 0
        ? <p className="empty">Không có công thức nào khớp “{query}”. Thử từ ngắn hơn như “sin”, “diện tích” hoặc “bậc hai”.</p>
        : GROUPS.map((g) => {
          const items = list.filter((f) => f.group === g.id);
          return items.length === 0 ? null : (
            <section key={g.id}><h3 className="group-title">{g.label}</h3>{renderList(items, false)}</section>
          );
        }))}
    </div>
  );
}
