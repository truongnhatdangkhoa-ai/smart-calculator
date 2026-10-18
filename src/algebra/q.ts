// Số hữu tỉ chính xác (BigInt) dùng cho đại số: đa thức, phương trình, hệ phương trình.
// Không làm tròn: mọi phép tính đều chính xác; vượt giới hạn thì báo lỗi rõ ràng.

export class AlgebraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlgebraError';
  }
}

export interface Q { n: bigint; d: bigint }

const MAX_DIGITS = 80;
const abs = (x: bigint) => (x < 0n ? -x : x);

export const gcdB = (a: bigint, b: bigint): bigint => {
  a = abs(a); b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

function mk(n: bigint, d: bigint): Q {
  if (d === 0n) throw new AlgebraError('Không thể chia cho 0.');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcdB(n, d) || 1n;
  n /= g; d /= g;
  if (abs(n).toString().length > MAX_DIGITS || d.toString().length > MAX_DIGITS) {
    throw new AlgebraError('Số quá lớn để tính chính xác.');
  }
  return { n, d };
}

export const qInt = (n: number | bigint): Q => mk(BigInt(n), 1n);
export const qFrom = (n: bigint, d: bigint): Q => mk(n, d);
export const Q0: Q = { n: 0n, d: 1n };
export const Q1: Q = { n: 1n, d: 1n };

export const qAdd = (a: Q, b: Q) => mk(a.n * b.d + b.n * a.d, a.d * b.d);
export const qSub = (a: Q, b: Q) => mk(a.n * b.d - b.n * a.d, a.d * b.d);
export const qMul = (a: Q, b: Q) => mk(a.n * b.n, a.d * b.d);
export const qDiv = (a: Q, b: Q) => {
  if (b.n === 0n) throw new AlgebraError('Không thể chia cho 0.');
  return mk(a.n * b.d, a.d * b.n);
};
export const qNeg = (a: Q): Q => ({ n: -a.n, d: a.d });
export const qIsZero = (a: Q) => a.n === 0n;
export const qEq = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
export const qSign = (a: Q) => (a.n < 0n ? -1 : a.n > 0n ? 1 : 0);
export const qAbs = (a: Q): Q => ({ n: abs(a.n), d: a.d });
export const qIsInt = (a: Q) => a.d === 1n;

export function qPow(a: Q, e: number): Q {
  if (!Number.isInteger(e) || e < 0 || e > 1000) throw new AlgebraError('Số mũ phải là số nguyên từ 0 đến 1000.');
  let r = Q1;
  for (let i = 0; i < e; i++) r = qMul(r, a);
  return r;
}

export const qToNumber = (a: Q): number => Number(a.n) / Number(a.d);

/** Dạng chữ dùng dấu trừ "−" (U+2212) để hiển thị: "−3/4". */
export const qText = (a: Q): string => `${a.n < 0n ? '−' : ''}${abs(a.n)}${a.d === 1n ? '' : `/${a.d}`}`;
/** Như qText nhưng thêm ngoặc khi âm hoặc là phân số (để chèn vào biểu thức). */
export const qParen = (a: Q): string => (a.n < 0n ? `(${qText(a)})` : a.d === 1n ? qText(a) : `(${qText(a)})`);

/**
 * Đọc số hữu tỉ từ chuỗi người dùng nhập: "3", "-3", "0.25", "0,25", "1/2", "-3/4", "1.5/0.5".
 * Trả về null nếu không hợp lệ hoặc mẫu bằng 0.
 */
export function parseQ(text: string): Q | null {
  const s = text.trim().replace(/[−–]/g, '-').replace(/,/g, '.').replace(/\s+/g, '');
  const m = /^([+-]?)(\d+(?:\.\d+)?|\.\d+)(?:\/(\d+(?:\.\d+)?|\.\d+))?$/.exec(s);
  if (!m) return null;
  try {
    const num = decimal(m[2]);
    const val = m[3] === undefined ? num : qDiv(num, decimal(m[3]));
    return m[1] === '-' ? qNeg(val) : val;
  } catch { return null; }
}
function decimal(raw: string): Q {
  const [ip, fp = ''] = raw.split('.');
  return mk(BigInt((ip || '0') + fp), 10n ** BigInt(fp.length));
}

/** Căn bậc hai nguyên (phần nguyên) của số BigInt không âm. */
export function isqrtB(n: bigint): bigint {
  if (n < 0n) throw new AlgebraError('Căn của số âm.');
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

/** Căn bậc hai chính xác nếu là số hữu tỉ, ngược lại null. */
export function qSqrtExact(a: Q): Q | null {
  if (a.n < 0n) return null;
  const rn = isqrtB(a.n), rd = isqrtB(a.d);
  return rn * rn === a.n && rd * rd === a.d ? mk(rn, rd) : null;
}

/** √N = k·√m với m không chứa thừa số chính phương (nếu N đủ nhỏ để phân tích). */
export function simplifySqrt(N: bigint): { k: bigint; m: bigint } {
  if (N < 0n) throw new AlgebraError('Căn của số âm.');
  let k = 1n, m = N;
  if (m === 0n) return { k: 0n, m: 1n };
  for (let p = 2n; p <= 100000n && p * p <= m; p++) {
    while (m % (p * p) === 0n) { m /= p * p; k *= p; }
  }
  const r = isqrtB(m);
  if (r * r === m) { k *= r; m = 1n; }
  return { k, m };
}
