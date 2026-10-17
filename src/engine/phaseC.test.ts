import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from './index.ts';
import type { EvalOptions } from './index.ts';

const val = (e: string, o?: EvalOptions) => {
  const r = evaluate(e, o);
  assert.ok(r.ok, `"${e}" lẽ ra phải tính được: ${r.ok ? '' : r.error.message}`);
  return r.value;
};
const exact = (e: string) => {
  const r = evaluate(e);
  assert.ok(r.ok, e);
  return r.exact ? `${r.exact.n}/${r.exact.d}` : null;
};
const err = (e: string) => {
  const r = evaluate(e);
  assert.ok(!r.ok, `"${e}" lẽ ra phải lỗi`);
  return r.error;
};
const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test('tổ hợp C(5,2)=10, chỉnh hợp A(5,2)=20, hoán vị 5!=120', () => {
  assert.equal(val('nCr(5,2)'), 10);
  assert.equal(val('nPr(5,2)'), 20);
  assert.equal(val('5!'), 120);
  assert.equal(val('comb(6,3)'), 20);
  assert.equal(val('perm(4,4)'), 24);
  assert.equal(val('nCr(5,0)'), 1);
  assert.equal(val('nCr(5,5)'), 1);
  assert.equal(val('nCr(0,0)'), 1);
  assert.equal(val('nCr(5,2)+nPr(3,1)'), 13);
});
test('tổ hợp đối xứng và công thức Pascal', () => {
  for (const [n, k] of [[10, 3], [20, 7], [52, 5]]) {
    assert.equal(val(`nCr(${n},${k})`), val(`nCr(${n},${n - k})`));
    assert.equal(val(`nCr(${n},${k})`), val(`nCr(${n - 1},${k - 1})+nCr(${n - 1},${k})`));
  }
  assert.equal(val('nCr(52,5)'), 2598960);
});
test('tổ hợp lớn chính xác bằng BigInt', () => {
  assert.equal(exact('nCr(60,30)'), '118264581564861424/1');
  assert.equal(exact('nPr(25,25)'), '15511210043330985984000000/1');
  assert.ok(val('nCr(1000,500)') > 2.7e299);
});
test('điều kiện đầu vào: k>n, âm, không nguyên, quá lớn', () => {
  const a = err('nCr(2,5)');
  assert.equal(a.kind, 'domain');
  assert.match(a.message, /k không được lớn hơn n/);
  assert.equal(err('nPr(2,5)').kind, 'domain');
  assert.match(err('nCr(5,-1)').message, /số nguyên không âm/);
  assert.match(err('nCr(-5,2)').message, /số nguyên không âm/);
  assert.match(err('nCr(5.5,2)').message, /số nguyên không âm/);
  assert.match(err('nCr(5,1.5)').message, /số nguyên không âm/);
  const big = err('nCr(2000,3)');
  assert.equal(big.kind, 'limit');
  assert.match(big.message, /quá lớn/);
  assert.equal(err('nPr(1000,1000)').kind, 'limit'); // 1000! vượt giới hạn số thực
  assert.equal(err('nCr(5)').kind, 'syntax');
  assert.equal(err('nCr(5,2,1)').kind, 'syntax');
});
test('xác suất cổ điển prob(m,n) giữ phân số chính xác', () => {
  near(val('prob(1,6)'), 1 / 6);
  assert.equal(exact('prob(1,6)'), '1/6');
  assert.equal(exact('prob(3,6)'), '1/2');
  assert.equal(val('prob(0,5)'), 0);
  assert.equal(val('prob(5,5)'), 1);
  assert.match(err('prob(7,6)').message, /không được lớn hơn n/);
  assert.match(err('prob(1,0)').message, /n phải ≥ 1/);
  assert.match(err('prob(-1,6)').message, /số nguyên không âm/);
  assert.equal(exact('prob(nCr(4,2),nCr(6,2))'), '2/5');
});
test('xác suất nhị thức binom(n,k,p)', () => {
  assert.equal(val('binom(5,2,0.5)'), 0.3125);
  assert.equal(exact('binom(5,2,0.5)'), '5/16');
  near(val('binom(10,3,0.3)'), 0.266827932);
  assert.equal(val('binom(4,0,0)'), 1);
  assert.equal(val('binom(4,4,1)'), 1);
  assert.equal(val('binom(4,2,1)'), 0);
  near(val('binom(1000,500,0.5)'), 0.02522501817839, 1e-9);
  // tổng xác suất = 1
  let sum = 0;
  for (let k = 0; k <= 10; k++) sum += val(`binom(10,${k},0.3)`);
  near(sum, 1);
  assert.match(err('binom(3,1,2)').message, /đoạn \[0, 1\]/);
  assert.match(err('binom(3,1,-0.1)').message, /đoạn \[0, 1\]/);
  assert.match(err('binom(3,5,0.5)').message, /k không được lớn hơn n/);
});
test('hằng M của bộ nhớ', () => {
  assert.equal(val('M×2', { mem: 4 }), 8);
  assert.equal(val('2M+1', { mem: 4 }), 9);
  const r = evaluate('M/3', { mem: 1, memExact: { n: 1n, d: 1n } });
  assert.ok(r.ok && r.exact && r.exact.n === 1n && r.exact.d === 3n);
  assert.match(err('M+1').message, /Bộ nhớ đang trống/);
});
