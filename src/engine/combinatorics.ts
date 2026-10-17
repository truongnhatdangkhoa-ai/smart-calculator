// Tổ hợp, hoán vị, xác suất cơ bản. Tính bằng BigInt nên chính xác tuyệt đối.
import { CalcError } from './errors.ts';

/** Giới hạn n để tránh tính quá lâu / kết quả vượt giới hạn biểu diễn. */
export const MAX_COMB_N = 1000;
const dom = (m: string) => new CalcError('domain', m);

/** Kiểm tra 0 ≤ k ≤ n, cả hai là số nguyên không âm, n không quá lớn. */
export function checkNK(n: number, k: number, label: string): void {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0)
    throw dom(`${label}: n và k phải là số nguyên không âm.`);
  if (k > n) throw dom(`${label}: k không được lớn hơn n (cần 0 ≤ k ≤ n).`);
  if (n > MAX_COMB_N) throw new CalcError('limit', `${label}: n = ${n} quá lớn (tối đa ${MAX_COMB_N}).`);
}

/** Chỉnh hợp A(n,k) = n!/(n−k)! (không kiểm tra điều kiện). */
export function permBig(n: bigint, k: bigint): bigint {
  let r = 1n;
  for (let i = 0n; i < k; i++) r *= n - i;
  return r;
}
/** Tổ hợp C(n,k) = n!/(k!(n−k)!) (không kiểm tra điều kiện). */
export function combBig(n: bigint, k: bigint): bigint {
  const kk = k < n - k ? k : n - k;
  let r = 1n;
  for (let i = 1n; i <= kk; i++) r = (r * (n - kk + i)) / i; // mỗi bước chia hết
  return r;
}

export function permutations(n: number, k: number): bigint {
  checkNK(n, k, 'nPr');
  return permBig(BigInt(n), BigInt(k));
}
export function combinations(n: number, k: number): bigint {
  checkNK(n, k, 'nCr');
  return combBig(BigInt(n), BigInt(k));
}

/** Xác suất cổ điển: m trường hợp thuận lợi trên tổng n trường hợp đồng khả năng. */
export function checkProb(m: number, n: number): void {
  if (!Number.isInteger(m) || !Number.isInteger(n) || m < 0 || n < 0)
    throw dom('prob(m, n): m và n phải là số nguyên không âm.');
  if (n < 1) throw dom('prob(m, n): tổng số trường hợp n phải ≥ 1.');
  if (m > n) throw dom('prob(m, n): số trường hợp thuận lợi m không được lớn hơn n.');
  if (n > Number.MAX_SAFE_INTEGER) throw new CalcError('limit', 'prob(m, n): số quá lớn (tối đa 9007199254740991).');
}
export const probability = (m: number, n: number): number => { checkProb(m, n); return m / n; };

/** Xác suất nhị thức: P(X = k) = C(n,k)·pᵏ·(1−p)ⁿ⁻ᵏ. */
export function checkBinom(n: number, k: number, p: number): void {
  checkNK(n, k, 'binom');
  if (!(p >= 0 && p <= 1)) throw dom('binom(n, k, p): xác suất p phải nằm trong đoạn [0, 1].');
}
export function binomialPmf(n: number, k: number, p: number): number {
  checkBinom(n, k, p);
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  const c = Number(combBig(BigInt(n), BigInt(k)));
  const direct = c * Math.pow(p, k) * Math.pow(1 - p, n - k);
  if (c < 1e150 && Number.isFinite(direct) && direct > 1e-290) return direct;
  const kk = Math.min(k, n - k);
  let lnC = 0;
  for (let i = 1; i <= kk; i++) lnC += Math.log((n - kk + i) / i);
  return Math.exp(lnC + k * Math.log(p) + (n - k) * Math.log1p(-p));
}
