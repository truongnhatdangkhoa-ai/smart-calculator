// Đa thức một biến với hệ số hữu tỉ chính xác: phân tích chuỗi, cộng/trừ/nhân/lũy thừa, in đẹp.
import {
  AlgebraError, Q0, Q1, parseQ, qAbs, qAdd, qDiv, qEq, qIsZero, qMul, qNeg, qText,
} from './q.ts';
import type { Q } from './q.ts';

/** Phần tử i là hệ số của x^i. Đã cắt hệ số 0 ở cuối; đa thức 0 là []. */
export type Poly = Q[];
export const MAX_DEGREE = 60;
export const MAX_POLY_INPUT = 200;

const trim = (p: Poly): Poly => {
  let n = p.length;
  while (n > 0 && qIsZero(p[n - 1])) n--;
  return p.slice(0, n);
};
export const pConst = (c: Q): Poly => trim([c]);
export const pVar = (): Poly => [Q0, Q1];
export const pIsConst = (p: Poly) => p.length <= 1;
export const pCoef = (p: Poly, i: number): Q => p[i] ?? Q0;

export function pAdd(a: Poly, b: Poly): Poly {
  const out: Poly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(qAdd(pCoef(a, i), pCoef(b, i)));
  return trim(out);
}
export const pNeg = (a: Poly): Poly => a.map(qNeg);
export const pSub = (a: Poly, b: Poly): Poly => pAdd(a, pNeg(b));
export const pScale = (a: Poly, c: Q): Poly => trim(a.map((x) => qMul(x, c)));
export function pMul(a: Poly, b: Poly): Poly {
  if (a.length === 0 || b.length === 0) return [];
  if (a.length + b.length - 2 > MAX_DEGREE) throw new AlgebraError(`Bậc đa thức quá lớn (tối đa ${MAX_DEGREE}).`);
  const out: Q[] = Array.from({ length: a.length + b.length - 1 }, () => Q0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] = qAdd(out[i + j], qMul(a[i], b[j]));
  return trim(out);
}
export function pPow(a: Poly, e: number): Poly {
  if (!Number.isInteger(e) || e < 0 || e > MAX_DEGREE) throw new AlgebraError(`Số mũ phải là số nguyên từ 0 đến ${MAX_DEGREE}.`);
  let r: Poly = [Q1];
  for (let i = 0; i < e; i++) r = pMul(r, a);
  return r;
}
export function pEq(a: Poly, b: Poly): boolean {
  const x = trim(a), y = trim(b);
  return x.length === y.length && x.every((c, i) => qEq(c, y[i]));
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = (n: number): string => String(n).replace(/\d/g, (d) => SUP[Number(d)]);

/** In đa thức theo bậc giảm dần: "4x² + 12x + 9", "x² − 2x + 1", "(1/2)x − 3". */
export function polyText(p: Poly, v = 'x'): string {
  if (p.length === 0) return '0';
  const parts: string[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (qIsZero(c)) continue;
    const neg = c.n < 0n;
    const a = qAbs(c);
    let body: string;
    if (i === 0) body = qText(a);
    else {
      const coef = a.n === 1n && a.d === 1n ? '' : a.d === 1n ? String(a.n) : `(${a.n}/${a.d})`;
      body = `${coef}${v}${i > 1 ? sup(i) : ''}`;
    }
    parts.push(parts.length === 0 ? `${neg ? '−' : ''}${body}` : `${neg ? '−' : '+'} ${body}`);
  }
  return parts.join(' ');
}

export type PolyParse =
  | { ok: true; poly: Poly; variable: string | null }
  | { ok: false; error: string };

type Tok = { k: 'num'; q: Q } | { k: 'var'; name: string } | { k: 'op'; ch: string };
const SUP_MAP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

function tokenize(src: string): { toks: Tok[]; variable: string | null } {
  const s = src
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^${[...m].map((c) => SUP_MAP[c]).join('')}`)
    .replace(/[−–]/g, '-').replace(/[×·⋅]/g, '*').replace(/÷/g, '/');
  const toks: Tok[] = [];
  let variable: string | null = null;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/\d|[.,]/.test(c)) {
      const m = /^(\d+(?:[.,]\d+)?|[.,]\d+)/.exec(s.slice(i));
      if (!m) throw new AlgebraError('Số không hợp lệ.');
      const val = parseQ(m[1]);
      if (!val) throw new AlgebraError('Số không hợp lệ.');
      toks.push({ k: 'num', q: val });
      i += m[1].length;
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z]+/.exec(s.slice(i))![0];
      if (m.length > 1) throw new AlgebraError(`Không nhận ra “${m}”. Chỉ dùng một biến (ví dụ x), số và + − × ÷ ^ ( ).`);
      const name = m.toLowerCase();
      if (variable !== null && variable !== name) throw new AlgebraError(`Chỉ hỗ trợ một biến, nhưng bạn dùng cả “${variable}” và “${name}”.`);
      variable = name;
      toks.push({ k: 'var', name });
      i++;
      continue;
    }
    if ('+-*/^()'.includes(c)) { toks.push({ k: 'op', ch: c }); i++; continue; }
    throw new AlgebraError(`Ký tự “${c}” không dùng được. Chỉ dùng số, một biến, + − × ÷ ^ ( ).`);
  }
  return { toks, variable };
}

class Parser {
  i = 0;
  private toks: Tok[];
  constructor(toks: Tok[]) { this.toks = toks; }
  private peek(): Tok | undefined { return this.toks[this.i]; }
  private isOp(ch: string) { const t = this.peek(); return t?.k === 'op' && t.ch === ch; }
  parseAll(): Poly {
    if (this.toks.length === 0) throw new AlgebraError('Hãy nhập một biểu thức.');
    const v = this.expr();
    if (this.i < this.toks.length) {
      if (this.isOp(')')) throw new AlgebraError('Thừa dấu ngoặc đóng “)”.');
      throw new AlgebraError('Biểu thức chưa đúng: có ký tự thừa hoặc thiếu toán tử.');
    }
    return v;
  }
  private expr(): Poly {
    let v = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.i++] as { ch: string }).ch;
      const r = this.term();
      v = op === '+' ? pAdd(v, r) : pSub(v, r);
    }
    return v;
  }
  private term(): Poly {
    let v = this.unary();
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.k === 'op' && t.ch === '*') { this.i++; v = pMul(v, this.unary()); continue; }
      if (t.k === 'op' && t.ch === '/') {
        this.i++;
        const d = this.power();
        if (!(d.length <= 1) || d.length === 0) {
          throw new AlgebraError(d.length === 0 ? 'Không thể chia cho 0.' : 'Chỉ chia được cho một số (chưa chia cho biểu thức chứa biến).');
        }
        v = pScale(v, qDiv(Q1, d[0]));
        continue;
      }
      if (t.k === 'var' || (t.k === 'op' && t.ch === '(')) { v = pMul(v, this.power()); continue; } // nhân ngầm: 2x, x(x+1), (x+1)(x−1)
      break;
    }
    return v;
  }
  private unary(): Poly {
    if (this.isOp('+')) { this.i++; return this.unary(); }
    if (this.isOp('-')) { this.i++; return pNeg(this.unary()); }
    return this.power();
  }
  private power(): Poly {
    const base = this.atom();
    if (!this.isOp('^')) return base;
    this.i++;
    let e: Poly;
    if (this.isOp('(')) { this.i++; e = this.expr(); this.expectClose(); }
    else {
      const t = this.peek();
      if (t?.k !== 'num') throw new AlgebraError('Số mũ phải là số nguyên không âm (ví dụ x^2).');
      this.i++;
      e = pConst(t.q);
    }
    if (!(e.length <= 1)) throw new AlgebraError('Số mũ không được chứa biến.');
    const c = pCoef(e, 0);
    if (c.d !== 1n || c.n < 0n || c.n > BigInt(MAX_DEGREE)) throw new AlgebraError(`Số mũ phải là số nguyên từ 0 đến ${MAX_DEGREE}.`);
    if (this.isOp('^')) throw new AlgebraError('Chưa hỗ trợ lũy thừa chồng nhau. Hãy thêm ngoặc.');
    return pPow(base, Number(c.n));
  }
  private expectClose() {
    if (!this.isOp(')')) throw new AlgebraError('Thiếu dấu ngoặc đóng “)”.');
    this.i++;
  }
  private atom(): Poly {
    const t = this.peek();
    if (!t) throw new AlgebraError('Biểu thức bị thiếu ở cuối.');
    this.i++;
    if (t.k === 'num') return pConst(t.q);
    if (t.k === 'var') return pVar();
    if (t.ch === '(') { const v = this.expr(); this.expectClose(); return v; }
    throw new AlgebraError(`Chưa đúng ở dấu “${t.ch}”: cần một số, biến hoặc dấu “(”.`);
  }
}

/** Phân tích và rút gọn một biểu thức đa thức một biến (khai triển mọi dấu ngoặc). */
export function parsePoly(text: string): PolyParse {
  try {
    if (text.length > MAX_POLY_INPUT) return { ok: false, error: `Biểu thức quá dài (tối đa ${MAX_POLY_INPUT} ký tự).` };
    const { toks, variable } = tokenize(text);
    return { ok: true, poly: new Parser(toks).parseAll(), variable };
  } catch (e) {
    if (e instanceof AlgebraError) return { ok: false, error: e.message };
    return { ok: false, error: 'Không thể phân tích biểu thức này.' };
  }
}

/** Giá trị của đa thức tại một số hữu tỉ (Horner), chính xác. */
export function pEval(p: Poly, x: Q): Q {
  let r = Q0;
  for (let i = p.length - 1; i >= 0; i--) r = qAdd(qMul(r, x), p[i]);
  return r;
}
