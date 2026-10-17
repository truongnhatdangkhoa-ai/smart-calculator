const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (e: number) => String(e).split('').map((c) => SUP[Number(c)]).join('');
export const MAX_FACTOR = 1_000_000_000_000n;

/** Phân tích thừa số nguyên tố cho 2 ≤ n ≤ 10^12 (chia thử). */
export function factorize(n: bigint): [number, number][] | null {
  if (n < 2n || n > MAX_FACTOR) return null;
  let x = Number(n);
  const out: [number, number][] = [];
  for (let p = 2; p * p <= x; p += p === 2 ? 1 : 2) {
    let e = 0;
    while (x % p === 0) { x /= p; e++; }
    if (e) out.push([p, e]);
  }
  if (x > 1) out.push([x, 1]);
  return out;
}

/** Mô tả số nguyên: nguyên tố hay hợp số và phân tích thừa số. null nếu không áp dụng. */
export function describeInteger(n: bigint): string | null {
  if (n === 1n) return '1 không phải số nguyên tố, cũng không phải hợp số.';
  if (n < 2n) return null;
  const f = factorize(n);
  if (!f) return 'Số quá lớn để phân tích thừa số (tối đa 1 000 000 000 000).';
  if (f.length === 1 && f[0][1] === 1) return `${n} là số nguyên tố.`;
  return `${n} = ${f.map(([p, e]) => (e > 1 ? `${p}${sup(e)}` : String(p))).join(' × ')} (hợp số)`;
}
