// Công cụ đại số: phương trình bậc hai/bậc nhất, hệ hai phương trình bậc nhất hai ẩn, nhị thức Newton.
// Mọi bước tính bằng phân số chính xác; chỉ phần "≈" mới là số thập phân gần đúng.
import { sup } from './poly.ts';
import {
  AlgebraError, gcdB, qAdd, qDiv, qInt, qIsInt, qIsZero, qMul, qNeg, qParen, qSign, qSqrtExact, qSub,
  qText, qToNumber, simplifySqrt,
} from './q.ts';
import type { Q } from './q.ts';

export interface Answer { label: string; text: string; approx?: number }
export interface SolveResult {
  steps: string[];
  answers: Answer[];
  notes: string[];
}

const bigAbs = (x: bigint) => (x < 0n ? -x : x);
const lcmB = (a: bigint, b: bigint) => (a / gcdB(a, b)) * b;

function lhsText(a: Q, b: Q, c: Q): string {
  const t = (q: Q, v: string, first: boolean) => {
    if (qIsZero(q)) return '';
    const neg = qSign(q) < 0;
    const mag = neg ? qNeg(q) : q;
    const body = (mag.n === 1n && mag.d === 1n && v) ? v : `${qText(mag)}${v}`;
    return first ? `${neg ? '−' : ''}${body}` : ` ${neg ? '−' : '+'} ${body}`;
  };
  let out = '', first = true;
  for (const [q, v] of [[a, 'x²'], [b, 'x'], [c, '']] as [Q, string][]) {
    const s = t(q, v, first);
    if (s) { out += s; first = false; }
  }
  return `${out || '0'} = 0`;
}

/** Giải ax² + bx + c = 0 (a, b, c hữu tỉ). Có xử lý a = 0 (bậc nhất) và các trường hợp suy biến. */
export function solveQuadratic(a: Q, b: Q, c: Q): SolveResult {
  const steps: string[] = [];
  const answers: Answer[] = [];
  const notes: string[] = [];

  if (qIsZero(a)) {
    steps.push('Vì a = 0 nên đây là phương trình bậc nhất: bx + c = 0.');
    if (qIsZero(b)) {
      steps.push(qIsZero(c) ? 'b = 0 và c = 0: phương trình trở thành 0 = 0.' : `b = 0 và c ≠ 0: phương trình trở thành ${qText(c)} = 0.`);
      answers.push({ label: 'Kết luận', text: qIsZero(c) ? 'Vô số nghiệm (mọi x đều thỏa).' : 'Vô nghiệm.' });
    } else {
      const x = qDiv(qNeg(c), b);
      steps.push(`x = −c/b = −${qParen(c)}/${qParen(b)} = ${qText(x)}`);
      answers.push({ label: 'Nghiệm', text: `x = ${qText(x)}`, approx: qIsInt(x) ? undefined : qToNumber(x) });
    }
    return { steps, answers, notes };
  }

  steps.push(`Phương trình: ${lhsText(a, b, c)}, với a = ${qText(a)}, b = ${qText(b)}, c = ${qText(c)}.`);
  const disc = qSub(qMul(b, b), qMul(qInt(4), qMul(a, c)));
  steps.push(`Δ = b² − 4ac = ${qParen(b)}² − 4·${qParen(a)}·${qParen(c)} = ${qText(disc)}`);

  const twoA = qMul(qInt(2), a);
  const xv = qDiv(qNeg(b), twoA);
  const yv = qDiv(qNeg(disc), qMul(qInt(4), a));

  if (qSign(disc) < 0) {
    steps.push('Δ < 0 nên phương trình không có nghiệm thực.');
    answers.push({ label: 'Kết luận', text: 'Vô nghiệm trong tập số thực.' });
  } else if (qIsZero(disc)) {
    steps.push('Δ = 0 nên phương trình có nghiệm kép: x₁ = x₂ = −b/(2a).');
    answers.push({ label: 'Nghiệm kép', text: `x = ${qText(xv)}`, approx: qIsInt(xv) ? undefined : qToNumber(xv) });
  } else {
    steps.push('Δ > 0 nên phương trình có hai nghiệm phân biệt: x = (−b ± √Δ)/(2a).');
    const exact = qSqrtExact(disc);
    if (exact) {
      const r1 = qDiv(qAdd(qNeg(b), exact), twoA), r2 = qDiv(qSub(qNeg(b), exact), twoA);
      const [lo, hi] = qToNumber(r1) <= qToNumber(r2) ? [r1, r2] : [r2, r1];
      steps.push(`√Δ = ${qText(exact)}`);
      answers.push({ label: 'x₁', text: `x₁ = ${qText(lo)}`, approx: qIsInt(lo) ? undefined : qToNumber(lo) });
      answers.push({ label: 'x₂', text: `x₂ = ${qText(hi)}`, approx: qIsInt(hi) ? undefined : qToNumber(hi) });
      notes.push(`Phân tích: ${lhsText(a, b, c).replace(' = 0', '')} = ${qIsInt(a) && a.n === 1n ? '' : `${qParen(a)}·`}(x − ${qParen(lo)})(x − ${qParen(hi)})`);
    } else {
      // đưa về hệ số nguyên rồi rút gọn căn: √D = k√m (D cùng dấu và cùng "độ vô tỉ" với Δ)
      const L = lcmB(lcmB(a.d, b.d), c.d);
      const A = a.n * (L / a.d), B = b.n * (L / b.d), C = c.n * (L / c.d);
      const D = B * B - 4n * A * C;
      const { k, m } = simplifySqrt(D);
      const g = gcdB(gcdB(B, k), 2n * A) || 1n;
      let den = (2n * A) / g, num0 = -B / g;
      const kk = k / g;
      if (den < 0n) { den = -den; num0 = -num0; }
      const root = `${kk === 1n ? '' : kk}√${m}`;
      const surd = (sign: '+' | '−') => {
        const top = num0 === 0n ? (sign === '+' ? root : `−${root}`) : `${num0 < 0n ? '−' : ''}${bigAbs(num0)} ${sign} ${root}`;
        if (den === 1n) return top;
        return num0 === 0n ? `${top}/${den}` : `(${top})/${den}`;
      };
      const val = (t: 1 | -1) => (Number(num0) + t * Number(kk) * Math.sqrt(Number(m))) / Number(den);
      const items = [{ text: surd('−'), v: val(-1) }, { text: surd('+'), v: val(1) }].sort((p, q) => p.v - q.v);
      if (L === 1n) steps.push(`√Δ = ${k === 1n ? '' : k}√${m}`);
      else steps.push('Δ không phải bình phương của một số hữu tỉ nên √Δ là số vô tỉ.');
      for (const [i, it] of items.entries()) {
        answers.push({ label: `x${i === 0 ? '₁' : '₂'}`, text: `x${i === 0 ? '₁' : '₂'} = ${it.text}`, approx: Number.isFinite(it.v) ? it.v : undefined });
      }
      notes.push('Nghiệm là số vô tỉ nên giá trị thập phân chỉ là gần đúng (≈).');
    }
    notes.push(`Vi-ét: x₁ + x₂ = −b/a = ${qText(qDiv(qNeg(b), a))}; x₁·x₂ = c/a = ${qText(qDiv(c, a))}`);
  }
  notes.push(`Đỉnh parabol y = ax² + bx + c: x = −b/(2a) = ${qText(xv)}, y = −Δ/(4a) = ${qText(yv)}`);
  return { steps, answers, notes };
}

/** Giải hệ a1·x + b1·y = c1; a2·x + b2·y = c2 bằng định thức (Cramer), chính xác. */
export function solveSystem2(a1: Q, b1: Q, c1: Q, a2: Q, b2: Q, c2: Q): SolveResult {
  const D = qSub(qMul(a1, b2), qMul(a2, b1));
  const Dx = qSub(qMul(c1, b2), qMul(c2, b1));
  const Dy = qSub(qMul(a1, c2), qMul(a2, c1));
  const steps = [
    `D = a₁b₂ − a₂b₁ = ${qParen(a1)}·${qParen(b2)} − ${qParen(a2)}·${qParen(b1)} = ${qText(D)}`,
    `Dₓ = c₁b₂ − c₂b₁ = ${qParen(c1)}·${qParen(b2)} − ${qParen(c2)}·${qParen(b1)} = ${qText(Dx)}`,
    `Dᵧ = a₁c₂ − a₂c₁ = ${qParen(a1)}·${qParen(c2)} − ${qParen(a2)}·${qParen(c1)} = ${qText(Dy)}`,
  ];
  const answers: Answer[] = [];
  const notes: string[] = [];
  if (!qIsZero(D)) {
    const x = qDiv(Dx, D), y = qDiv(Dy, D);
    steps.push('D ≠ 0 nên hệ có nghiệm duy nhất: x = Dₓ/D, y = Dᵧ/D.');
    answers.push({ label: 'x', text: `x = ${qText(x)}`, approx: qIsInt(x) ? undefined : qToNumber(x) });
    answers.push({ label: 'y', text: `y = ${qText(y)}`, approx: qIsInt(y) ? undefined : qToNumber(y) });
    notes.push(`Kiểm tra: ${qText(qAdd(qMul(a1, x), qMul(b1, y)))} = ${qText(c1)} và ${qText(qAdd(qMul(a2, x), qMul(b2, y)))} = ${qText(c2)}`);
    return { steps, answers, notes };
  }
  const allZero = [a1, b1, a2, b2].every(qIsZero);
  const consistent = allZero ? qIsZero(c1) && qIsZero(c2) : qIsZero(Dx) && qIsZero(Dy);
  steps.push('D = 0 nên hệ không có nghiệm duy nhất.');
  if (!consistent) {
    answers.push({ label: 'Kết luận', text: 'Vô nghiệm (hai phương trình mâu thuẫn nhau).' });
  } else if (allZero) {
    answers.push({ label: 'Kết luận', text: 'Vô số nghiệm: mọi cặp (x, y) đều thỏa.' });
  } else {
    const row = !qIsZero(a1) || !qIsZero(b1) ? [a1, b1, c1] : [a2, b2, c2];
    answers.push({ label: 'Kết luận', text: 'Vô số nghiệm: hai phương trình biểu diễn cùng một đường thẳng.' });
    notes.push(`Mọi cặp (x, y) thỏa ${qText(row[0])}x + ${qText(row[1])}y = ${qText(row[2])} đều là nghiệm.`);
  }
  return { steps, answers, notes };
}

export const MAX_NEWTON_N = 20;

/** Hệ số nhị thức C(n, k), k = 0..n (BigInt, chính xác). */
export function binomialRow(n: number): bigint[] {
  if (!Number.isInteger(n) || n < 0 || n > MAX_NEWTON_N) throw new AlgebraError(`n phải là số nguyên từ 0 đến ${MAX_NEWTON_N}.`);
  const row: bigint[] = [1n];
  for (let k = 1; k <= n; k++) row.push((row[k - 1] * BigInt(n - k + 1)) / BigInt(k));
  return row;
}

/** Khai triển (a + b)ⁿ hoặc (a − b)ⁿ thành chuỗi: "a³ + 3a²b + 3ab² + b³". */
export function newtonExpansion(n: number, minus: boolean): { text: string; row: bigint[] } {
  const row = binomialRow(n);
  const parts: string[] = [];
  row.forEach((c, k) => {
    const pa = n - k, pb = k;
    const vars = `${pa > 0 ? `a${pa > 1 ? sup(pa) : ''}` : ''}${pb > 0 ? `b${pb > 1 ? sup(pb) : ''}` : ''}`;
    const body = c === 1n && vars ? vars : `${c}${vars}`;
    const neg = minus && k % 2 === 1;
    parts.push(parts.length === 0 ? body : `${neg ? '−' : '+'} ${body}`);
  });
  return { text: parts.join(' '), row };
}

