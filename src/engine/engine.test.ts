import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, formatNumber } from './index.ts';
import type { EvalOptions } from './index.ts';

const val = (e: string, o?: EvalOptions) => {
  const r = evaluate(e, o);
  assert.ok(r.ok, `"${e}" lẽ ra phải tính được: ${r.ok ? '' : r.error.message}`);
  return r.value;
};
const err = (e: string, kind: string, o?: EvalOptions) => {
  const r = evaluate(e, o);
  assert.ok(!r.ok, `"${e}" lẽ ra phải lỗi`);
  assert.equal(r.error.kind, kind, `"${e}" -> ${r.error.message}`);
};
const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test('thứ tự ưu tiên và ngoặc', () => {
  assert.equal(val('2 + 3 × 4'), 14);
  assert.equal(val('(2 + 3) × 4'), 20);
  assert.equal(val('2+3*4'), 14);
  assert.equal(val('10 - 2 - 3'), 5);
  assert.equal(val('100 ÷ 5 ÷ 4'), 5);
});
test('số âm, thập phân, lũy thừa', () => {
  assert.equal(val('-2^2'), -4);
  assert.equal(val('(-2)^2'), 4);
  assert.equal(val('2^-1'), 0.5);
  assert.equal(val('2^3^2'), 512);
  assert.equal(val('2^10'), 1024);
  assert.equal(val('−5 + 2'), -3);
  assert.equal(val('.5 + 5.'), 5.5);
  near(val('0.1 + 0.2'), 0.3);
});
test('căn, trị tuyệt đối, phần trăm, giai thừa', () => {
  assert.equal(val('sqrt(81)'), 9);
  assert.equal(val('√81'), 9);
  assert.equal(val('√(2+2)'), 2);
  assert.equal(val('abs(-7.5)'), 7.5);
  assert.equal(val('root(3,27)'), 3);
  assert.equal(val('root(3,-27)'), -3);
  assert.equal(val('root(4,16)'), 2);
  assert.equal(val('cbrt(-8)'), -2);
  assert.equal(val('50%'), 0.5);
  assert.equal(val('5!'), 120);
  assert.equal(val('0!'), 1);
  assert.equal(val('20!'), 2432902008176640000);
  assert.ok(Number.isFinite(val('170!')));
});
test('hằng số, nhân ngầm, Ans', () => {
  near(val('pi'), Math.PI);
  near(val('2π'), 2 * Math.PI);
  near(val('e'), Math.E);
  assert.equal(val('2(3+4)'), 14);
  assert.equal(val('(1+1)(2+2)'), 8);
  assert.equal(val('Ans × 2', { ans: 21 }), 42);
  err('Ans + 1', 'syntax');
});
test('lỗi miền xác định', () => {
  err('1/0', 'domain');
  err('5÷(2-2)', 'domain');
  err('sqrt(-4)', 'domain');
  err('root(2,-4)', 'domain');
  err('root(0,5)', 'domain');
  err('0^0', 'domain');
  err('0^-1', 'domain');
  err('(-8)^0.5', 'domain');
  err('(-3)!', 'domain');
  err('2.5!', 'domain');
});
test('lỗi giới hạn', () => {
  err('171!', 'limit');
  err('10^400', 'limit');
  err('9'.repeat(201), 'limit');
  err('('.repeat(150) + '1' + ')'.repeat(150), 'limit');
  err('-'.repeat(150) + '1', 'limit');
});
test('lỗi cú pháp', () => {
  for (const e of ['', '   ', '2+', '*3', '(2+3', '2+3)', '1.2.3', '2 3', 'sqrt', 'sqrt()', 'root(1)', '()', '2++', '5 $ 3', '!', '2^'])
    err(e, 'syntax');
});
test('tự đóng ngoặc chỉ khi được bật', () => {
  err('(2+3', 'syntax');
  assert.equal(val('(2+3', { autoCloseParens: true }), 5);
  assert.equal(val('2×(3+(4', { autoCloseParens: true }), 14);
  err('2+3)', 'syntax', { autoCloseParens: true });
});
test('an toàn: không thực thi mã', () => {
  for (const e of ['process.exit()', 'alert(1)', 'constructor', '__proto__', 'globalThis', 'this', 'eval("1")', 'a=1', '`1`', 'import("fs")', '1;2'])
    err(e, 'syntax');
});
test('định dạng hiển thị', () => {
  assert.deepEqual(formatNumber(0.1 + 0.2), { text: '0.3', approximate: false });
  assert.deepEqual(formatNumber(14), { text: '14', approximate: false });
  assert.deepEqual(formatNumber(-0), { text: '0', approximate: false });
  assert.deepEqual(formatNumber(1 / 3), { text: '0.333333333333', approximate: true });
  assert.equal(formatNumber(Math.SQRT2).approximate, true);
  assert.deepEqual(formatNumber(1e20), { text: '1e+20', approximate: false });
  assert.deepEqual(formatNumber(2 ** 60), { text: '1.15292150461e+18', approximate: true });
  assert.equal(formatNumber(1e-7).text, '1e-7');
  assert.equal(formatNumber(123456789012).text, '123456789012');
  assert.deepEqual(formatNumber(2 / 3, { decimals: 2 }), { text: '0.67', approximate: true });
  assert.deepEqual(formatNumber(0.5, { decimals: 3 }), { text: '0.500', approximate: false });
  assert.equal(formatNumber(-0.001, { decimals: 1 }).text, '0.0');
});
