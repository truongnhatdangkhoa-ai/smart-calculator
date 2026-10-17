// Tính chính xác bằng phân số (BigInt). Trả về null nếu biểu thức không phải số hữu tỉ
// biểu diễn được (hàm lượng giác, log, π, căn không chính phương, số quá lớn...).
import type { Node } from './evaluate.ts';
import { checkBinom, checkNK, checkProb, combBig, permBig } from './combinatorics.ts';

export interface Frac { n: bigint; d: bigint }
const LIMIT = 10n ** 300n;
const abs = (x: bigint) => (x < 0n ? -x : x);
export const bgcd = (a: bigint, b: bigint): bigint => {
  a = abs(a); b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
function mk(n: bigint, d: bigint): Frac | null {
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  const g = bgcd(n, d) || 1n;
  n /= g; d /= g;
  return abs(n) > LIMIT || d > LIMIT ? null : { n, d };
}
export const fracAdd = (a: Frac, b: Frac) => mk(a.n * b.d + b.n * a.d, a.d * b.d);
export const fracSub = (a: Frac, b: Frac) => mk(a.n * b.d - b.n * a.d, a.d * b.d);
const add = (a: Frac, b: Frac) => mk(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Frac, b: Frac) => mk(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac) => mk(a.n * b.n, a.d * b.d);
const div = (a: Frac, b: Frac) => (b.n === 0n ? null : mk(a.n * b.d, a.d * b.n));
const floorDiv = (n: bigint, d: bigint) => { const q = n / d; return n < 0n && n % d !== 0n ? q - 1n : q; };
const floorF = (a: Frac): Frac => ({ n: floorDiv(a.n, a.d), d: 1n });
const HALF: Frac = { n: 1n, d: 2n };

function fromRaw(raw: string): Frac | null {
  const [ip, fp = ''] = raw.split('.');
  return mk(BigInt((ip || '0') + fp), 10n ** BigInt(fp.length));
}
function intRoot(x: bigint, k: number): bigint | null {
  if (x < 2n) return x;
  const K = BigInt(k);
  let lo = 1n, hi = 1n << BigInt(Math.ceil(x.toString(2).length / k) + 1);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1n, p = mid ** K;
    if (p === x) return mid;
    if (p < x) lo = mid + 1n; else hi = mid - 1n;
  }
  return null;
}
function rootF(a: Frac, k: number): Frac | null {
  if (k < 1) return null;
  const neg = a.n < 0n;
  if (neg && k % 2 === 0) return null;
  const rn = intRoot(abs(a.n), k), rd = intRoot(a.d, k);
  return rn === null || rd === null ? null : mk(neg ? -rn : rn, rd);
}
function powF(a: Frac, e: Frac): Frac | null {
  if (e.d !== 1n) {
    if (e.d > 64n) return null;
    const r = rootF(a, Number(e.d));
    return r && powF(r, { n: e.n, d: 1n });
  }
  const p = abs(e.n);
  if (p > 1000n) return null;
  if (a.n === 0n) return e.n > 0n ? a : null;
  if (a.d === 1n && (a.n === 1n || a.n === -1n)) return a.n === 1n || p % 2n === 0n ? { n: 1n, d: 1n } : a;
  if ((a.n.toString().length + a.d.toString().length) * Number(p) > 600) return null;
  const n = a.n ** p, d = a.d ** p;
  return e.n < 0n ? mk(d, n) : mk(n, d);
}

export function exactEval(n: Node, ans: Frac | null, mem: Frac | null = null): Frac | null {
  switch (n.t) {
    case 'num': return fromRaw(n.raw);
    case 'const': return n.name === 'ans' ? ans : n.name === 'm' ? mem : null;
    case 'un': { const a = exactEval(n.a, ans, mem); return a && (n.op === '-' ? { n: -a.n, d: a.d } : a); }
    case 'post': {
      const a = exactEval(n.a, ans, mem);
      if (!a) return null;
      if (n.op === '%') return mk(a.n, a.d * 100n);
      if (a.d !== 1n || a.n < 0n || a.n > 170n) return null;
      let r = 1n;
      for (let k = 2n; k <= a.n; k++) r *= k;
      return { n: r, d: 1n };
    }
    case 'bin': {
      const l = exactEval(n.l, ans, mem);
      if ((n.op === '+' || n.op === '-') && n.r.t === 'post' && n.r.op === '%') {
        const p = exactEval(n.r.a, ans, mem);
        const part = l && p && mul(l, { n: p.n, d: p.d * 100n });
        return l && part && (n.op === '+' ? add(l, part) : sub(l, part));
      }
      const r = exactEval(n.r, ans, mem);
      if (!l || !r) return null;
      switch (n.op) {
        case '+': return add(l, r);
        case '-': return sub(l, r);
        case '*': return mul(l, r);
        case '/': return div(l, r);
        default: return powF(l, r);
      }
    }
    case 'call': {
      const a = n.args.map((x) => exactEval(x, ans, mem));
      if (a.some((x) => x === null)) return null;
      const x = a[0]!, y = a[1];
      switch (n.name) {
        case 'abs': return { n: abs(x.n), d: x.d };
        case 'sqrt': return rootF(x, 2);
        case 'cbrt': return rootF(x, 3);
        case 'root': {
          if (x.d !== 1n || x.n === 0n || abs(x.n) > 64n) return null;
          const k = Number(x.n);
          if (k > 0) return rootF(y!, k);
          const r = rootF(y!, -k);
          return r && div({ n: 1n, d: 1n }, r);
        }
        case 'gcd': case 'lcm': {
          if (x.d !== 1n || y!.d !== 1n) return null;
          const g = bgcd(x.n, y!.n);
          if (n.name === 'gcd') return { n: g, d: 1n };
          return x.n === 0n || y!.n === 0n ? { n: 0n, d: 1n } : mk(abs((x.n / g) * y!.n), 1n);
        }
        case 'mod': { const q = div(x, y!); const f = q && floorF(q); const m = f && mul(y!, f); return m && sub(x, m); }
        case 'floor': return floorF(x);
        case 'ceil': { const f = floorF({ n: -x.n, d: x.d }); return { n: -f.n, d: 1n }; }
        case 'round': {
          if (x.n >= 0n) return floorF(add(x, HALF)!);
          const f = floorF(add({ n: -x.n, d: x.d }, HALF)!);
          return { n: -f.n, d: 1n };
        }
        case 'frac': return sub(x, floorF(x));
        case 'npr': case 'ncr': {
          if (x.d !== 1n || y!.d !== 1n) return null;
          checkNK(Number(x.n), Number(y!.n), n.name); // ném lỗi nếu sai điều kiện -> không có dạng chính xác
          return mk(n.name === 'npr' ? permBig(x.n, y!.n) : combBig(x.n, y!.n), 1n);
        }
        case 'prob': {
          if (x.d !== 1n || y!.d !== 1n) return null;
          checkProb(Number(x.n), Number(y!.n));
          return mk(x.n, y!.n);
        }
        case 'binom': {
          const p = a[2]!;
          if (x.d !== 1n || y!.d !== 1n) return null;
          if (p.n < 0n || p.n > p.d) return null;
          checkBinom(Number(x.n), Number(y!.n), 0.5); // chỉ kiểm tra n, k (p đã kiểm tra ở trên)
          const q = sub({ n: 1n, d: 1n }, p);
          const c: Frac = { n: combBig(x.n, y!.n), d: 1n };
          const a1 = q && powF(p, { n: y!.n, d: 1n });
          const a2 = q && powF(q, { n: x.n - y!.n, d: 1n });
          const t = a1 && a2 && mul(c, a1);
          return t && a2 && mul(t, a2);
        }
        default: return null;
      }
    }
  }
}
