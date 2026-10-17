import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reducer, getPreview, getDisplay } from './calculatorState.ts';
import type { Action, CalcState } from './calculatorState.ts';

const run = (...texts: (string | Action)[]): CalcState =>
  texts.reduce<CalcState>((s, t) => reducer(s, typeof t === 'string' ? { type: 'input', text: t } : t), initialState);
const EQ: Action = { type: 'equals' };

test('tính 2 + 3 × 4 = 14', () => {
  const s = run('2', '+', '3', '×', '4', EQ);
  assert.equal(s.result, '14');
  assert.equal(s.error, null);
});
test('tính liên tiếp dùng kết quả trước (Ans)', () => {
  const s = run('2', '+', '3', EQ, '×', '4', EQ);
  assert.equal(s.expression, 'Ans×4');
  assert.equal(s.result, '20');
});
test('gõ số mới sau khi bằng thì bắt đầu biểu thức mới', () => {
  assert.equal(run('2', '+', '3', EQ, '7').expression, '7');
});
test('đổi toán tử khi gõ liên tiếp; cho phép dấu trừ sau ×', () => {
  assert.equal(run('5', '+', '×').expression, '5×');
  assert.equal(run('5', '×', '−').expression, '5×−');
  assert.equal(run('×', '5').expression, '5');
});
test('tự đóng ngoặc khi bấm =', () => {
  assert.equal(run('(', '2', '+', '3', EQ).result, '5');
});
test('lỗi chia cho 0 giữ nguyên biểu thức để sửa', () => {
  const s = run('5', '÷', '0', EQ);
  assert.match(s.error ?? '', /chia cho 0/);
  assert.equal(s.expression, '5÷0');
  assert.equal(s.result, null);
});
test('xóa ký tự theo token và xóa toàn bộ giữ Ans', () => {
  assert.equal(run('√(', '4', { type: 'backspace' }, { type: 'backspace' }).expression, '√');
  assert.equal(run('root(', { type: 'backspace' }).expression, '');
  const s = run('9', EQ, { type: 'clear' });
  assert.equal(s.expression, '');
  assert.equal(s.ans, 9);
});
test('hoàn tác', () => {
  const s = run('1', '2', '3', { type: 'undo' });
  assert.equal(s.expression, '12');
  assert.equal(run('1', EQ, { type: 'clear' }, { type: 'undo' }).result, '1');
  assert.equal(reducer(initialState, { type: 'undo' }), initialState);
});
test('đổi dấu (số đối)', () => {
  assert.equal(run('5', { type: 'negate' }).expression, '−(5)');
  assert.equal(run('5', { type: 'negate' }, { type: 'negate' }).expression, '5');
  assert.equal(run('(1+2)×(3+4)', { type: 'negate' }, { type: 'negate' }).expression, '(1+2)×(3+4)');
  assert.equal(run('5', EQ, { type: 'negate' }, EQ).result, '-5');
});
test('giới hạn độ dài và xem trước', () => {
  const s = run(...Array(201).fill('1'));
  assert.equal(s.expression.length, 200);
  assert.ok(s.error);
  assert.deepEqual(getPreview(run('2', '+', '3')), { text: '5', approximate: false });
  assert.equal(getPreview(run('2')), null);
  assert.equal(getPreview(run('2', '+')), null);
});

test('DEG/RAD: đổi chế độ góc đổi kết quả, không vào lịch sử hoàn tác', () => {
  const t: Action = { type: 'toggleAngle' };
  assert.equal(initialState.angle, 'deg');
  assert.equal(run('sin(', '3', '0', ')', EQ).result, '0.5');
  const rad = run(t, 'sin(', '3', '0', ')', EQ);
  assert.equal(rad.angle, 'rad');
  assert.equal(rad.result, '-0.988031624093');
  assert.equal(run(t, 'sin(', 'π', '÷', '6', ')', EQ).result, '0.5');
  assert.equal(reducer(rad, { type: 'undo' }).angle, 'rad');
});
test('phân biệt số nguyên / phân số chính xác / số thực', () => {
  const frac = run('1', '÷', '3', '+', '1', '÷', '6', EQ);
  assert.equal(frac.kind, 'fraction');
  assert.equal(frac.fraction, '1/2');
  assert.equal(run('1', '÷', '3', EQ).approximate, true);
  assert.equal(run('1', '÷', '3', EQ).fraction, '1/3');
  assert.equal(run('2', '×', '3', EQ).kind, 'integer');
  const real = run('√(', '2', EQ);
  assert.equal(real.kind, 'real');
  assert.equal(real.approximate, true);
  assert.equal(real.fraction, null);
  assert.equal(run('0', '.', '7', '5', EQ).fraction, '3/4');
});
test('hiển thị: phân số ⇄ thập phân, nhãn loại kết quả, phân tích thừa số', () => {
  const s = run('3', '÷', '4', EQ);
  assert.deepEqual([getDisplay(s).main, getDisplay(s).secondary], ['0.75', '= 3/4']);
  const f = reducer(s, { type: 'toggleFraction' });
  assert.deepEqual([getDisplay(f).main, getDisplay(f).secondary], ['3/4', '= 0.75']);
  const third = reducer(run('1', '÷', '3', EQ), { type: 'toggleFraction' });
  assert.deepEqual([getDisplay(third).main, getDisplay(third).secondary], ['1/3', '≈ 0.333333333333']);
  assert.equal(getDisplay(s).kindLabel, 'Phân số chính xác');
  assert.equal(getDisplay(run('1', '2', EQ)).info, '12 = 2² × 3 (hợp số)');
  assert.equal(getDisplay(run('1', '7', EQ)).info, '17 là số nguyên tố.');
  assert.equal(getDisplay(run('2', '÷', '4', EQ)).info, null);
  assert.equal(getDisplay(run('√(', '2', EQ)).kindLabel, 'Số thực gần đúng');
  assert.equal(getDisplay(run('1', '÷', '0', EQ)).error, 'Không thể chia cho 0.');
  assert.equal(getDisplay(run('2', '+', '3')).main, '5');
  assert.equal(getDisplay(initialState).main, '0');
});
test('Ans giữ phân số chính xác khi tính tiếp', () => {
  const s = run('1', '÷', '3', EQ, '×', '3', EQ);
  assert.equal(s.result, '1');
  assert.equal(s.kind, 'integer');
});
test('lỗi lượng giác/logarit hiển thị rõ và giữ biểu thức', () => {
  const t = run('tan(', '9', '0', EQ);
  assert.match(t.error ?? '', /cos bằng 0/);
  assert.equal(t.expression, 'tan(90');
  assert.match(run('log(', '0', EQ).error ?? '', /số dương/);
});
