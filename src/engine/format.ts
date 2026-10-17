export interface FormatOptions {
  /** Số chữ số thập phân cố định; null = tự động (tối đa 12 chữ số có nghĩa). */
  decimals?: number | null;
}
export interface Formatted { text: string; approximate: boolean }

const sigDigits = (t: string) => t.replace(/e.*$/i, '').replace(/[-.]/g, '').replace(/^0+/, '').length;

/** Định dạng để hiển thị. Giá trị nội bộ không bị làm tròn; chỉ chuỗi hiển thị bị làm tròn. */
export function formatNumber(v: number, opts: FormatOptions = {}): Formatted {
  if (Object.is(v, -0)) v = 0;
  const d = opts.decimals ?? null;
  const abs = Math.abs(v);
  if (d !== null && abs < 1e21) {
    let text = v.toFixed(d);
    if (Number(text) === 0) text = text.replace('-', '');
    return { text, approximate: Math.abs(Number(text) - v) > 1e-12 * Math.max(1, abs) };
  }
  let text: string;
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-6 || (abs >= 1e12 && !Number.isInteger(v)))) {
    const [m, ex] = v.toExponential(11).split('e');
    text = `${m.includes('.') ? m.replace(/\.?0+$/, '') : m}e${ex}`;
  } else if (Number.isInteger(v)) {
    text = String(v);
  } else {
    text = v.toPrecision(12);
    if (text.includes('.')) text = text.replace(/\.?0+$/, '');
  }
  return { text, approximate: sigDigits(text) >= 12 && Number(text) !== v };
}
