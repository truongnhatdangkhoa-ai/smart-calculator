import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../engine/index.ts';
import type { AngleMode } from '../engine/index.ts';
import { FORMULAS, GROUPS, SPECIAL_ANGLES, searchFormulas } from './catalog.ts';
import type { CalcDef, IdentityDef } from './catalog.ts';
import { defaultValues, runCalc, runIdentity } from './runner.ts';

const identities = FORMULAS.filter((f): f is IdentityDef => f.kind === 'identity');
const calcs = FORMULAS.filter((f): f is CalcDef => f.kind === 'calc');
const byId = <T extends { id: string }>(list: T[], id: string): T => {
  const f = list.find((x) => x.id === id);
  assert.ok(f, `thiếu công thức ${id}`);
  return f;
};

test('danh mục: id duy nhất, nhóm hợp lệ, biến trong tiêu đề và biểu thức đều được khai báo', () => {
  const ids = FORMULAS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  const groups = new Set(GROUPS.map((g) => g.id));
  for (const f of FORMULAS) {
    assert.ok(groups.has(f.group), f.id);
    assert.ok(f.name.length > 0 && f.keywords.length > 0, f.id);
  }
  for (const f of [...identities, ...calcs]) {
    const names = new Set(f.vars.map((v) => v.name));
    const titles = [f.title, ...(f.kind === 'identity' && f.titleRad ? [f.titleRad] : []), ...(f.kind === 'calc' ? f.outputs.map((o) => o.text) : [])];
    for (const t of titles) for (const m of t.matchAll(/\{(\w+)\}/g)) {
      if (m[1] !== 'R' && m[1] !== 'S') assert.ok(names.has(m[1]), `${f.id}: {${m[1]}} chưa khai báo`);
    }
    const exprs = f.kind === 'identity' ? f.forms.flat() : f.outputs.map((o) => o.expr);
    for (const e of exprs) {
      const letters = e.replace(/\{[RS]\}/g, '').replace(/sin|cos|tan|sqrt|pi/g, '').match(/[a-z]/g) ?? [];
      for (const l of letters) assert.ok(names.has(l), `${f.id}: biến ${l} trong "${e}" chưa khai báo`);
    }
  }
});

test('mọi hằng đẳng thức và công thức lượng giác đúng với giá trị mẫu (DEG và RAD)', () => {
  for (const angle of ['deg', 'rad'] as AngleMode[]) {
    for (const f of identities) {
      const r = runIdentity(f, defaultValues(f.vars, angle), angle);
      assert.ok(r.ok, `${f.id} (${angle}) lỗi: ${r.ok ? '' : r.message ?? JSON.stringify(r.errors)}`);
      if (r.ok) assert.ok(r.verdict.equal, `${f.id} (${angle}) hai vế không bằng nhau`);
    }
  }
});

test('hằng đẳng thức đúng với số âm, phân số, số thập phân, số 0 (chính xác)', () => {
  const cases: [string, string][] = [['-2', '5'], ['1/2', '1/3'], ['0.5', '-0.25'], ['0', '7'], ['10', '-10'], ['-3/4', '2/5']];
  for (const f of identities.filter((x) => x.group === 'identity')) {
    for (const [a, b] of cases) {
      const r = runIdentity(f, { a, b, c: '2' }, 'deg');
      assert.ok(r.ok, `${f.id} a=${a} b=${b}`);
      if (r.ok) {
        assert.ok(r.verdict.equal, `${f.id} a=${a} b=${b}`);
        assert.match(r.verdict.text, /chính xác/);
      }
    }
  }
});

test('hằng đẳng thức đúng với đa thức theo x (khai triển chính xác)', () => {
  const sets: [string, string][] = [['2x', '3'], ['x', '1'], ['x+1', 'x-1'], ['3x', '-2'], ['x/2', '1/3']];
  for (const f of identities.filter((x) => x.group === 'identity')) {
    for (const [a, b] of sets) {
      const r = runIdentity(f, { a, b, c: 'x' }, 'deg');
      assert.ok(r.ok, `${f.id} a=${a} b=${b}: ${r.ok ? '' : r.message ?? JSON.stringify(r.errors)}`);
      if (r.ok) { assert.ok(r.symbolic); assert.ok(r.verdict.equal, `${f.id} a=${a} b=${b}`); }
    }
  }
  const r = runIdentity(byId(identities, 'sq-sum'), { a: '2x', b: '3' }, 'deg');
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.forms[0].total, '4x² + 12x + 9');
    assert.equal(r.forms[1].parts, '4x² + 12x + 9');
    assert.equal(r.forms[1].expr, '(2x)² + 2·(2x)·3 + 3²');
  }
});

test('hằng đẳng thức: hiển thị các bước với giá trị cụ thể', () => {
  const r = runIdentity(byId(identities, 'sq-sum'), { a: '3', b: '2' }, 'deg');
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.forms[0].expr, '(3 + 2)²');
    assert.equal(r.forms[0].total, '25');
    assert.equal(r.forms[1].expr, '3² + 2·3·2 + 2²');
    assert.equal(r.forms[1].parts, '9 + 12 + 4');
    assert.equal(r.forms[1].total, '25');
    assert.equal(r.send, '25');
  }
  const d = runIdentity(byId(identities, 'sq-diff'), { a: '1', b: '4' }, 'deg');
  assert.ok(d.ok);
  if (d.ok) { assert.equal(d.forms[1].expr, '1² − 2·1·4 + 4²'); assert.equal(d.forms[1].parts, '1 − 8 + 16'); assert.equal(d.forms[0].total, '9'); }
  const n = runIdentity(byId(identities, 'sq-sum'), { a: '-2', b: '5' }, 'deg');
  assert.ok(n.ok);
  if (n.ok) { assert.equal(n.forms[0].expr, '(−2 + 5)²'); assert.equal(n.forms[1].expr, '(−2)² + 2·(−2)·5 + 5²'); }
  const m = runIdentity(byId(identities, 'sq-diff'), { a: '3', b: '-2' }, 'deg');
  assert.ok(m.ok);
  if (m.ok) assert.equal(m.forms[0].expr, '(3 − (−2))²');
  const f = runIdentity(byId(identities, 'sq-sum'), { a: '1/2', b: '1/3' }, 'deg');
  assert.ok(f.ok);
  if (f.ok) { assert.equal(f.forms[0].expr, '(1/2 + 1/3)²'); assert.equal(f.forms[0].total, '25/36'); assert.equal(f.forms[1].expr, '(1/2)² + 2·(1/2)·(1/3) + (1/3)²'); }
  const sy = runIdentity(byId(identities, 'sq-sum'), { a: '2x', b: '3' }, 'deg');
  assert.ok(sy.ok);
  if (sy.ok) assert.equal(sy.forms[0].expr, '(2x + 3)²');
  const sy2 = runIdentity(byId(identities, 'diff-sq'), { a: 'x+1', b: 'x-1' }, 'deg');
  assert.ok(sy2.ok);
  if (sy2.ok) { assert.equal(sy2.forms[0].expr, '(x + 1)² − (x − 1)²'); assert.equal(sy2.forms[0].total, '4x'); }
  const tr = runIdentity(byId(identities, 't-co-sin'), { a: '30' }, 'deg');
  assert.ok(tr.ok);
  if (tr.ok) assert.equal(tr.forms[0].expr, 'sin(90 − 30)');
  const trn = runIdentity(byId(identities, 't-cos-diff'), { a: '30', b: '-45' }, 'deg');
  assert.ok(trn.ok);
  if (trn.ok) assert.equal(trn.forms[0].expr, 'cos(30 − (−45))');
});

test('lượng giác: đúng với nhiều góc, cả độ và radian', () => {
  const trig = identities.filter((f) => f.group === 'trig');
  assert.ok(trig.length >= 20);
  const degAngles: [string, string][] = [['10', '25'], ['37', '43'], ['72', '28'], ['100', '20'], ['200', '-40'], ['-15', '75']];
  for (const f of trig) {
    for (const [a, b] of degAngles) {
      const r = runIdentity(f, { a, b }, 'deg');
      assert.ok(r.ok, `${f.id} deg ${a},${b}: ${r.ok ? '' : r.message}`);
      if (r.ok) assert.ok(r.verdict.equal, `${f.id} deg ${a},${b}`);
    }
    for (const [a, b] of [['0.3', '1.1'], ['pi/5', 'pi/7'], ['2', '-0.4']] as [string, string][]) {
      const r = runIdentity(f, { a, b }, 'rad');
      assert.ok(r.ok, `${f.id} rad ${a},${b}: ${r.ok ? '' : r.message}`);
      if (r.ok) assert.ok(r.verdict.equal, `${f.id} rad ${a},${b}`);
    }
  }
});

test('lượng giác: báo lỗi rõ khi không xác định (tan 90°) và khi nhập sai', () => {
  const tanSum = byId(identities, 't-tan-sum');
  const r = runIdentity(tanSum, { a: '45', b: '45' }, 'deg');
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message ?? '', /không tính được/);
  const bad = runIdentity(byId(identities, 't-pythag'), { a: 'abc' }, 'deg');
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.errors.a);
  const empty = runIdentity(byId(identities, 't-pythag'), { a: '  ' }, 'deg');
  assert.equal(empty.ok, false);
  const x = runIdentity(byId(identities, 't-pythag'), { a: 'x' }, 'deg');
  assert.equal(x.ok, false);
});

test('hằng đẳng thức: nhập sai báo lỗi đúng ô', () => {
  const f = byId(identities, 'sq-sum');
  const r = runIdentity(f, { a: '2x', b: '3 +' }, 'deg');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.b && !r.errors.a);
  const r2 = runIdentity(f, { a: 'x', b: 'y' }, 'deg');
  assert.equal(r2.ok, false);
  const r3 = runIdentity(f, { a: '', b: '1' }, 'deg');
  assert.equal(r3.ok, false);
  if (!r3.ok) assert.equal(r3.errors.a, 'Hãy nhập một giá trị.');
});

const lines = (id: string, raw: Record<string, string>) => {
  const r = runCalc(byId(calcs, id), raw, 'deg');
  assert.ok(r.ok, r.ok ? '' : r.message ?? JSON.stringify(r.errors));
  return r.ok ? r.lines : [];
};

test('hình học: giá trị đã biết', () => {
  let l = lines('rect', { a: '8', b: '5' });
  assert.equal(l[0].main, '26'); assert.equal(l[1].main, '40');
  assert.ok(l[2].approx || l[2].main.startsWith('9.4339811'));
  l = lines('square', { a: '6' });
  assert.deepEqual(l.slice(0, 2).map((x) => x.main), ['24', '36']);
  l = lines('triangle', { a: '10', h: '6' });
  assert.equal(l[0].main, '30');
  l = lines('heron', { a: '3', b: '4', c: '5' });
  assert.deepEqual(l.map((x) => x.main), ['12', '6', '6']);
  l = lines('pyth-hyp', { a: '3', b: '4' });
  assert.equal(l[0].main, '5');
  l = lines('pyth-leg', { c: '5', a: '3' });
  assert.equal(l[0].main, '4');
  l = lines('trapezoid', { a: '9', b: '5', h: '4' });
  assert.equal(l[0].main, '28');
  l = lines('cuboid', { a: '4', b: '3', c: '12' });
  assert.deepEqual(l.map((x) => x.main), ['144', '192', '13']);
  l = lines('distance', { a: '1', b: '2', c: '4', d: '6' });
  assert.deepEqual(l.map((x) => x.main), ['5', '5/2', '4']);
});

test('hình học: kết quả theo π (dạng chính xác + gần đúng)', () => {
  let l = lines('circle', { r: '5' });
  assert.equal(l[0].main, '10π'); assert.equal(l[1].main, '25π');
  assert.ok(Math.abs(Number(l[1].alt) - 25 * Math.PI) < 1e-9);
  l = lines('sphere', { r: '3' });
  assert.equal(l[0].main, '36π'); assert.equal(l[1].main, '36π');
  l = lines('sphere', { r: '1' });
  assert.equal(l[1].main, '4π/3');
  l = lines('cylinder', { r: '3', h: '5' });
  assert.deepEqual(l.map((x) => x.main), ['30π', '48π', '45π']);
  l = lines('cone', { r: '3', h: '4' });
  assert.deepEqual(l.map((x) => x.main), ['5', '15π', '12π']);
  l = lines('circle', { r: '1/2' });
  assert.equal(l[0].main, 'π'); assert.equal(l[1].main, 'π/4');
  l = lines('circle', { r: '1,5' }); // dấu phẩy thập phân
  assert.equal(l[1].main, '9π/4');
});

test('hình học: kiểm tra đầu vào', () => {
  const heron = byId(calcs, 'heron');
  const r = runCalc(heron, { a: '1', b: '2', c: '5' }, 'deg');
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message ?? '', /không tạo được tam giác/);
  const leg = runCalc(byId(calcs, 'pyth-leg'), { c: '3', a: '5' }, 'deg');
  assert.equal(leg.ok, false);
  const neg = runCalc(byId(calcs, 'circle'), { r: '-2' }, 'deg');
  assert.equal(neg.ok, false);
  if (!neg.ok) assert.equal(neg.errors.r, 'Giá trị phải là số dương.');
  const zero = runCalc(byId(calcs, 'circle'), { r: '0' }, 'deg');
  assert.equal(zero.ok, false);
  const junk = runCalc(byId(calcs, 'circle'), { r: '5 +' }, 'deg');
  assert.equal(junk.ok, false);
});

test('bảng góc đặc biệt khớp với bộ máy tính (độ)', () => {
  const val = (e: string) => {
    const r = evaluate(e, { angleMode: 'deg' });
    assert.ok(r.ok, e);
    return (r as { value: number }).value;
  };
  for (const row of SPECIAL_ANGLES) {
    assert.ok(Math.abs(val(`sin(${row.deg})`) - val(row.sinE)) < 1e-12, `sin ${row.deg}`);
    assert.ok(Math.abs(val(`cos(${row.deg})`) - val(row.cosE)) < 1e-12, `cos ${row.deg}`);
    if (row.tanE !== null) assert.ok(Math.abs(val(`tan(${row.deg})`) - val(row.tanE)) < 1e-12, `tan ${row.deg}`);
    else assert.equal(evaluate('tan(90)', { angleMode: 'deg' }).ok, false);
  }
});

test('tìm công thức: không dấu, nhiều từ, không có kết quả', () => {
  assert.ok(searchFormulas('binh phuong').some((f) => f.id === 'sq-sum'));
  assert.ok(searchFormulas('hình tròn').some((f) => f.id === 'circle'));
  assert.ok(searchFormulas('PHƯƠNG TRÌNH bậc hai').some((f) => f.id === 'quadratic'));
  assert.ok(searchFormulas('sin cos').some((f) => f.id === 't-sin-sum'));
  assert.equal(searchFormulas('').length, FORMULAS.length);
  assert.equal(searchFormulas('zzzzzz').length, 0);
});
