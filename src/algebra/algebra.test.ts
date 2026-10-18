import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQ, qText, qSqrtExact, simplifySqrt, qFrom, qInt } from './q.ts';
import { parsePoly, polyText, pEq } from './poly.ts';
import { binomialRow, newtonExpansion, solveQuadratic, solveSystem2 } from './solvers.ts';

const P = (s: string) => {
  const r = parsePoly(s);
  assert.ok(r.ok, r.ok ? '' : r.error);
  return r.poly;
};
const expand = (s: string) => polyText(P(s));
const Q = (s: string) => parseQ(s)!;

test('parseQ: số nguyên, thập phân, dấu phẩy, phân số, lỗi', () => {
  assert.equal(qText(Q('3')), '3');
  assert.equal(qText(Q('-3/6')), '−1/2');
  assert.equal(qText(Q('0,25')), '1/4');
  assert.equal(qText(Q('1.5/0.5')), '3');
  assert.equal(parseQ('1/0'), null);
  assert.equal(parseQ('abc'), null);
  assert.equal(parseQ(''), null);
});

test('căn chính xác và rút gọn căn', () => {
  assert.deepEqual(qSqrtExact(qFrom(9n, 4n)), qFrom(3n, 2n));
  assert.equal(qSqrtExact(qInt(2)), null);
  assert.deepEqual(simplifySqrt(72n), { k: 6n, m: 2n });
  assert.deepEqual(simplifySqrt(20n), { k: 2n, m: 5n });
  assert.deepEqual(simplifySqrt(49n), { k: 7n, m: 1n });
  assert.deepEqual(simplifySqrt(30n), { k: 1n, m: 30n });
});

test('khai triển các hằng đẳng thức đáng nhớ', () => {
  assert.equal(expand('(2x+3)^2'), '4x² + 12x + 9');
  assert.equal(expand('(x-1)^2'), 'x² − 2x + 1');
  assert.equal(expand('(x-2)(x+2)'), 'x² − 4');
  assert.equal(expand('(x+1)^3'), 'x³ + 3x² + 3x + 1');
  assert.equal(expand('(x-1)^3'), 'x³ − 3x² + 3x − 1');
  assert.equal(expand('(x+1)(x^2-x+1)'), 'x³ + 1');
  assert.equal(expand('(x-1)(x^2+x+1)'), 'x³ − 1');
});

test('đa thức: nhân ngầm, phân số, dấu Unicode, số mũ lên trên', () => {
  assert.equal(expand('2x(x+3)'), '2x² + 6x');
  assert.equal(expand('x/2 + x/3'), '(5/6)x');
  assert.equal(expand('(x+1)²'), 'x² + 2x + 1');
  assert.equal(expand('(2x−1)×(2x+1)'), '4x² − 1');
  assert.equal(expand('0,5x + 0.5x'), 'x');
  assert.equal(expand('x - x'), '0');
  assert.equal(expand('-(x+1)'), '−x − 1');
  assert.equal(expand('3'), '3');
  assert.equal(expand('1/2x'), '(1/2)x');
  assert.equal(expand('(y+2)^2'), 'y² + 4y + 4'.replace(/y/g, 'x')); // biến đổi tên: polyText mặc định in x
  const r = parsePoly('(y+2)^2');
  assert.ok(r.ok && r.variable === 'y');
  assert.ok(r.ok && polyText(r.poly, 'y') === 'y² + 4y + 4');
});

test('đa thức: nhận lỗi rõ ràng', () => {
  for (const bad of ['', '(x+1', 'x+1)', 'x^-1', 'x^y', 'sin(x)', 'xy', 'x+y', '1/x', 'x/0', '2 3', 'x^2^3', 'x^100', '3 $ 4']) {
    const r = parsePoly(bad);
    assert.equal(r.ok, false, `phải lỗi: ${bad}`);
    if (!r.ok) assert.ok(r.error.length > 5);
  }
});

test('đa thức: (a+b)^n khớp số học và pEq', () => {
  assert.ok(pEq(P('(x+1)^2'), P('x^2+2x+1')));
  assert.ok(!pEq(P('(x+1)^2'), P('x^2+1')));
  assert.equal(expand('(x+1)^10').split(' + ').length, 11);
});

test('nhị thức Newton', () => {
  assert.deepEqual(binomialRow(5), [1n, 5n, 10n, 10n, 5n, 1n]);
  assert.equal(newtonExpansion(3, false).text, 'a³ + 3a²b + 3ab² + b³');
  assert.equal(newtonExpansion(3, true).text, 'a³ − 3a²b + 3ab² − b³');
  assert.equal(newtonExpansion(0, false).text, '1');
  assert.equal(newtonExpansion(1, true).text, 'a − b');
  assert.throws(() => binomialRow(21));
  assert.throws(() => binomialRow(-1));
});

test('phương trình bậc hai: nghiệm hữu tỉ', () => {
  const r = solveQuadratic(Q('1'), Q('-3'), Q('2'));
  assert.deepEqual(r.answers.map((a) => a.text), ['x₁ = 1', 'x₂ = 2']);
  assert.ok(r.notes.some((n) => n.includes('x₁ + x₂ = −b/a = 3')));
  const r2 = solveQuadratic(Q('2'), Q('-5'), Q('-3')); // 2x²−5x−3 = (2x+1)(x−3)
  assert.deepEqual(r2.answers.map((a) => a.text), ['x₁ = −1/2', 'x₂ = 3']);
});

test('phương trình bậc hai: nghiệm kép, vô nghiệm, vô tỉ, hệ số phân số', () => {
  assert.equal(solveQuadratic(Q('1'), Q('2'), Q('1')).answers[0].text, 'x = −1');
  assert.equal(solveQuadratic(Q('1'), Q('0'), Q('1')).answers[0].text, 'Vô nghiệm trong tập số thực.');
  const s = solveQuadratic(Q('1'), Q('-2'), Q('-1')); // x = 1 ± √2
  assert.deepEqual(s.answers.map((a) => a.text), ['x₁ = 1 − √2', 'x₂ = 1 + √2']);
  assert.ok(Math.abs(s.answers[0].approx! - (1 - Math.SQRT2)) < 1e-12);
  const t = solveQuadratic(Q('1'), Q('1'), Q('-1')); // (−1 ± √5)/2
  assert.deepEqual(t.answers.map((a) => a.text), ['x₁ = (−1 − √5)/2', 'x₂ = (−1 + √5)/2']);
  const u = solveQuadratic(Q('-1'), Q('1'), Q('1')); // −x²+x+1=0 -> cùng nghiệm với x²−x−1=0: (1 ± √5)/2
  assert.deepEqual(u.answers.map((a) => a.text), ['x₁ = (1 − √5)/2', 'x₂ = (1 + √5)/2']);
  assert.ok(Math.abs(u.answers[1].approx! - (1 + Math.sqrt(5)) / 2) < 1e-12);
  const f = solveQuadratic(Q('1/2'), Q('-3/2'), Q('1')); // x²−3x+2=0
  assert.deepEqual(f.answers.map((a) => a.text), ['x₁ = 1', 'x₂ = 2']);
  const w = solveQuadratic(Q('1'), Q('0'), Q('-8')); // x = ±2√2
  assert.deepEqual(w.answers.map((a) => a.text), ['x₁ = −2√2', 'x₂ = 2√2']);
});

test('phương trình: trường hợp a = 0 và suy biến', () => {
  assert.equal(solveQuadratic(Q('0'), Q('2'), Q('-6')).answers[0].text, 'x = 3');
  assert.equal(solveQuadratic(Q('0'), Q('0'), Q('5')).answers[0].text, 'Vô nghiệm.');
  assert.ok(solveQuadratic(Q('0'), Q('0'), Q('0')).answers[0].text.startsWith('Vô số nghiệm'));
});

test('hệ hai phương trình bậc nhất hai ẩn', () => {
  const r = solveSystem2(Q('2'), Q('1'), Q('5'), Q('1'), Q('-1'), Q('1')); // x=2, y=1
  assert.deepEqual(r.answers.map((a) => a.text), ['x = 2', 'y = 1']);
  const f = solveSystem2(Q('1'), Q('1'), Q('1'), Q('1'), Q('-1'), Q('0')); // x=y=1/2
  assert.deepEqual(f.answers.map((a) => a.text), ['x = 1/2', 'y = 1/2']);
  assert.ok(solveSystem2(Q('1'), Q('2'), Q('3'), Q('2'), Q('4'), Q('6')).answers[0].text.startsWith('Vô số'));
  assert.ok(solveSystem2(Q('1'), Q('2'), Q('3'), Q('2'), Q('4'), Q('7')).answers[0].text.startsWith('Vô nghiệm'));
  assert.ok(solveSystem2(Q('0'), Q('0'), Q('0'), Q('0'), Q('0'), Q('5')).answers[0].text.startsWith('Vô nghiệm'));
  assert.ok(solveSystem2(Q('0'), Q('0'), Q('0'), Q('0'), Q('0'), Q('0')).answers[0].text.startsWith('Vô số'));
  assert.ok(solveSystem2(Q('0'), Q('0'), Q('0'), Q('1'), Q('1'), Q('3')).answers[0].text.startsWith('Vô số'));
});
