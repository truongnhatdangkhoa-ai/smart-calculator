// Định nghĩa phím và nhóm hàm của máy tính (tách khỏi giao diện để dễ chỉnh).
import type { Action } from './calculatorState.ts';
import type { AngleMode } from './engine/index.ts';

export interface KeyDef { label: string; aria: string; action: Action; kind: 'num' | 'op' | 'fn' | 'eq' | 'util' | 'mem'; wide?: boolean }
const ins = (text: string): Action => ({ type: 'input', text });
const k = (label: string, aria: string, action: Action, kind: KeyDef['kind'], wide = false): KeyDef => ({ label, aria, action, kind, wide });
const num = (d: string) => k(d, d, ins(d), 'num');
const fn = (label: string, aria: string, text: string) => k(label, aria, ins(text), 'fn');

export const MAIN: KeyDef[] = [
  k('AC', 'Xóa tất cả', { type: 'clear' }, 'util'), k('⌫', 'Xóa ký tự cuối', { type: 'backspace' }, 'util'),
  k('(', 'Mở ngoặc', ins('('), 'fn'), k(')', 'Đóng ngoặc', ins(')'), 'fn'), k('÷', 'Chia', ins('÷'), 'op'),
  num('7'), num('8'), num('9'), k('%', 'Phần trăm', ins('%'), 'fn'), k('×', 'Nhân', ins('×'), 'op'),
  num('4'), num('5'), num('6'), k('±', 'Đổi dấu', { type: 'negate' }, 'fn'), k('−', 'Trừ', ins('−'), 'op'),
  num('1'), num('2'), num('3'), k('Ans', 'Kết quả trước', ins('Ans'), 'fn'), k('+', 'Cộng', ins('+'), 'op'),
  { ...num('0'), wide: true }, num('.'), { ...k('=', 'Bằng', { type: 'equals' }, 'eq'), wide: true },
];

export type FnTab = 'basic' | 'trig' | 'hyp' | 'log' | 'arith' | 'comb' | 'mem';
export const FN_TABS: { id: FnTab; label: string }[] = [
  { id: 'basic', label: 'Cơ bản' }, { id: 'trig', label: 'Lượng giác' }, { id: 'log', label: 'Log và mũ' },
  { id: 'arith', label: 'Số học' }, { id: 'comb', label: 'Tổ hợp' }, { id: 'hyp', label: 'Hyperbolic' }, { id: 'mem', label: 'Bộ nhớ' },
];

/** Dòng hướng dẫn ngắn dưới nhóm hàm đang chọn. */
export function fnHint(tab: FnTab, angle: AngleMode): string {
  switch (tab) {
    case 'basic': return 'xʸ: gõ cơ số, bấm xʸ, gõ số mũ. ⁿ√ viết root(n, x).';
    case 'trig': return `Gõ hàm rồi nhập góc, ví dụ sin(30). Đang tính theo ${angle === 'deg' ? 'độ' : 'radian'}.`;
    case 'log': return 'log là cơ số 10, ln là cơ số e, logₐ viết logb(cơ số, x).';
    case 'arith': return 'gcd: ước chung lớn nhất, lcm: bội chung nhỏ nhất, mod: phần dư. ⇄ đổi phân số và số thập phân.';
    case 'comb': return 'nCr(n, k): tổ hợp. nPr(n, k): chỉnh hợp. prob(m, n): xác suất m/n.';
    case 'hyp': return 'Hàm hyperbolic và hàm ngược của chúng.';
    case 'mem': return 'MS lưu số, MR chèn M vào biểu thức, M+ và M− cộng hoặc trừ, MC xóa.';
  }
}

export const FN_KEYS: Record<FnTab, KeyDef[]> = {
  basic: [
    fn('x²', 'Bình phương', '^2'), fn('x³', 'Lập phương', '^3'), fn('xʸ', 'Lũy thừa', '^'), fn('1/x', 'Nghịch đảo', '^(−1)'),
    fn('√', 'Căn bậc hai', '√('), fn('∛', 'Căn bậc ba', 'cbrt('),
    fn('ⁿ√', 'Căn bậc n: root(n, x)', 'root('), fn('|x|', 'Giá trị tuyệt đối', 'abs('), fn('n!', 'Giai thừa', '!'),
    fn('π', 'Số pi', 'π'), fn('e', 'Số e', 'e'), fn(',', 'Dấu phẩy ngăn cách đối số', ','),
  ],
  trig: [
    fn('sin', 'Sin', 'sin('), fn('cos', 'Cos', 'cos('), fn('tan', 'Tan', 'tan('),
    fn('sin⁻¹', 'Arcsin', 'asin('), fn('cos⁻¹', 'Arccos', 'acos('), fn('tan⁻¹', 'Arctan', 'atan('),
    fn('π', 'Số pi', 'π'), fn('(', 'Mở ngoặc', '('), fn(')', 'Đóng ngoặc', ')'), fn(',', 'Dấu phẩy', ','),
  ],
  hyp: [
    fn('sinh', 'Sinh', 'sinh('), fn('cosh', 'Cosh', 'cosh('), fn('tanh', 'Tanh', 'tanh('),
    fn('sinh⁻¹', 'Arsinh', 'asinh('), fn('cosh⁻¹', 'Arcosh', 'acosh('), fn('tanh⁻¹', 'Artanh', 'atanh('),
    fn('(', 'Mở ngoặc', '('), fn(')', 'Đóng ngoặc', ')'),
  ],
  log: [
    fn('log', 'Logarit cơ số 10', 'log('), fn('ln', 'Logarit tự nhiên', 'ln('), fn('logₐ', 'Logarit cơ số tùy chỉnh: logb(cơ số, x)', 'logb('),
    fn('eˣ', 'Hàm mũ exp', 'exp('), fn('10ˣ', 'Mười mũ x', '10^'), fn('2ˣ', 'Hai mũ x', '2^'),
    fn('xʸ', 'Lũy thừa', '^'), fn('e', 'Số e', 'e'), fn('π', 'Số pi', 'π'), fn(',', 'Dấu phẩy', ','), fn('√', 'Căn bậc hai', '√('),
  ],
  arith: [
    fn('gcd', 'Ước chung lớn nhất', 'gcd('), fn('lcm', 'Bội chung nhỏ nhất', 'lcm('), fn('mod', 'Chia lấy dư', 'mod('),
    fn('⌊x⌋', 'Phần nguyên (floor)', 'floor('), fn('⌈x⌉', 'Làm tròn lên (ceil)', 'ceil('), fn('round', 'Làm tròn', 'round('),
    fn('frac', 'Phần lẻ', 'frac('), fn('|x|', 'Giá trị tuyệt đối', 'abs('), fn('n!', 'Giai thừa', '!'),
    fn('a/b', 'Nhập phân số a/b', '÷'), k('⇄', 'Chuyển đổi phân số và số thập phân', { type: 'toggleFraction' }, 'fn'), fn(',', 'Dấu phẩy', ','),
  ],
  comb: [
    fn('nPr', 'Chỉnh hợp nPr(n, k)', 'nPr('), fn('nCr', 'Tổ hợp nCr(n, k)', 'nCr('), fn('n!', 'Hoán vị n! (giai thừa)', '!'),
    fn('P(m,n)', 'Xác suất m trường hợp thuận lợi trên n: prob(m, n)', 'prob('), fn('binom', 'Xác suất nhị thức: binom(n, k, p)', 'binom('),
    fn(',', 'Dấu ngăn cách đối số', ','), fn('(', 'Mở ngoặc', '('), fn(')', 'Đóng ngoặc', ')'),
  ],
  mem: [
    k('MC', 'Xóa bộ nhớ (MC)', { type: 'memClear' }, 'mem'), k('MR', 'Gọi bộ nhớ (MR): chèn M vào biểu thức', { type: 'memRecall' }, 'mem'),
    k('M+', 'Cộng giá trị hiện tại vào bộ nhớ (M+)', { type: 'memAdd' }, 'mem'),
    k('M−', 'Trừ giá trị hiện tại khỏi bộ nhớ (M−)', { type: 'memSub' }, 'mem'),
    k('MS', 'Lưu giá trị hiện tại vào bộ nhớ (MS)', { type: 'memStore' }, 'mem'),
  ],
};

/** Biểu thức mẫu hiện khi máy tính còn trống, để người mới biết nên thử gì. */
export const QUICK_TRIES: string[] = ['(3+4)×5', 'sin(30)', '12÷18', '√(81)', 'nCr(10,3)', '2^10'];

export const KEYMAP: Record<string, Action> = {
  '+': ins('+'), '-': ins('−'), '*': ins('×'), '/': ins('÷'), '^': ins('^'), '(': ins('('), ')': ins(')'),
  '!': ins('!'), '%': ins('%'), '.': ins('.'), ',': ins(','), ';': ins(','), '=': { type: 'equals' },
  Backspace: { type: 'backspace' }, Escape: { type: 'clear' },
};
export { ins };
