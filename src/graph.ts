// Đồ thị y = f(x): logic thuần (lấy mẫu, khung nhìn, lưới, phát hiện gián đoạn theo lấy mẫu). Không phụ thuộc giao diện.
export interface View { xmin: number; xmax: number; ymin: number; ymax: number }
export const DEFAULT_VIEW: View = { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };
export const MIN_SPAN = 1e-9;
export const MAX_SPAN = 1e9;
export const MAX_SAMPLES = 2000;

export const DISCLAIMER =
  'Phát hiện gián đoạn/tiệm cận chỉ dựa trên lấy mẫu điểm nên có thể bỏ sót hoặc báo thừa; hãy kiểm tra thêm bằng cách phóng to.';

/** null nếu khung nhìn hợp lệ, ngược lại là thông báo lỗi tiếng Việt. */
export function validateView(v: View): string | null {
  const vals = [v.xmin, v.xmax, v.ymin, v.ymax];
  if (vals.some((n) => !Number.isFinite(n))) return 'Giới hạn x, y phải là số hợp lệ.';
  if (!(v.xmin < v.xmax)) return 'x nhỏ nhất phải nhỏ hơn x lớn nhất.';
  if (!(v.ymin < v.ymax)) return 'y nhỏ nhất phải nhỏ hơn y lớn nhất.';
  const sx = v.xmax - v.xmin, sy = v.ymax - v.ymin;
  if (sx < MIN_SPAN || sy < MIN_SPAN) return 'Khoảng nhìn quá hẹp (tối thiểu 1e-9).';
  if (sx > MAX_SPAN || sy > MAX_SPAN || vals.some((n) => Math.abs(n) > MAX_SPAN)) return 'Khoảng nhìn quá lớn (tối đa 1e9).';
  return null;
}
/** Giữ nguyên khung cũ nếu khung mới không hợp lệ (tránh phóng/di chuyển quá giới hạn). */
const keepValid = (next: View, old: View): View => (validateView(next) === null ? next : old);

/** Thu phóng quanh điểm (cx, cy) theo hệ số factor (<1 phóng to, >1 thu nhỏ). */
export function zoomView(v: View, factor: number, cx = (v.xmin + v.xmax) / 2, cy = (v.ymin + v.ymax) / 2): View {
  if (!(factor > 0) || !Number.isFinite(factor)) return v;
  return keepValid({
    xmin: cx - (cx - v.xmin) * factor, xmax: cx + (v.xmax - cx) * factor,
    ymin: cy - (cy - v.ymin) * factor, ymax: cy + (v.ymax - cy) * factor,
  }, v);
}
/** Di chuyển khung nhìn theo đơn vị dữ liệu. */
export function panView(v: View, dx: number, dy: number): View {
  return keepValid({ xmin: v.xmin + dx, xmax: v.xmax + dx, ymin: v.ymin + dy, ymax: v.ymax + dy }, v);
}

/** Bước lưới "đẹp" (1, 2, 5 × 10ⁿ) sao cho có khoảng `target` vạch trong `span`. */
export function niceStep(span: number, target = 8): number {
  const raw = span / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
export function ticks(min: number, max: number, target = 8): number[] {
  const step = niceStep(max - min, target);
  const out: number[] = [];
  const start = Math.ceil(min / step - 1e-9);
  for (let i = start; i * step <= max + step * 1e-9 && out.length < 200; i++) {
    const t = i * step;
    out.push(Math.abs(t) < step * 1e-9 ? 0 : Number(t.toPrecision(12)));
  }
  return out;
}

export interface Sample { x: number; y: number }
export function sample(f: (x: number) => number, xmin: number, xmax: number, n: number): Sample[] {
  const count = Math.max(2, Math.min(MAX_SAMPLES, Math.floor(n)));
  const out: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const x = xmin + ((xmax - xmin) * i) / (count - 1);
    const y = f(x);
    out.push({ x, y: Number.isFinite(y) ? y : NaN });
  }
  return out;
}

export interface Analysis {
  /** Các đoạn liên tục để vẽ (đã ngắt tại điểm không xác định hoặc nhảy lớn). */
  segments: Sample[][];
  /** Khoảng x (theo mẫu) mà hàm không xác định. */
  undefinedRanges: [number, number][];
  /** Vị trí x gần nơi đồ thị nhảy vọt đổi dấu (có thể là tiệm cận đứng). */
  jumps: number[];
}
export function analyze(samples: Sample[], view: View): Analysis {
  const span = view.ymax - view.ymin;
  const segments: Sample[][] = [];
  const undefinedRanges: [number, number][] = [];
  const jumps: number[] = [];
  let cur: Sample[] = [];
  let nanStart: number | null = null;
  let prev: Sample | null = null;
  const flush = () => { if (cur.length) segments.push(cur); cur = []; };
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    if (Number.isNaN(p.y)) {
      flush();
      if (nanStart === null) nanStart = p.x;
      prev = null;
      continue;
    }
    if (nanStart !== null) {
      undefinedRanges.push([nanStart, samples[i - 1].x]);
      nanStart = null;
    }
    if (prev && prev.y * p.y < 0 && Math.abs(p.y - prev.y) > 2 * span) {
      flush();
      jumps.push((prev.x + p.x) / 2);
    }
    cur.push(p);
    prev = p;
  }
  flush();
  if (nanStart !== null) undefinedRanges.push([nanStart, samples[samples.length - 1].x]);
  return { segments, undefinedRanges, jumps };
}

/** Gợi ý khoảng y từ các mẫu hữu hạn (bỏ 2% giá trị cực đoan hai đầu). null nếu không có điểm nào. */
export function autoYRange(samples: Sample[]): [number, number] | null {
  const ys = samples.map((s) => s.y).filter(Number.isFinite).sort((a, b) => a - b);
  if (ys.length === 0) return null;
  const lo = ys[Math.floor(ys.length * 0.02)], hi = ys[Math.ceil(ys.length * 0.98) - 1];
  if (hi - lo < 1e-9) return [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.1;
  return [lo - pad, hi + pad];
}

/** Điểm trên đồ thị tại hoành độ x (gần đúng); y = null nếu hàm không xác định tại x. */
export function pickPoint(f: (x: number) => number, x: number): { x: number; y: number | null } {
  const y = f(x);
  return { x, y: Number.isFinite(y) ? y : null };
}

/** Mô tả bằng lời các vùng không xác định / gián đoạn phát hiện được (tối đa 4 mỗi loại). */
export function describeAnalysis(a: Analysis, fmt: (n: number) => string): string[] {
  const out: string[] = [];
  const u = a.undefinedRanges.slice(0, 4).map(([p, q]) => (p === q ? `x ≈ ${fmt(p)}` : `x từ ${fmt(p)} đến ${fmt(q)}`));
  if (u.length) out.push(`Không xác định (theo lấy mẫu) tại: ${u.join('; ')}${a.undefinedRanges.length > 4 ? '; …' : ''}.`);
  if (a.jumps.length)
    out.push(`Có thể gián đoạn hoặc tiệm cận đứng gần: ${a.jumps.slice(0, 4).map((x) => `x ≈ ${fmt(x)}`).join('; ')}${a.jumps.length > 4 ? '; …' : ''}.`);
  return out;
}
