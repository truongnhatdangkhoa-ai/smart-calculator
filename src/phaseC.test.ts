import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, displayExpression, getDisplay, initialState, MAX_HISTORY, reducer, resultLiteral, searchHistory,
} from './calculatorState.ts';
import type { Action, CalcState } from './calculatorState.ts';
import { deserialize, loadPersisted, savePersisted, serialize, STORAGE_KEY } from './storage.ts';
import type { KV } from './storage.ts';

const run = (from: CalcState, ...items: (string | Action)[]): CalcState =>
  items.reduce<CalcState>((s, t) => reducer(s, typeof t === 'string' ? { type: 'input', text: t } : t), from);
const EQ = (now = 1000): Action => ({ type: 'equals', now });
const fakeStorage = (): KV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
};

test('C(5,2)=10 qua giao diện nhập liệu; k>n báo lỗi và giữ biểu thức', () => {
  const ok = run(initialState, 'nCr(', '5', ',', '2', EQ());
  assert.equal(ok.result, '10');
  assert.equal(ok.kind, 'integer');
  const bad = run(initialState, 'nCr(', '2', ',', '5', EQ());
  assert.match(bad.error ?? '', /k không được lớn hơn n/);
  assert.equal(bad.expression, 'nCr(2,5');
  assert.equal(bad.history.length, 0, 'phép tính lỗi không vào lịch sử');
  assert.equal(ok.history[0].expr, 'nCr(5,2)', 'lịch sử lưu biểu thức đã tự đóng ngoặc');
  assert.equal(run(initialState, 'nPr(', '5', ',', '2', EQ()).result, '20');
  assert.equal(run(initialState, 'prob(', '1', ',', '6', EQ()).fraction, '1/6');
});
test('bộ nhớ MS / MR / M+ / M− / MC', () => {
  let s = run(initialState, '7', EQ(), { type: 'memStore' });
  assert.equal(s.memory?.value, 7);
  s = run(s, { type: 'clear' }, '5', { type: 'memAdd' }); // 7 + giá trị biểu thức đang gõ (5)
  assert.equal(s.memory?.value, 12);
  s = run(s, { type: 'memSub' }); // trừ tiếp: biểu thức "5" vẫn còn
  assert.equal(s.memory?.value, 7);
  s = run(s, { type: 'clear' }, { type: 'memRecall' }, '×', '2', EQ());
  assert.equal(s.expression, 'M×2');
  assert.equal(s.result, '14');
  s = run(s, { type: 'memClear' });
  assert.equal(s.memory, null);
  assert.match(run(s, { type: 'memRecall' }).error ?? '', /Bộ nhớ đang trống/);
  assert.match(run(initialState, { type: 'memAdd' }).error ?? '', /Chưa có giá trị/);
  assert.match(run(initialState, '1', '÷', '0', { type: 'memAdd' }).error ?? '', /chia cho 0/);
});
test('bộ nhớ giữ phân số chính xác và không mất khi đổi DEG/RAD, tab, hoàn tác', () => {
  let s = run(initialState, '1', '÷', '3', { type: 'memStore' }, { type: 'memAdd' }, { type: 'memAdd' });
  assert.deepEqual(s.memory?.exact, { n: 1n, d: 1n });
  s = run(s, { type: 'toggleAngle' }, { type: 'undo' }, { type: 'clear' });
  assert.equal(s.memory?.value, 1);
  assert.equal(run(s, { type: 'memRecall' }, '÷', '3', EQ()).fraction, '1/3');
});
test('lịch sử tự lưu biểu thức + kết quả + thời gian, mới nhất ở đầu', () => {
  const s = run(initialState, '2', '+', '3', EQ(111), { type: 'clear' }, '1', '÷', '3', EQ(222));
  assert.equal(s.history.length, 2);
  assert.deepEqual(
    s.history.map((h) => [h.expr, h.result, h.time, h.kind, h.fraction]),
    [['1÷3', '0.333333333333', 222, 'fraction', '1/3'], ['2+3', '5', 111, 'integer', null]],
  );
  assert.equal(new Set(s.history.map((h) => h.id)).size, 2);
});
test('lịch sử: dùng lại biểu thức/kết quả, tìm kiếm, xóa từng mục, xóa tất cả, giới hạn số bản ghi', () => {
  let s = run(initialState, '6', '×', '7', EQ(), { type: 'clear' }, '1', '÷', '4', EQ(), { type: 'clear' }, '2', '+', '2', EQ());
  const [h3, h2, h1] = s.history;
  assert.equal(run(s, { type: 'setExpression', text: h1.expr }).expression, '6×7');
  assert.equal(run(s, { type: 'input', text: resultLiteral(h2) }, '+', '1', EQ()).result, '1.25'); // (1/4)+1
  assert.equal(run(s, { type: 'input', text: resultLiteral(h1) }, '+', '1', EQ()).result, '43');
  assert.deepEqual(searchHistory(s.history, '42').map((h) => h.expr), ['6×7']);
  assert.deepEqual(searchHistory(s.history, '6*7').map((h) => h.expr), ['6×7']);
  assert.deepEqual(searchHistory(s.history, '1/4').map((h) => h.expr), ['1÷4']);
  assert.deepEqual(searchHistory(s.history, '0,25').map((h) => h.expr), ['1÷4']);
  assert.equal(searchHistory(s.history, 'zzz').length, 0);
  assert.equal(searchHistory(s.history, '  ').length, 3);
  assert.equal(run(s, { type: 'historyDelete', id: h2.id }).history.length, 2);
  assert.ok(!run(s, { type: 'historyDelete', id: h2.id }).history.some((h) => h.id === h2.id));
  assert.equal(run(s, { type: 'historyClear' }).history.length, 0);
  assert.equal(h3.expr, '2+2');
  let big = initialState;
  for (let i = 0; i < MAX_HISTORY + 20; i++) big = run(big, { type: 'clear' }, '1', '+', String(i % 9), EQ(i));
  assert.equal(big.history.length, MAX_HISTORY);
});
test('resultLiteral: số âm, ký hiệu khoa học, phân số âm', () => {
  const mk = (result: string, kind: 'integer' | 'fraction' | 'real' = 'real', fraction: string | null = null) =>
    ({ id: 1, expr: '', result, approximate: false, kind, fraction, time: 0 });
  assert.equal(resultLiteral(mk('-5')), '(−5)');
  assert.equal(resultLiteral(mk('2.5')), '2.5');
  assert.equal(resultLiteral(mk('1.5e-7')), '(1.5×10^(−7))');
  assert.equal(resultLiteral(mk('-2e+20')), '(−2×10^(+20))');
  assert.equal(resultLiteral(mk('-0.5', 'fraction', '-1/2')), '(−1/2)');
});
test('cài đặt: số chữ số thập phân áp dụng cả kết quả đã tính và hoàn tác', () => {
  let s = run(initialState, 'π', EQ());
  assert.equal(s.result, '3.14159265359');
  s = run(s, { type: 'setSettings', patch: { decimals: 2 } });
  assert.equal(s.result, '3.14');
  assert.equal(getDisplay(s).approximate, true);
  assert.equal(s.ans, Math.PI, 'giá trị nội bộ không bị làm tròn');
  assert.equal(run(s, { type: 'setSettings', patch: { decimals: 0 } }).result, '3');
  assert.equal(run(s, { type: 'setSettings', patch: { decimals: null } }).result, '3.14159265359');
  assert.equal(run(s, { type: 'setSettings', patch: { decimals: 99 } }).settings.decimals, 2, 'giá trị không hợp lệ bị bỏ qua');
  const i = run(createInitialState(), { type: 'setSettings', patch: { decimals: 2 } }, '1', '÷', '3', EQ());
  assert.equal(i.result, '0.33');
  assert.equal(i.fraction, '1/3');
  const iv = run(createInitialState(), { type: 'setSettings', patch: { decimals: 2 } }, '5', EQ());
  assert.equal(iv.result, '5.00');
  assert.equal(iv.ans, 5);
  assert.equal(getDisplay(run(createInitialState(), { type: 'setSettings', patch: { decimals: 1 } }, '2', '+', 'π')).main, '5.1');
});
test('cài đặt: dấu thập phân "," chỉ đổi khi hiển thị', () => {
  const s = run(createInitialState(), { type: 'setSettings', patch: { decimalSep: ',' } }, 'logb(', '2', ',', '8', ')', '+', '0', '.', '5', EQ());
  assert.equal(s.expression, 'logb(2,8)+0.5', 'bên trong vẫn dùng "." và ","');
  assert.equal(s.result, '3.5');
  assert.equal(getDisplay(s).main, '3,5');
  assert.equal(displayExpression(s.expression, ','), 'logb(2;8)+0,5');
  assert.equal(displayExpression('1.5+2', '.'), '1.5+2');
  const f = run(createInitialState(), { type: 'setSettings', patch: { decimalSep: ',' } }, '3', '÷', '4', EQ());
  assert.equal(getDisplay(f).main, '0,75');
  assert.equal(getDisplay(f).secondary, '= 3/4');
});
test('cài đặt: DEG/RAD qua setAngle', () => {
  assert.equal(run(initialState, { type: 'setAngle', angle: 'rad' }).angle, 'rad');
});

test('lưu bền vững: bộ nhớ, lịch sử, cài đặt còn sau khi "khởi động lại"', () => {
  const storage = fakeStorage();
  let s = createInitialState(loadPersisted(storage));
  s = run(s, { type: 'setSettings', patch: { decimals: 3, decimalSep: ',', theme: 'dark' } }, { type: 'setAngle', angle: 'rad' },
    '1', '÷', '3', EQ(500), { type: 'memStore' }, { type: 'clear' }, 'nCr(', '5', ',', '2', EQ(600), { type: 'memAdd' });
  assert.equal(savePersisted(storage, s), true);
  assert.ok(storage.data.has(STORAGE_KEY));
  // mô phỏng đóng/mở lại ứng dụng: trạng thái mới chỉ từ dữ liệu đã lưu
  const s2 = createInitialState(loadPersisted(storage));
  assert.deepEqual(s2.history, s.history);
  assert.equal(s2.history.length, 2);
  assert.equal(s2.memory?.value, s.memory?.value);
  assert.deepEqual(s2.memory?.exact, { n: 31n, d: 3n }); // 1/3 + 10, BigInt khôi phục đúng
  assert.deepEqual(s2.settings, { decimals: 3, decimalSep: ',', theme: 'dark' });
  assert.equal(s2.angle, 'rad');
  assert.equal(run(s2, { type: 'memRecall' }, '×', '3', EQ()).result, '31,000'.replace(',', '.'));
  assert.equal(run(s2, { type: 'memRecall' }, '×', '3', EQ()).kind, 'integer');
});
test('lưu bền vững: dữ liệu hỏng/thiếu/không có storage không làm hỏng ứng dụng', () => {
  const empty = createInitialState(deserialize(null));
  assert.equal(empty.history.length, 0);
  assert.equal(empty.memory, null);
  for (const raw of ['', '{', 'null', '[]', '{"v":2}', '{"v":1,"history":"x","memory":5,"settings":7,"angle":"zz"}']) {
    const p = deserialize(raw);
    assert.deepEqual(p.history, []);
    assert.equal(p.memory, null);
    assert.equal(p.angle, 'deg');
    assert.equal(p.settings.decimals, null);
  }
  const mixed = deserialize(JSON.stringify({
    v: 1, settings: { decimals: 50, decimalSep: ';', theme: 'blue' },
    history: [{ id: 1, expr: '1+1', result: '2', approximate: false, kind: 'integer', fraction: null, time: 5 }, { id: 'x' }, 7],
    memory: { value: 3, exact: 'abc' },
  }));
  assert.equal(mixed.history.length, 1);
  assert.deepEqual(mixed.settings, { decimals: null, decimalSep: '.', theme: null });
  assert.deepEqual(mixed.memory, { value: 3, exact: null });
  assert.equal(loadPersisted(null).history.length, 0);
  assert.equal(savePersisted(null, empty), false);
  const throwing: KV = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
  assert.equal(loadPersisted(throwing).history.length, 0);
  assert.equal(savePersisted(throwing, empty), false);
  assert.doesNotThrow(() => JSON.parse(serialize(run(initialState, '1', '÷', '3', EQ(), { type: 'memStore' }))));
});
