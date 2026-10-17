import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from './engine/index.ts';
import {
  analyze, autoYRange, DEFAULT_VIEW, describeAnalysis, niceStep, panView, pickPoint, sample, ticks, validateView, zoomView,
} from './graph.ts';

const f = (src: string, angle?: 'deg' | 'rad') => {
  const r = compile(src, { angleMode: angle ?? 'rad' });
  assert.ok(r.ok, src);
  return r.f;
};
const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test('compile: biến x, nhân ngầm, hằng, hàm; NaN tại điểm không xác định', () => {
  near(f('x^2')(3), 9);
  near(f('2x+1')(4), 9);
  near(f('sin(x)')(Math.PI / 2), 1);
  near(f('sin(x)', 'deg')(30), 0.5);
  near(f('e^x')(1), Math.E);
  assert.ok(Number.isNaN(f('1/x')(0)));
  assert.ok(Number.isNaN(f('ln(x)')(-1)));
  assert.ok(Number.isNaN(f('sqrt(x)')(-4)));
  assert.ok(Number.isNaN(f('10^x')(1000)));
  near(f('x!')(5), 120);
});
test('compile: lỗi cú pháp báo ngay, Ans/M không dùng được', () => {
  for (const s of ['', 'x+', '2*(x', 'foo(x)', 'sin x', 'Ans+x', 'M*x', 'x@2']) {
    const r = compile(s);
    if (s === '2*(x') assert.ok(r.ok, 'tự đóng ngoặc');
    else assert.ok(!r.ok && r.error.kind === 'syntax', s);
  }
  const long = compile('x+'.repeat(150) + '1');
  assert.ok(!long.ok && long.error.kind === 'limit');
});
test('x ngoài đồ thị: máy tính thường báo lỗi rõ ràng', async () => {
  const { evaluate } = await import('./engine/index.ts');
  const r = evaluate('x+1');
  assert.ok(!r.ok && /đồ thị/.test(r.error.message));
  const r2 = evaluate('x+1', { x: 2 });
  assert.ok(r2.ok && r2.value === 3);
});
test('khung nhìn: kiểm tra hợp lệ, thu phóng, di chuyển, giới hạn', () => {
  assert.equal(validateView(DEFAULT_VIEW), null);
  assert.match(validateView({ ...DEFAULT_VIEW, xmin: 5, xmax: 5 }) ?? '', /x nhỏ nhất/);
  assert.match(validateView({ ...DEFAULT_VIEW, ymin: 3, ymax: -3 }) ?? '', /y nhỏ nhất/);
  assert.match(validateView({ ...DEFAULT_VIEW, xmax: NaN }) ?? '', /số hợp lệ/);
  assert.match(validateView({ ...DEFAULT_VIEW, xmax: 1e12 }) ?? '', /quá lớn/);
  assert.match(validateView({ ...DEFAULT_VIEW, xmax: -10 + 1e-12 }) ?? '', /quá hẹp/);
  const z = zoomView(DEFAULT_VIEW, 0.5);
  assert.deepEqual(z, { xmin: -5, xmax: 5, ymin: -5, ymax: 5 });
  const zc = zoomView(DEFAULT_VIEW, 0.5, 10, 0); // giữ nguyên điểm (10, 0)
  assert.deepEqual([zc.xmin, zc.xmax, zc.ymin, zc.ymax], [0, 10, -5, 5]);
  assert.deepEqual(panView(DEFAULT_VIEW, 5, -2), { xmin: -5, xmax: 15, ymin: -12, ymax: 8 });
  let v = DEFAULT_VIEW;
  for (let i = 0; i < 200; i++) v = zoomView(v, 0.5);
  assert.equal(validateView(v), null, 'không bao giờ vượt giới hạn thu phóng');
  for (let i = 0; i < 200; i++) v = zoomView(v, 2);
  assert.equal(validateView(v), null);
  assert.equal(zoomView(DEFAULT_VIEW, -1), DEFAULT_VIEW);
});
test('lưới: bước đẹp và các vạch', () => {
  assert.equal(niceStep(20), 2);
  assert.equal(niceStep(1), 0.1);
  assert.equal(niceStep(1000), 100);
  assert.deepEqual(ticks(-10, 10, 8).filter((t) => t % 5 === 0), [-10, 0, 10]);
  assert.deepEqual(ticks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
  assert.ok(ticks(0, 1).includes(0.5));
  assert.ok(ticks(-1e6, 1e6).length < 30);
  assert.ok(ticks(0.001, 0.002).every((t) => t >= 0.001 && t <= 0.002 + 1e-12));
});
test('vẽ y=x²: một đoạn liên tục, không có vùng không xác định', () => {
  const a = analyze(sample(f('x^2'), -10, 10, 400), DEFAULT_VIEW);
  assert.equal(a.segments.length, 1);
  assert.equal(a.undefinedRanges.length, 0);
  assert.equal(a.jumps.length, 0);
  assert.equal(a.segments[0].length, 400);
});
test('vẽ ln(x): vùng x ≤ 0 không xác định', () => {
  const a = analyze(sample(f('ln(x)'), -5, 5, 501), { ...DEFAULT_VIEW });
  assert.equal(a.segments.length, 1);
  assert.equal(a.undefinedRanges.length, 1);
  assert.ok(a.undefinedRanges[0][0] === -5 && a.undefinedRanges[0][1] <= 0);
  assert.ok(a.segments[0][0].x > 0);
  const text = describeAnalysis(a, (n) => n.toFixed(2));
  assert.match(text[0], /Không xác định.*từ -5\.00/);
});
test('vẽ 1/x và tan(x): phát hiện gián đoạn tại 0 và tại π/2', () => {
  const a = analyze(sample(f('1/x'), -10.05, 9.95, 400), DEFAULT_VIEW);
  assert.ok(a.segments.length >= 2);
  assert.ok(a.jumps.some((x) => Math.abs(x) < 0.2), JSON.stringify(a.jumps));
  const t = analyze(sample(f('tan(x)'), -2, 2, 400), { xmin: -2, xmax: 2, ymin: -5, ymax: 5 });
  assert.ok(t.jumps.some((x) => Math.abs(x - Math.PI / 2) < 0.05 || Math.abs(x + Math.PI / 2) < 0.05), JSON.stringify(t.jumps));
  assert.ok(describeAnalysis(t, (n) => n.toFixed(2)).some((l) => /gián đoạn/.test(l)));
});
test('hàm không xác định hoàn toàn / tràn số: không ném lỗi', () => {
  const a = analyze(sample(f('sqrt(-1-x^2)'), -5, 5, 100), DEFAULT_VIEW);
  assert.equal(a.segments.length, 0);
  assert.equal(a.undefinedRanges.length, 1);
  assert.equal(autoYRange(sample(f('sqrt(-1-x^2)'), -5, 5, 100)), null);
  assert.doesNotThrow(() => analyze(sample(f('10^(10^x)'), -5, 5, 200), DEFAULT_VIEW));
  assert.equal(sample(f('x'), 0, 1, 1e9).length, 2000, 'giới hạn số mẫu');
});
test('tự chọn khoảng y và chọn điểm', () => {
  const r = autoYRange(sample(f('x^2'), -3, 3, 300))!;
  assert.ok(r[0] < 0.1 && r[1] > 7 && r[1] < 12, JSON.stringify(r));
  const c = autoYRange(sample(f('5'), -3, 3, 10))!;
  assert.deepEqual(c, [4, 6]);
  const tan = autoYRange(sample(f('tan(x)'), -3, 3, 600))!;
  assert.ok(Math.abs(tan[0]) < 100 && Math.abs(tan[1]) < 100, 'bỏ giá trị cực đoan');
  assert.deepEqual(pickPoint(f('x^2'), 3), { x: 3, y: 9 });
  assert.deepEqual(pickPoint(f('1/x'), 0), { x: 0, y: null });
});
