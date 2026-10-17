// Bộ phân tích biểu thức an toàn: tokenizer -> parser (đệ quy) -> AST -> tính giá trị.
// Không dùng eval()/Function. Chỉ chấp nhận các ký tự và tên hàm trong danh sách trắng.
import { CalcError } from './errors.ts';
import type { ErrorKind } from './errors.ts';
import { exactEval } from './exact.ts';
import type { Frac } from './exact.ts';
import { binomialPmf, combinations, permutations, probability } from './combinatorics.ts';

export const MAX_LENGTH = 200;
const MAX_DEPTH = 100;
const MAX_STEPS = 5000;
const MAX_FACTORIAL = 170;

export type AngleMode = 'deg' | 'rad';
export interface EvalOptions {
  /** Giá trị của "Ans" (kết quả trước) và dạng phân số chính xác của nó (nếu có). */
  ans?: number | null;
  ansExact?: Frac | null;
  /** Giá trị bộ nhớ "M" và dạng phân số chính xác của nó (nếu có). */
  mem?: number | null;
  memExact?: Frac | null;
  /** Giá trị biến x (dùng khi vẽ đồ thị). */
  x?: number;
  /** Chế độ góc cho hàm lượng giác (mặc định 'deg'). */
  angleMode?: AngleMode;
  /** Tự đóng các dấu ngoặc còn thiếu ở cuối biểu thức. */
  autoCloseParens?: boolean;
}
export type EvalResult =
  | { ok: true; value: number; exact: Frac | null }
  | { ok: false; error: { kind: ErrorKind; message: string } };

type Tok = { k: 'num'; v: number; raw: string } | { k: 'id'; name: string } | { k: 'sym'; ch: string };
export type Node =
  | { t: 'num'; v: number; raw: string }
  | { t: 'const'; name: string }
  | { t: 'un'; op: string; a: Node }
  | { t: 'bin'; op: string; l: Node; r: Node }
  | { t: 'post'; op: string; a: Node }
  | { t: 'call'; name: string; args: Node[] };

const ONE = ['sqrt', 'cbrt', 'abs', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
  'asinh', 'acosh', 'atanh', 'log', 'ln', 'log2', 'exp', 'floor', 'ceil', 'round', 'frac'];
const TWO = ['root', 'logb', 'gcd', 'lcm', 'mod', 'npr', 'ncr', 'prob'];
const THREE = ['binom'];
const FUNCS = new Map<string, number>([...ONE.map((n): [string, number] => [n, 1]), ...TWO.map((n): [string, number] => [n, 2]),
  ...THREE.map((n): [string, number] => [n, 3])]);
const ALIASES = new Map<string, string>([['arcsin', 'asin'], ['arccos', 'acos'], ['arctan', 'atan'],
  ['arsinh', 'asinh'], ['arcsinh', 'asinh'], ['arcosh', 'acosh'], ['arccosh', 'acosh'], ['artanh', 'atanh'],
  ['arctanh', 'atanh'], ['lg', 'log'], ['log10', 'log'], ['perm', 'npr'], ['comb', 'ncr']]);
const CONSTS = new Set(['pi', 'e', 'ans', 'm', 'x']);
const syntax = (m: string) => new CalcError('syntax', m);

function tokenize(src: string): Tok[] {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (num) {
      i += num[0].length;
      if (s[i] === '.') throw syntax('Số không hợp lệ (có hai dấu thập phân).');
      out.push({ k: 'num', v: Number(num[0]), raw: num[0] });
    } else if (/^log(10|2)(?![A-Za-z0-9])/.test(s.slice(i))) {
      const m = /^log(10|2)/.exec(s.slice(i))![0];
      out.push({ k: 'id', name: m }); i += m.length;
    } else if (c === 'π') { out.push({ k: 'id', name: 'pi' }); i++; }
    else if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z]+/.exec(s.slice(i))![0];
      out.push({ k: 'id', name: m.toLowerCase() });
      i += m.length;
    } else if ('+-*/^!%(),√'.includes(c)) { out.push({ k: 'sym', ch: c }); i++; }
    else throw syntax(`Ký tự "${c}" không được hỗ trợ.`);
  }
  return out;
}

class Parser {
  i = 0;
  depth = 0;
  steps = 0;
  toks: Tok[];
  constructor(toks: Tok[]) { this.toks = toks; }

  peek(): Tok | undefined { return this.toks[this.i]; }
  next(): Tok {
    if (++this.steps > MAX_STEPS) throw new CalcError('limit', 'Biểu thức quá phức tạp.');
    return this.toks[this.i++];
  }
  isSym(ch: string): boolean { const t = this.peek(); return !!t && t.k === 'sym' && t.ch === ch; }
  enter() { if (++this.depth > MAX_DEPTH) throw new CalcError('limit', 'Biểu thức lồng nhau quá sâu.'); }
  leave() { this.depth--; }

  parse(): Node {
    const n = this.parseExpr();
    if (this.i < this.toks.length) {
      if (this.isSym(')')) throw syntax('Thừa dấu đóng ngoặc ")".');
      throw syntax('Biểu thức chưa đúng cú pháp.');
    }
    return n;
  }
  parseExpr(): Node {
    this.enter();
    let l = this.parseTerm();
    while (this.isSym('+') || this.isSym('-')) {
      const op = (this.next() as { ch: string }).ch;
      l = { t: 'bin', op, l, r: this.parseTerm() };
    }
    this.leave();
    return l;
  }
  parseTerm(): Node {
    let l = this.parseUnary();
    for (;;) {
      if (this.isSym('*') || this.isSym('/')) {
        const op = (this.next() as { ch: string }).ch;
        l = { t: 'bin', op, l, r: this.parseUnary() };
      } else if (this.startsOperand()) {
        l = { t: 'bin', op: '*', l, r: this.parseUnary() }; // nhân ngầm: 2π, 3(4+1)
      } else return l;
    }
  }
  startsOperand(): boolean {
    const t = this.peek();
    return !!t && (t.k === 'id' || (t.k === 'sym' && (t.ch === '(' || t.ch === '√')));
  }
  parseUnary(): Node {
    this.enter();
    let n: Node;
    if (this.isSym('-') || this.isSym('+')) {
      const op = (this.next() as { ch: string }).ch;
      n = { t: 'un', op, a: this.parseUnary() };
    } else n = this.parsePower();
    this.leave();
    return n;
  }
  parsePower(): Node {
    const base = this.parsePostfix();
    if (this.isSym('^')) {
      this.next();
      return { t: 'bin', op: '^', l: base, r: this.parseUnary() }; // kết hợp phải; -2^2 = -(2^2)
    }
    return base;
  }
  parsePostfix(): Node {
    let n = this.parsePrimary();
    while (this.isSym('!') || this.isSym('%')) n = { t: 'post', op: (this.next() as { ch: string }).ch, a: n };
    return n;
  }
  parsePrimary(): Node {
    const t = this.peek();
    if (!t) throw syntax('Biểu thức chưa hoàn chỉnh: thiếu số hạng.');
    if (t.k === 'num') { this.next(); return { t: 'num', v: t.v, raw: t.raw }; }
    if (t.k === 'sym') {
      if (t.ch === '(') {
        this.next();
        const e = this.parseExpr();
        if (!this.isSym(')')) throw syntax('Thiếu dấu đóng ngoặc ")".');
        this.next();
        return e;
      }
      if (t.ch === '√') { this.next(); return { t: 'call', name: 'sqrt', args: [this.parsePostfix()] }; }
      if (t.ch === ')') throw syntax('Thừa dấu đóng ngoặc ")".');
      throw syntax(`Thiếu số hạng trước "${t.ch}".`);
    }
    this.next();
    const fname = ALIASES.get(t.name) ?? t.name;
    if (FUNCS.has(fname)) {
      if (!this.isSym('(')) throw syntax(`Hàm ${t.name} cần dấu ngoặc, ví dụ ${t.name}(...).`);
      this.next();
      const args: Node[] = [];
      if (!this.isSym(')')) {
        args.push(this.parseExpr());
        while (this.isSym(',')) { this.next(); args.push(this.parseExpr()); }
      }
      if (!this.isSym(')')) throw syntax('Thiếu dấu đóng ngoặc ")".');
      this.next();
      if (args.length !== FUNCS.get(fname)) throw syntax(`Hàm ${t.name} cần ${FUNCS.get(fname)} đối số.`);
      return { t: 'call', name: fname, args };
    }
    if (CONSTS.has(t.name)) return { t: 'const', name: t.name };
    throw syntax(`"${t.name}" chưa được hỗ trợ.`);
  }
}

const finite = (x: number): number => {
  if (Number.isNaN(x)) throw new CalcError('domain', 'Phép tính không xác định.');
  if (!Number.isFinite(x)) throw new CalcError('limit', 'Kết quả vượt giới hạn biểu diễn.');
  return x;
};

function power(b: number, e: number): number {
  if (b === 0 && e === 0) throw new CalcError('domain', '0^0 không xác định.');
  if (b === 0 && e < 0) throw new CalcError('domain', 'Không thể chia cho 0.');
  if (b < 0 && !Number.isInteger(e)) throw new CalcError('domain', 'Lũy thừa không nguyên của số âm không xác định trong số thực.');
  return finite(Math.pow(b, e));
}
function nthRoot(n: number, x: number): number {
  if (n === 0) throw new CalcError('domain', 'Căn bậc 0 không xác định.');
  if (x < 0 && !(Number.isInteger(n) && Math.abs(n) % 2 === 1))
    throw new CalcError('domain', 'Không thể lấy căn bậc chẵn của số âm (chế độ số thực).');
  const r = Math.sign(x) * Math.pow(Math.abs(x), 1 / n);
  const rr = Math.round(r);
  return Number.isInteger(n) && n > 0 && Math.pow(rr, n) === x ? rr : finite(r);
}
function factorial(x: number): number {
  if (!Number.isInteger(x) || x < 0) throw new CalcError('domain', 'Giai thừa chỉ áp dụng cho số nguyên không âm.');
  if (x > MAX_FACTORIAL) throw new CalcError('limit', `Giai thừa quá lớn (tối đa ${MAX_FACTORIAL}!).`);
  let r = 1;
  for (let k = 2; k <= x; k++) r *= k;
  return r;
}

const domain = (m: string) => new CalcError('domain', m);
const snapInt = (r: number) => { const rr = Math.round(r); return Math.abs(r - rr) < 1e-12 * Math.max(1, Math.abs(r)) ? rr : r; };
const snapHalf = (r: number) => { const h = Math.round(r * 2) / 2; return Math.abs(r - h) < 1e-14 ? h : r; };
const toRad = (x: number, m: AngleMode) => (m === 'deg' ? (x * Math.PI) / 180 : x);
const fromRad = (r: number, m: AngleMode) => (m === 'deg' ? snapInt((r * 180) / Math.PI) : r);
const positive = (v: number) => { if (!(v > 0)) throw domain('Logarit chỉ xác định với số dương.'); return v; };
function intArg(x: number, name: string): number {
  if (!Number.isInteger(x)) throw domain(`${name} chỉ áp dụng cho số nguyên.`);
  if (Math.abs(x) > Number.MAX_SAFE_INTEGER) throw new CalcError('limit', `Số quá lớn cho ${name} (tối đa 9007199254740991).`);
  return Math.abs(x);
}
const gcdN = (a: number, b: number) => { while (b) [a, b] = [b, a % b]; return a; };

function callFn(name: string, a: number[], ang: AngleMode): number {
  const x = a[0];
  switch (name) {
    case 'abs': return Math.abs(x);
    case 'sqrt':
      if (x < 0) throw domain('Không thể lấy căn bậc hai của số âm (chế độ số thực).');
      return Math.sqrt(x);
    case 'cbrt': return Math.cbrt(x);
    case 'root': return nthRoot(x, a[1]);
    case 'sin': return snapHalf(Math.sin(toRad(x, ang)));
    case 'cos': return snapHalf(Math.cos(toRad(x, ang)));
    case 'tan': {
      const r = toRad(x, ang);
      if (Math.abs(Math.cos(r)) < 1e-12) throw domain('tan không xác định tại góc mà cos bằng 0.');
      return snapHalf(finite(Math.tan(r)));
    }
    case 'asin': case 'acos': {
      if (Math.abs(x) > 1 + 1e-12) throw domain(`${name === 'asin' ? 'arcsin' : 'arccos'} chỉ xác định với -1 ≤ x ≤ 1.`);
      const c = Math.max(-1, Math.min(1, x));
      return fromRad(name === 'asin' ? Math.asin(c) : Math.acos(c), ang);
    }
    case 'atan': return fromRad(Math.atan(x), ang);
    case 'sinh': return finite(Math.sinh(x));
    case 'cosh': return finite(Math.cosh(x));
    case 'tanh': return Math.tanh(x);
    case 'asinh': return Math.asinh(x);
    case 'acosh':
      if (x < 1) throw domain('arcosh chỉ xác định với x ≥ 1.');
      return Math.acosh(x);
    case 'atanh':
      if (Math.abs(x) >= 1) throw domain('artanh chỉ xác định với -1 < x < 1.');
      return Math.atanh(x);
    case 'log': return snapInt(Math.log10(positive(x)));
    case 'ln': return snapInt(Math.log(positive(x)));
    case 'log2': return snapInt(Math.log2(positive(x)));
    case 'logb':
      if (!(x > 0) || x === 1) throw domain('Cơ số logarit phải dương và khác 1.');
      return snapInt(Math.log(positive(a[1])) / Math.log(x));
    case 'exp': return finite(Math.exp(x));
    case 'gcd': return gcdN(intArg(x, 'GCD'), intArg(a[1], 'GCD'));
    case 'lcm': {
      const p = intArg(x, 'LCM'), q = intArg(a[1], 'LCM');
      return p === 0 || q === 0 ? 0 : finite((p / gcdN(p, q)) * q);
    }
    case 'mod':
      if (a[1] === 0) throw domain('Không thể chia lấy dư cho 0.');
      return x - a[1] * Math.floor(x / a[1]);
    case 'floor': return Math.floor(x);
    case 'ceil': return Math.ceil(x);
    case 'round': return Math.sign(x) * Math.round(Math.abs(x));
    case 'frac': return x - Math.floor(x);
    case 'npr': return Number(permutations(x, a[1]));
    case 'ncr': return Number(combinations(x, a[1]));
    case 'prob': return probability(x, a[1]);
    case 'binom': return binomialPmf(x, a[1], a[2]);
  }
  throw syntax(`"${name}" chưa được hỗ trợ.`);
}

interface Ctx { ans: number | null | undefined; mem: number | null | undefined; ang: AngleMode; x?: number }
function run(n: Node, c: Ctx, st: { steps: number }): number {
  if (++st.steps > MAX_STEPS) throw new CalcError('limit', 'Biểu thức quá phức tạp.');
  switch (n.t) {
    case 'num': return n.v;
    case 'const':
      if (n.name === 'pi') return Math.PI;
      if (n.name === 'e') return Math.E;
      if (n.name === 'x') {
        if (c.x === undefined) throw syntax('Biến x chỉ dùng được khi vẽ đồ thị y = f(x).');
        return c.x;
      }
      if (n.name === 'm') {
        if (c.mem === null || c.mem === undefined) throw syntax('Bộ nhớ đang trống (M chưa có giá trị).');
        return c.mem;
      }
      if (c.ans === null || c.ans === undefined) throw syntax('Chưa có kết quả trước để dùng Ans.');
      return c.ans;
    case 'un': { const a = run(n.a, c, st); return n.op === '-' ? -a : a; }
    case 'post': { const a = run(n.a, c, st); return n.op === '!' ? factorial(a) : finite(a / 100); }
    case 'bin': {
      const l = run(n.l, c, st);
      if ((n.op === '+' || n.op === '-') && n.r.t === 'post' && n.r.op === '%') {
        const part = finite((l * run(n.r.a, c, st)) / 100); // 200+10% = 220 (kiểu Casio)
        return finite(n.op === '+' ? l + part : l - part);
      }
      const r = run(n.r, c, st);
      if (n.op === '+') return finite(l + r);
      if (n.op === '-') return finite(l - r);
      if (n.op === '*') return finite(l * r);
      if (n.op === '/') {
        if (r === 0) throw domain('Không thể chia cho 0.');
        return finite(l / r);
      }
      return power(l, r);
    }
    case 'call': return finite(callFn(n.name, n.args.map((x) => run(x, c, st)), c.ang));
  }
}

function parseInput(input: string, autoClose: boolean): Node {
  if (input.trim() === '') throw syntax('Chưa nhập biểu thức.');
  if (input.length > MAX_LENGTH) throw new CalcError('limit', `Biểu thức quá dài (tối đa ${MAX_LENGTH} ký tự).`);
  const toks = tokenize(input);
  if (autoClose) {
    let bal = 0;
    for (const t of toks) if (t.k === 'sym') bal += t.ch === '(' ? 1 : t.ch === ')' ? -1 : 0;
    for (; bal > 0; bal--) toks.push({ k: 'sym', ch: ')' });
  }
  return new Parser(toks).parse();
}

export function evaluate(input: string, opts: EvalOptions = {}): EvalResult {
  try {
    const ast = parseInput(input, !!opts.autoCloseParens);
    const value = finite(run(ast, { ans: opts.ans, mem: opts.mem, ang: opts.angleMode ?? 'deg', x: opts.x }, { steps: 0 }));
    let exact: Frac | null = null;
    try { exact = exactEval(ast, opts.ansExact ?? null, opts.memExact ?? null); } catch { exact = null; }
    return { ok: true, value, exact };
  } catch (e) {
    if (e instanceof CalcError) return { ok: false, error: { kind: e.kind, message: e.message } };
    return { ok: false, error: { kind: 'limit', message: 'Không thể tính biểu thức này.' } };
  }
}

export type CompileResult =
  | { ok: true; f: (x: number) => number }
  | { ok: false; error: { kind: ErrorKind; message: string } };

/**
 * Phân tích biểu thức theo biến x một lần, trả về hàm f(x). f trả NaN tại điểm không xác định
 * (chia 0, log số âm, tràn số...). Lỗi cú pháp được báo ngay khi biên dịch.
 */
export function compile(input: string, opts: { angleMode?: AngleMode } = {}): CompileResult {
  try {
    const ast = parseInput(input, true);
    const ang = opts.angleMode ?? 'deg';
    const f = (x: number): number => {
      try { return finite(run(ast, { ans: undefined, mem: undefined, ang, x }, { steps: 0 })); } catch { return NaN; }
    };
    // Thử một vài điểm để bắt lỗi cú pháp ẩn (Ans, M...) mà chỉ lộ ra khi tính.
    for (const x of [0.5, 1, 2]) {
      try { run(ast, { ans: undefined, mem: undefined, ang, x }, { steps: 0 }); } catch (e) {
        if (e instanceof CalcError && e.kind === 'syntax') throw e;
      }
    }
    return { ok: true, f };
  } catch (e) {
    if (e instanceof CalcError) return { ok: false, error: { kind: e.kind, message: e.message } };
    return { ok: false, error: { kind: 'limit', message: 'Không thể phân tích biểu thức này.' } };
  }
}
