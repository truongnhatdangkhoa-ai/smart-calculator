import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, describeInteger } from './index.ts';
import type { EvalOptions } from './index.ts';

const val = (e: string, o?: EvalOptions) => {
  const r = evaluate(e, o);
  assert.ok(r.ok, `"${e}" lẽ ra phải tính được: ${r.ok ? '' : r.error.message}`);
  return r.value;
};
const exact = (e: string, o?: EvalOptions) => {
  const r = evaluate(e, o);
  assert.ok(r.ok, e);
  return r.exact ? `${r.exact.n}/${r.exact.d}` : null;
};
const err = (e: string, o?: EvalOptions) => {
  const r = evaluate(e, o);
  assert.ok(!r.ok, `"${e}" lẽ ra phải lỗi`);
  return r.error;
};
const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const RAD: EvalOptions = { angleMode: 'rad' };

test('lượng giác DEG/RAD', () => {
  assert.equal(val('sin(30)'), 0.5);
  assert.equal(val('sin(pi/6)', RAD), 0.5);
  assert.equal(val('cos(60)'), 0.5);
  assert.equal(val('tan(45)'), 1);
  assert.equal(val('sin(180)'), 0);
  assert.equal(val('cos(90)'), 0);
  assert.equal(val('sin(pi)', RAD), 0);
  assert.equal(val('cos(0)'), 1);
  near(val('sin(1)', RAD), Math.sin(1));
  near(val('sin(1)'), Math.sin(Math.PI / 180));
  assert.notEqual(val('sin(30)'), val('sin(30)', RAD)); // đổi chế độ góc đổi kết quả
  assert.equal(val('sin(-30)'), -0.5);
});
test('tan tại cos = 0 và hàm ngược', () => {
  assert.equal(err('tan(90)').kind, 'domain');
  assert.equal(err('tan(270)').kind, 'domain');
  assert.equal(err('tan(pi/2)', RAD).kind, 'domain');
  assert.equal(val('asin(0.5)'), 30);
  assert.equal(val('acos(0.5)'), 60);
  assert.equal(val('acos(-1)'), 180);
  assert.equal(val('atan(1)'), 45);
  near(val('arcsin(1)', RAD), Math.PI / 2);
  assert.equal(err('asin(2)').kind, 'domain');
  assert.equal(err('acos(-1.5)').kind, 'domain');
});
test('hyperbolic', () => {
  assert.equal(val('sinh(0)'), 0);
  assert.equal(val('cosh(0)'), 1);
  assert.equal(val('tanh(0)'), 0);
  assert.equal(val('asinh(0)'), 0);
  near(val('sinh(1)'), Math.sinh(1));
  near(val('asinh(sinh(2))'), 2);
  assert.equal(val('acosh(1)'), 0);
  assert.equal(err('acosh(0.5)').kind, 'domain');
  assert.equal(err('atanh(1)').kind, 'domain');
  assert.equal(err('cosh(1000)').kind, 'limit');
});
test('logarit và hàm mũ', () => {
  assert.equal(val('log10(1000)'), 3);
  assert.equal(val('log(1000)'), 3);
  assert.equal(val('ln(e)'), 1);
  assert.equal(val('ln(e^3)'), 3);
  assert.equal(val('logb(2,8)'), 3);
  assert.equal(val('logb(10,0.01)'), -2);
  assert.equal(val('log2(1024)'), 10);
  assert.equal(val('exp(0)'), 1);
  near(val('exp(1)'), Math.E);
  assert.equal(val('10^3'), 1000);
  assert.equal(val('2^-2'), 0.25);
  near(val('e^2'), Math.exp(2));
  near(val('2^0.5'), Math.SQRT2);
});
test('lỗi logarit/mũ', () => {
  for (const e of ['log(0)', 'log(-1)', 'ln(0)', 'ln(-5)', 'logb(1,5)', 'logb(-2,8)', 'logb(0,8)', 'logb(2,0)', 'logb(2,-8)'])
    assert.equal(err(e).kind, 'domain', e);
  assert.equal(err('exp(1000)').kind, 'limit');
  assert.equal(err('10^500').kind, 'limit');
});
test('phân số chính xác', () => {
  assert.equal(exact('12/18'), '2/3');
  assert.equal(exact('1/2+1/3'), '5/6');
  assert.equal(exact('1/2-1/2'), '0/1');
  assert.equal(exact('(2/3)×(3/4)'), '1/2');
  assert.equal(exact('(1/2)÷(3/4)'), '2/3');
  assert.equal(exact('0.75'), '3/4');
  assert.equal(exact('0.1+0.2'), '3/10');
  assert.equal(exact('1/3×3'), '1/1');
  assert.equal(exact('(2/3)^2'), '4/9');
  assert.equal(exact('2^-3'), '1/8');
  assert.equal(exact('sqrt(1/4)'), '1/2');
  assert.equal(exact('sqrt(81)'), '9/1');
  assert.equal(exact('8^(1/3)'), '2/1');
  assert.equal(exact('root(3,-27)'), '-3/1');
  assert.equal(exact('50%'), '1/2');
  assert.equal(exact('20!'), '2432902008176640000/1');
});
test('phân biệt kết quả chính xác với số thực gần đúng', () => {
  for (const e of ['sqrt(2)', 'pi', 'sin(1)', 'ln(2)', '2^0.5', 'e', 'log(3)']) assert.equal(exact(e), null, e);
  assert.equal(exact('Ans+1', { ans: 0.5, ansExact: { n: 1n, d: 2n } }), '3/2');
  assert.equal(exact('Ans+1', { ans: 0.5 }), null);
});
test('quy ước %: kiểu Casio khi cộng/trừ', () => {
  assert.equal(val('200+10%'), 220);
  assert.equal(val('200−10%'), 180);
  assert.equal(val('200×10%'), 20);
  assert.equal(val('50%'), 0.5);
  assert.equal(val('5+50%×2'), 6);
  assert.equal(exact('200+10%'), '220/1');
});
test('GCD, LCM, chia lấy dư, làm tròn, phần nguyên/lẻ', () => {
  assert.equal(val('gcd(12,18)'), 6);
  assert.equal(val('gcd(-12,18)'), 6);
  assert.equal(val('gcd(0,5)'), 5);
  assert.equal(val('lcm(4,6)'), 12);
  assert.equal(val('lcm(0,6)'), 0);
  assert.equal(val('mod(17,5)'), 2);
  assert.equal(val('mod(-7,3)'), 2);
  assert.equal(val('mod(5.5,2)'), 1.5);
  assert.equal(val('floor(-2.5)'), -3);
  assert.equal(val('ceil(-2.5)'), -2);
  assert.equal(val('round(2.5)'), 3);
  assert.equal(val('round(-2.5)'), -3);
  assert.equal(val('round(2.4)'), 2);
  near(val('frac(2.75)'), 0.75);
  near(val('frac(-1.25)'), 0.75);
  assert.equal(exact('frac(2.3)'), '3/10');
  assert.equal(exact('mod(-7,3)'), '2/1');
  assert.equal(exact('round(-5/2)'), '-3/1');
  assert.equal(err('gcd(2.5,3)').kind, 'domain');
  assert.equal(err('mod(5,0)').kind, 'domain');
  assert.equal(err('lcm(1.5,2)').kind, 'domain');
  assert.equal(err('gcd(1e3,2)').kind, 'syntax'); // không có ký hiệu khoa học
});
test('số nguyên tố và phân tích thừa số', () => {
  assert.equal(describeInteger(17n), '17 là số nguyên tố.');
  assert.equal(describeInteger(12n), '12 = 2² × 3 (hợp số)');
  assert.equal(describeInteger(360n), '360 = 2³ × 3² × 5 (hợp số)');
  assert.equal(describeInteger(97n), '97 là số nguyên tố.');
  assert.equal(describeInteger(1n), '1 không phải số nguyên tố, cũng không phải hợp số.');
  assert.equal(describeInteger(0n), null);
  assert.equal(describeInteger(-7n), null);
  assert.equal(describeInteger(999999999989n), '999999999989 là số nguyên tố.');
  assert.match(describeInteger(10n ** 13n) ?? '', /quá lớn/);
});
test('an toàn với tên hàm đặc biệt và cú pháp mới', () => {
  for (const e of ['constructor(1)', 'toString(1)', '__proto__(1)', 'hasOwnProperty(1)', 'sin', 'sin()', 'sin(1,2)', 'logb(2)', 'gcd(1)', 'round(1,2)', 'log10', 'log10 5', 'arccosx(1)'])
    assert.equal(err(e).kind, 'syntax', e);
});
