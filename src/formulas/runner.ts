// Tính một công thức từ các giá trị người dùng nhập: thay số, tính hai vế, kết luận.
// Số: dùng bộ máy tính chính (chính xác khi là số hữu tỉ). Có chữ x: khai triển đa thức chính xác.
import { evaluate, formatNumber } from '../engine/index.ts';
import type { AngleMode, Frac } from '../engine/index.ts';
import { parsePoly, pAdd, pEq, polyText, sup } from '../algebra/poly.ts';
import type { Poly } from '../algebra/poly.ts';
import type { CalcDef, IdentityDef, VarDef } from './catalog.ts';

export const normInput = (raw: string): string => raw.trim().replace(/,/g, '.');
/** Có chữ x đứng riêng (không phải một phần của tên hàm như "exp", "max"). */
export const isSymbolicInput = (raw: string): boolean => /(^|[^A-Za-z])x(?![A-Za-z])/i.test(raw);

export interface RunError { ok: false; errors: Record<string, string>; message: string | null }
export interface FormRun { expr: string; parts: string | null; total: string; approx: boolean }
export type IdentityRun = RunError | {
  ok: true; symbolic: boolean; forms: FormRun[]; verdict: { equal: boolean; text: string }; send: string | null;
};
export interface OutLine { label: string; formula: string; substituted: string; main: string; approx: boolean; alt: string | null; send: string }
export type CalcRun = RunError | { ok: true; lines: OutLine[] };

type Num = { value: number; exact: Frac | null };

export function defaultValues(vars: VarDef[], angle: AngleMode): Record<string, string> {
  return Object.fromEntries(vars.map((v) => [v.name, v.angle && angle === 'rad' && v.exampleRad ? v.exampleRad : v.example]));
}

const expandAngles = (tpl: string, angle: AngleMode) =>
  tpl.replace(/\{R\}/g, angle === 'deg' ? '(90)' : '(pi/2)').replace(/\{S\}/g, angle === 'deg' ? '(180)' : '(pi)');
const substitute = (tpl: string, vals: Record<string, string>): string =>
  tpl.replace(/[a-z]+/g, (w) => (w.length === 1 && w in vals ? `(${vals[w]})` : w));

const SIMPLE = /^[\d.]+$|^[a-zπ]$/i;
const isMul = (c: string) => c !== '' && '*/^'.includes(c);
/** Đặt ngoặc quanh giá trị thay vào chỉ khi cần: khi nhân/chia/lũy thừa, hoặc số âm/biểu thức sau dấu + −. */
function wrapFor(v: string, prev: string, next: string): string {
  if (SIMPLE.test(v)) return v;
  if (isMul(prev) || isMul(next)) return `(${v})`;
  if (v.startsWith('-')) return prev === '+' || prev === '-' ? `(${v})` : v;
  if (prev === '-' && /[+-]/.test(v)) return `(${v})`;
  return v;
}
const showValue = (v: string) => {
  const out = v.replace(/\bpi\b/g, 'π').replace(/sqrt/g, '√');
  return /\d[eE]/.test(out) ? out : out.replace(/(?<=[\w)])([+-])(?=[\w(])/g, ' $1 '); // x+1 → x + 1 (không đụng 1e-7)
};
/** Biểu thức dạng máy → dạng đọc được: 3^2 → 3², * → ·, - → −, sqrt → √, pi → π, kèm thay biến bằng giá trị. */
export function pretty(tpl: string, disp: Record<string, string>, bare = false, angle: AngleMode = 'deg'): string {
  const t = tpl.replace(/\{R\}/g, angle === 'deg' ? '90' : 'π/2').replace(/\{S\}/g, angle === 'deg' ? '180' : 'π');
  const spaced = t.replace(/(?<=[\w)])([+-])(?=[\w(])/g, ' $1 ');
  const prevCh = (i: number) => { for (let j = i - 1; j >= 0; j--) if (spaced[j] !== ' ') return spaced[j]; return ''; };
  const nextCh = (i: number) => { for (let j = i; j < spaced.length; j++) if (spaced[j] !== ' ') return spaced[j]; return ''; };
  return spaced
    .replace(/[a-z]+/g, (w, off: number) => {
      if (w.length === 1 && w in disp) {
        const v = showValue(disp[w]);
        return bare ? v : wrapFor(v, prevCh(off), nextCh(off + 1));
      }
      return w === 'pi' ? 'π' : w === 'sqrt' ? '√' : w;
    })
    .replace(/\*/g, '·').replace(/\^(\d+)/g, (_, d: string) => sup(Number(d))).replace(/-/g, '−');
}

export function formatValue(r: Num, decimals: number | null = null): { text: string; approx: boolean } {
  if (r.exact) return { text: r.exact.d === 1n ? `${r.exact.n}` : `${r.exact.n}/${r.exact.d}`, approx: false };
  const f = formatNumber(r.value, { decimals });
  return { text: f.text, approx: f.approximate };
}
/** Văn bản đưa được vào máy tính (âm thì có ngoặc, dạng khoa học đổi sang ×10^). */
export function calcLiteral(text: string): string {
  const m = /^(-?)([\d.]+)e([+-]\d+)$/.exec(text);
  if (m) return `(${m[1] ? '−' : ''}${m[2]}×10^(${m[3].replace('-', '−')}))`;
  const frac = text.includes('/');
  if (text.startsWith('-')) return `(−${text.slice(1)})`;
  return frac ? `(${text})` : text;
}
const piText = (q: Frac): string => {
  const neg = q.n < 0n ? '−' : '';
  const n = q.n < 0n ? -q.n : q.n;
  if (q.n === 0n) return '0';
  if (q.d === 1n) return `${neg}${n === 1n ? '' : n}π`;
  return `${neg}${n === 1n ? '' : n}π/${q.d}`;
};

function parseVars(vars: VarDef[], raw: Record<string, string>, angle: AngleMode, symbolic: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const v of vars) {
    const text = raw[v.name] ?? '';
    if (text.trim() === '') { errors[v.name] = 'Hãy nhập một giá trị.'; continue; }
    if (symbolic) {
      const p = parsePoly(text);
      if (!p.ok) errors[v.name] = p.error;
      else if (p.variable !== null && p.variable !== 'x') errors[v.name] = 'Chỉ dùng biến x.';
      continue;
    }
    const r = evaluate(normInput(text), { angleMode: angle });
    if (!r.ok) errors[v.name] = r.error.message;
    else if (v.positive && !(r.value > 0)) errors[v.name] = 'Giá trị phải là số dương.';
  }
  return errors;
}

const splitTerm = (t: string) => (t.startsWith('-') ? { neg: true, body: t.slice(1) } : { neg: false, body: t });
const isBareVar = (body: string, vars: VarDef[]) => body.length === 1 && vars.some((v) => v.name === body);
const closeEnough = (x: number, y: number) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));

export function runIdentity(def: IdentityDef, raw: Record<string, string>, angle: AngleMode): IdentityRun {
  const symbolic = def.group === 'identity' && def.vars.some((v) => isSymbolicInput(raw[v.name] ?? ''));
  const errors = parseVars(def.vars, raw, angle, symbolic);
  if (Object.keys(errors).length > 0) return { ok: false, errors, message: null };
  const vals = Object.fromEntries(def.vars.map((v) => [v.name, normInput(raw[v.name])]));
  const forms: FormRun[] = [];
  const checks: { num?: Num; poly?: Poly }[] = [];

  for (const terms of def.forms) {
    const parsed = terms.map(splitTerm);
    const expr = parsed.map((t, i) => {
      const text = pretty(t.body, vals, isBareVar(t.body, def.vars) && parsed.length === 1, angle);
      return i === 0 ? `${t.neg ? '−' : ''}${text}` : ` ${t.neg ? '−' : '+'} ${text}`;
    }).join('');

    if (symbolic) {
      const polys: Poly[] = [];
      for (const t of terms) {
        const r = parsePoly(substitute(expandAngles(t, angle), vals));
        if (!r.ok) return { ok: false, errors: {}, message: r.error };
        polys.push(r.poly);
      }
      const total = polys.reduce((acc, p) => pAdd(acc, p), [] as Poly);
      const nz = (p: Poly) => p.filter((c) => c.n !== 0n).length;
      const parts = polys.length > 1
        ? polys.map((p, i) => {
          const text = polyText(p);
          if (i === 0) return nz(p) > 1 ? `(${text})` : text;
          return nz(p) === 1 && text.startsWith('−') ? ` − ${text.slice(1)}` : ` + ${nz(p) > 1 ? `(${text})` : text}`;
        }).join('')
        : null;
      forms.push({ expr, parts, total: polyText(total), approx: false });
      checks.push({ poly: total });
      continue;
    }

    const values: Num[] = [];
    for (const t of terms) {
      const r = evaluate(substitute(expandAngles(t, angle), vals), { angleMode: angle });
      if (!r.ok) return { ok: false, errors: {}, message: `Công thức không tính được với các giá trị này: ${r.error.message}` };
      values.push({ value: r.value, exact: r.exact });
    }
    const sumExpr = terms.map((t) => `(${substitute(expandAngles(t, angle), vals)})`).join('+');
    const tr = evaluate(sumExpr, { angleMode: angle });
    if (!tr.ok) return { ok: false, errors: {}, message: `Công thức không tính được với các giá trị này: ${tr.error.message}` };
    const total: Num = { value: tr.value, exact: tr.exact };
    const parts = values.length > 1
      ? values.map((v, i) => {
        const f = formatValue(v).text.replace(/-/g, '−');
        if (i === 0) return f;
        return f.startsWith('−') ? ` − ${f.slice(1)}` : ` + ${f}`;
      }).join('')
      : null;
    const tf = formatValue(total);
    forms.push({ expr, parts, total: tf.text.replace(/-/g, '−'), approx: tf.approx });
    checks.push({ num: total });
  }

  let equal: boolean, exactMode: boolean;
  if (symbolic) {
    equal = checks.every((c) => pEq(c.poly!, checks[0].poly!));
    exactMode = true;
  } else {
    exactMode = checks.every((c) => c.num!.exact !== null);
    equal = exactMode
      ? checks.every((c) => c.num!.exact!.n === checks[0].num!.exact!.n && c.num!.exact!.d === checks[0].num!.exact!.d)
      : checks.every((c) => closeEnough(c.num!.value, checks[0].num!.value));
  }
  const many = def.forms.length > 2;
  const verdictText = !equal
    ? 'Các vế không bằng nhau với giá trị này.'
    : symbolic
      ? `${many ? 'Các vế' : 'Hai vế'} khai triển ra cùng một đa thức nên bằng nhau (kết quả chính xác).`
      : exactMode
        ? `${many ? 'Các vế' : 'Hai vế'} bằng nhau (tính chính xác bằng phân số).`
        : `${many ? 'Các vế' : 'Hai vế'} bằng nhau (số thực, sai khác dưới 10⁻⁹ do làm tròn của máy tính).`;
  const first = checks[0].num;
  return {
    ok: true, symbolic, forms, verdict: { equal, text: verdictText },
    send: first ? calcLiteral(first.exact ? formatValue(first).text : String(first.value)) : null,
  };
}

export function runCalc(def: CalcDef, raw: Record<string, string>, angle: AngleMode): CalcRun {
  const errors = parseVars(def.vars, raw, angle, false);
  if (Object.keys(errors).length > 0) return { ok: false, errors, message: null };
  const vals = Object.fromEntries(def.vars.map((v) => [v.name, normInput(raw[v.name])]));
  if (def.validate) {
    const nums: Record<string, number> = {};
    for (const v of def.vars) nums[v.name] = (evaluate(vals[v.name], { angleMode: angle }) as { ok: true; value: number }).value;
    const msg = def.validate(nums);
    if (msg) return { ok: false, errors: {}, message: msg };
  }
  const lines: OutLine[] = [];
  for (const out of def.outputs) {
    const full = evaluate(substitute(out.expr, vals), { angleMode: angle });
    if (!full.ok) return { ok: false, errors: {}, message: `Không tính được: ${full.error.message}` };
    const num: Num = { value: full.value, exact: full.exact };
    const fv = formatValue(num);
    let main = fv.text.replace(/-/g, '−'), approx = fv.approx, alt: string | null = null;
    if (out.inPi) {
      const c = evaluate(substitute(out.expr.replace(/\bpi\b/g, '1'), vals), { angleMode: angle });
      if (c.ok && c.exact) { main = piText(c.exact); approx = false; alt = fv.text.replace(/-/g, '−'); }
    }
    lines.push({
      label: out.label, formula: out.text, substituted: pretty(out.expr, vals, false, angle),
      main, approx, alt, send: calcLiteral(full.exact ? fv.text : String(full.value)),
    });
  }
  return { ok: true, lines };
}
