import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, MAX_LENGTH } from './engine/index.ts';
import type { EvalOptions } from './engine/index.ts';
import { createInitialState, getDisplay, initialState, reducer } from './calculatorState.ts';
import type { Action, CalcState } from './calculatorState.ts';

const kind = (e: string, o?: EvalOptions) => {
  const r = evaluate(e, o);
  return r.ok ? 'ok' : r.error.kind;
};
const msg = (e: string, o?: EvalOptions) => {
  const r = evaluate(e, o);
  return r.ok ? '' : r.error.message;
};
const run = (...items: (string | Action)[]): CalcState =>
  items.reduce<CalcState>((s, t) => reducer(s, typeof t === 'string' ? { type: 'input', text: t } : t), initialState);

test('D: chia cho 0 (mọi dạng) là lỗi miền xác định', () => {
  for (const e of ['1/0', '0/0', '5÷(3−3)', '1/(2-2)', 'mod(5,0)', '0^(-1)', 'tan(90)', 'logb(1,5)', 'nCr(1,2)'])
    assert.equal(kind(e), 'domain', e);
  assert.match(msg('1/0'), /chia cho 0/);
});
test('D: log / căn / arcsin / giai thừa ngoài miền', () => {
  for (const e of ['log(-1)', 'log(0)', 'ln(-5)', 'log2(0)', 'sqrt(-4)', '√(-1)', 'root(2,-9)', 'asin(2)', 'acos(-1.5)',
    'acosh(0.5)', 'atanh(1)', '(-8)^0.5', '(-2)!', '2.5!', '0^0'])
    assert.equal(kind(e), 'domain', e);
  assert.equal(kind('cbrt(-8)'), 'ok');
  assert.equal(kind('root(3,-8)'), 'ok');
});
test('D: cú pháp sai', () => {
  for (const e of ['2+', '*3', '(2+3', '2+3)', '()', '2++', 'sin', 'sin(', 'sin()', 'abc', '2 3 )', '1.2.3', '$', '2^', '!', '%', 'gcd(1)', 'root(1,2,3)', '1,2', ',', '2@3'])
    assert.equal(kind(e, { autoCloseParens: false }), 'syntax', e);
  assert.equal(kind('', {}), 'syntax');
  assert.equal(kind('   '), 'syntax');
});
test('D: giới hạn độ dài, độ sâu, vượt biểu diễn', () => {
  assert.equal(kind('1+'.repeat(150) + '1'), 'limit');
  assert.equal(kind('1'.repeat(MAX_LENGTH)), 'ok');
  assert.equal(kind('1'.repeat(MAX_LENGTH + 1)), 'limit');
  assert.equal(kind('('.repeat(90) + '1' + ')'.repeat(90)), 'limit');
  assert.equal(kind('('.repeat(20) + '1' + ')'.repeat(20)), 'ok');
  assert.equal(kind('171!'), 'limit');
  assert.equal(kind('10^400'), 'limit');
  assert.equal(kind('exp(1000)'), 'limit');
  assert.equal(kind('9^9^9^9'), 'limit');
});
test('D: không bao giờ ném ngoại lệ với đầu vào ngẫu nhiên', () => {
  const alphabet = '0123456789+-*/^()!%.,√π×÷−abcdefghijklmnopqrstuvwxyz ';
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 3000; i++) {
    const len = 1 + Math.floor(rnd() * 40);
    let s = '';
    for (let j = 0; j < len; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
    assert.doesNotThrow(() => evaluate(s, { autoCloseParens: i % 2 === 0 }), JSON.stringify(s));
  }
  for (const s of ['sin(sin(sin(sin(sin(1)))))', 'nCr(nCr(10,5),2)', 'gcd(lcm(4,6),9)'])
    assert.doesNotThrow(() => evaluate(s));
});
test('D: DEG/RAD đổi kết quả đúng và không đổi nội dung biểu thức', () => {
  const deg = run('sin(', '9', '0', ')', { type: 'equals' });
  assert.equal(deg.result, '1');
  const rad = reducer(deg, { type: 'toggleAngle' });
  assert.equal(rad.angle, 'rad');
  assert.equal(rad.expression, 'sin(90)');
  const again = run('sin(', '1', ')', { type: 'toggleAngle' }, { type: 'equals' });
  assert.equal(again.result, '0.841470984808');
  assert.equal(evaluate('asin(1)', { angleMode: 'deg' }).ok && (evaluate('asin(1)') as { value: number }).value, 90);
});
test('D: lỗi không làm hỏng trạng thái; có thể sửa và tính tiếp; hoàn tác', () => {
  let s = run('1', '÷', '0', { type: 'equals' });
  assert.ok(getDisplay(s).error);
  s = reducer(s, { type: 'backspace' });
  s = reducer(s, { type: 'input', text: '4' });
  s = reducer(s, { type: 'equals' });
  assert.equal(s.error, null);
  assert.equal(s.result, '0.25');
  assert.equal(s.history.length, 1, 'chỉ phép tính đúng vào lịch sử');
});
test('D: số quá dài/nhập liên tục không làm hỏng; ± và % ở biên', () => {
  assert.equal(run('%').expression, '');
  assert.equal(run('(', '%').expression, '(');
  assert.equal(run({ type: 'negate' }).expression, '−');
  assert.ok(run({ type: 'negate' }, { type: 'equals' }).error);
  assert.equal(run('0', '.', '1', '+', '0', '.', '2', { type: 'equals' }).result, '0.3');
  assert.equal(run('0', '.', '1', '+', '0', '.', '2', { type: 'equals' }).kind, 'fraction');
});
test('D: khởi tạo từ dữ liệu rỗng giống trạng thái đầu', () => {
  assert.deepEqual(createInitialState().history, []);
  assert.equal(createInitialState().memory, null);
});
