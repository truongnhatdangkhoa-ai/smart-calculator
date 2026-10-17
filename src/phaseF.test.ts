import test from 'node:test';
import assert from 'node:assert/strict';
import { exportHistory, mergeHistory, parseHistoryImport } from './storage.ts';
import { reducer, createInitialState, MAX_HISTORY } from './calculatorState.ts';
import type { HistoryEntry } from './calculatorState.ts';

const h = (id: number, expr: string, result: string, time: number): HistoryEntry =>
  ({ id, expr, result, approximate: false, kind: 'integer', fraction: null, time });

test('xuất rồi nhập lại giữ nguyên bản ghi', () => {
  const src = [h(2, '2+3', '5', 200), h(1, '1/3', '0.333333333333', 100)];
  src[1] = { ...src[1], kind: 'fraction', fraction: '1/3', approximate: true };
  const r = parseHistoryImport(exportHistory(src, 1));
  assert.ok(r.ok);
  if (r.ok) { assert.deepEqual(r.entries, src); assert.equal(r.skipped, 0); }
});

test('nhập: từ chối rác, JSON hỏng, file của app khác, nội dung trống', () => {
  for (const bad of ['', '   ', 'abc', '{"a":1}', '[]', 'null', '{"app":"x","v":1,"history":[]}', '{"app":"scientific-calculator-history","v":2,"history":[]}'])
    assert.equal(parseHistoryImport(bad).ok, false, bad);
  assert.equal(parseHistoryImport('x'.repeat(2_000_001)).ok, false);
});

test('nhập: bỏ qua bản ghi lỗi và đếm', () => {
  const raw = JSON.stringify({ app: 'scientific-calculator-history', v: 1, history: [h(1, '1+1', '2', 5), { id: 'x' }, 7, null, h(2, 'a', 'b', NaN)] });
  const r = parseHistoryImport(raw);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.entries.length, 1); assert.equal(r.skipped, 4); }
});

test('gộp: bỏ trùng, id mới không đụng id cũ, mới nhất trước', () => {
  const cur = [h(5, '1+1', '2', 300), h(3, '2+2', '4', 100)];
  const imp = [h(1, '2+2', '4', 100), h(2, '3+3', '6', 200), h(3, '9', '9', 50)];
  const m = mergeHistory(cur, imp);
  assert.equal(m.added, 2);
  assert.deepEqual(m.history.map((x) => x.time), [300, 200, 100, 50]);
  assert.equal(new Set(m.history.map((x) => x.id)).size, 4);
  assert.equal(mergeHistory(m.history, imp).added, 0); // nhập lại lần nữa không nhân đôi
});

test('gộp: không vượt giới hạn 200', () => {
  const imp = Array.from({ length: 150 }, (_, i) => h(i, `e${i}`, '1', i));
  const cur = Array.from({ length: 150 }, (_, i) => h(i + 1000, `c${i}`, '1', 1000 + i));
  const m = mergeHistory(cur, imp);
  assert.equal(m.history.length, MAX_HISTORY);
  assert.equal(m.added, 50);
});

test('reducer historySet thay lịch sử, tôn trọng giới hạn', () => {
  const s = reducer(createInitialState(), { type: 'historySet', history: Array.from({ length: 250 }, (_, i) => h(i, 'e', '1', i)) });
  assert.equal(s.history.length, MAX_HISTORY);
});
