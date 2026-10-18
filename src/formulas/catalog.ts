// Thư viện công thức: dữ liệu thuần (không phụ thuộc React) để kiểm thử được.
// Ký hiệu {a} trong tiêu đề nghĩa là biến "a" (in nghiêng khi hiển thị).
// Biểu thức dùng cú pháp của bộ máy tính (sin(a), sqrt(x), pi, ^ , *, /).
// Trong biểu thức lượng giác: {R} = góc vuông (90° hoặc π/2), {S} = góc bẹt (180° hoặc π).

export type Group = 'identity' | 'trig' | 'algebra' | 'geometry';

export interface VarDef {
  name: string;
  label: string;
  example: string;
  /** Giá trị mẫu khi đang ở chế độ radian (chỉ cho biến là góc). */
  exampleRad?: string;
  angle?: boolean;
  positive?: boolean;
}
interface Base {
  id: string;
  group: Group;
  section?: string;
  /** Tên gọi ngắn bằng tiếng Việt. */
  name: string;
  /** Công thức hiển thị (có {biến}). */
  title: string;
  titleRad?: string;
  /** Từ khóa tìm kiếm (không dấu, thường). */
  keywords: string;
}
export interface IdentityDef extends Base {
  kind: 'identity';
  vars: VarDef[];
  /** Các dạng bằng nhau; mỗi dạng là tổng của các số hạng. Dạng đầu tiên là vế trái. */
  forms: string[][];
}
export interface OutputDef {
  label: string;
  expr: string;
  /** Công thức của đại lượng này (có {biến}). */
  text: string;
  /** Kết quả là bội của π: hiển thị dạng "9π" kèm giá trị gần đúng. */
  inPi?: boolean;
}
export interface CalcDef extends Base {
  kind: 'calc';
  vars: VarDef[];
  outputs: OutputDef[];
  validate?: (v: Record<string, number>) => string | null;
}
export interface ToolDef extends Base { kind: 'tool'; tool: 'quadratic' | 'system' | 'expand' | 'newton' }
export interface TableDef extends Base { kind: 'table' }
export type FormulaDef = IdentityDef | CalcDef | ToolDef | TableDef;

export const GROUPS: { id: Group; label: string; lead: string }[] = [
  { id: 'identity', label: 'Hằng đẳng thức', lead: 'Nhập a, b (số, phân số như 1/2, hoặc có chữ x như 2x + 1). Ứng dụng thay vào và kiểm tra hai vế có bằng nhau không.' },
  { id: 'trig', label: 'Lượng giác', lead: 'Nhập góc theo đơn vị đang chọn. Mỗi công thức được tính hai vế để bạn đối chiếu.' },
  { id: 'algebra', label: 'Đại số', lead: 'Giải phương trình, giải hệ, khai triển đa thức và nhị thức Newton, có các bước làm.' },
  { id: 'geometry', label: 'Hình học', lead: 'Nhập số đo, nhận chu vi, diện tích, thể tích. Kết quả có π được ghi dạng chính xác.' },
];


const ID = (id: string, name: string, title: string, vars: VarDef[], forms: string[][], keywords: string): IdentityDef =>
  ({ kind: 'identity', group: 'identity', id, name, title, vars, forms, keywords });
const AB: VarDef[] = [{ name: 'a', label: 'Giá trị a', example: '3' }, { name: 'b', label: 'Giá trị b', example: '2' }];

const ang = (name: string, label: string, example: string, exampleRad: string): VarDef => ({ name, label, example, exampleRad, angle: true });
const TA = [ang('a', 'Góc a', '30', 'pi/6')];
const TAB = [ang('a', 'Góc a', '30', 'pi/6'), ang('b', 'Góc b', '45', 'pi/4')];
const TR = (id: string, section: string, name: string, title: string, vars: VarDef[], forms: string[][], keywords: string, titleRad?: string): IdentityDef =>
  ({ kind: 'identity', group: 'trig', id, section, name, title, titleRad, vars, forms, keywords });

const pos = (name: string, label: string, example: string): VarDef => ({ name, label, example, positive: true });
const GEO = (id: string, name: string, title: string, vars: VarDef[], outputs: OutputDef[], keywords: string, validate?: CalcDef['validate']): CalcDef =>
  ({ kind: 'calc', group: 'geometry', id, name, title, vars, outputs, keywords, validate });

export const FORMULAS: FormulaDef[] = [
  // ---------- Hằng đẳng thức ----------
  ID('sq-sum', 'Bình phương của một tổng', '({a} + {b})² = {a}² + 2{a}{b} + {b}²', AB, [['(a+b)^2'], ['a^2', '2*a*b', 'b^2']], 'hang dang thuc binh phuong tong'),
  ID('sq-diff', 'Bình phương của một hiệu', '({a} − {b})² = {a}² − 2{a}{b} + {b}²', AB, [['(a-b)^2'], ['a^2', '-2*a*b', 'b^2']], 'hang dang thuc binh phuong hieu'),
  ID('diff-sq', 'Hiệu hai bình phương', '{a}² − {b}² = ({a} − {b})({a} + {b})', AB, [['a^2', '-b^2'], ['(a-b)*(a+b)']], 'hang dang thuc hieu hai binh phuong'),
  ID('cube-sum', 'Lập phương của một tổng', '({a} + {b})³ = {a}³ + 3{a}²{b} + 3{a}{b}² + {b}³', AB, [['(a+b)^3'], ['a^3', '3*a^2*b', '3*a*b^2', 'b^3']], 'hang dang thuc lap phuong tong'),
  ID('cube-diff', 'Lập phương của một hiệu', '({a} − {b})³ = {a}³ − 3{a}²{b} + 3{a}{b}² − {b}³', AB, [['(a-b)^3'], ['a^3', '-3*a^2*b', '3*a*b^2', '-b^3']], 'hang dang thuc lap phuong hieu'),
  ID('sum-cubes', 'Tổng hai lập phương', '{a}³ + {b}³ = ({a} + {b})({a}² − {a}{b} + {b}²)', AB, [['a^3', 'b^3'], ['(a+b)*(a^2-a*b+b^2)']], 'hang dang thuc tong hai lap phuong'),
  ID('diff-cubes', 'Hiệu hai lập phương', '{a}³ − {b}³ = ({a} − {b})({a}² + {a}{b} + {b}²)', AB, [['a^3', '-b^3'], ['(a-b)*(a^2+a*b+b^2)']], 'hang dang thuc hieu hai lap phuong'),
  ID('sq-trinomial', 'Bình phương của một tổng ba số', '({a} + {b} + {c})² = {a}² + {b}² + {c}² + 2{a}{b} + 2{b}{c} + 2{c}{a}',
    [...AB, { name: 'c', label: 'Giá trị c', example: '1' }],
    [['(a+b+c)^2'], ['a^2', 'b^2', 'c^2', '2*a*b', '2*b*c', '2*c*a']], 'hang dang thuc binh phuong tong ba so mo rong'),

  // ---------- Lượng giác ----------
  { kind: 'table', group: 'trig', id: 'special-angles', section: 'Bảng giá trị', name: 'Giá trị lượng giác của góc đặc biệt', title: 'sin, cos, tan của 0°, 30°, 45°, 60°, 90° …', keywords: 'bang gia tri luong giac goc dac biet 30 45 60 90' },
  TR('t-pythag', 'Quan hệ cơ bản', 'Công thức cơ bản', 'sin²{a} + cos²{a} = 1', TA, [['sin(a)^2', 'cos(a)^2'], ['1']], 'sin cos binh phuong tong bang 1 co ban'),
  TR('t-tan', 'Quan hệ cơ bản', 'Định nghĩa tan', 'tan {a} = sin {a} / cos {a}', TA, [['tan(a)'], ['sin(a)/cos(a)']], 'tan sin cos thuong'),
  TR('t-sec', 'Quan hệ cơ bản', '1 cộng tan bình phương', '1 + tan²{a} = 1 / cos²{a}', TA, [['1', 'tan(a)^2'], ['1/cos(a)^2']], 'tan cos binh phuong 1 cong'),
  TR('t-co-sin', 'Cung liên kết', 'Hai góc phụ nhau (sin)', 'sin(90° − {a}) = cos {a}', TA, [['sin({R}-a)'], ['cos(a)']], 'goc phu nhau sin cos phu', 'sin(π/2 − {a}) = cos {a}'),
  TR('t-co-cos', 'Cung liên kết', 'Hai góc phụ nhau (cos)', 'cos(90° − {a}) = sin {a}', TA, [['cos({R}-a)'], ['sin(a)']], 'goc phu nhau cos sin phu', 'cos(π/2 − {a}) = sin {a}'),
  TR('t-sup-sin', 'Cung liên kết', 'Hai góc bù nhau (sin)', 'sin(180° − {a}) = sin {a}', TA, [['sin({S}-a)'], ['sin(a)']], 'goc bu nhau sin bu', 'sin(π − {a}) = sin {a}'),
  TR('t-sup-cos', 'Cung liên kết', 'Hai góc bù nhau (cos)', 'cos(180° − {a}) = −cos {a}', TA, [['cos({S}-a)'], ['-cos(a)']], 'goc bu nhau cos bu', 'cos(π − {a}) = −cos {a}'),
  TR('t-sin-sum', 'Công thức cộng', 'Sin của một tổng', 'sin({a} + {b}) = sin {a} cos {b} + cos {a} sin {b}', TAB, [['sin(a+b)'], ['sin(a)*cos(b)', 'cos(a)*sin(b)']], 'cong sin tong'),
  TR('t-sin-diff', 'Công thức cộng', 'Sin của một hiệu', 'sin({a} − {b}) = sin {a} cos {b} − cos {a} sin {b}', TAB, [['sin(a-b)'], ['sin(a)*cos(b)', '-cos(a)*sin(b)']], 'cong sin hieu'),
  TR('t-cos-sum', 'Công thức cộng', 'Cos của một tổng', 'cos({a} + {b}) = cos {a} cos {b} − sin {a} sin {b}', TAB, [['cos(a+b)'], ['cos(a)*cos(b)', '-sin(a)*sin(b)']], 'cong cos tong'),
  TR('t-cos-diff', 'Công thức cộng', 'Cos của một hiệu', 'cos({a} − {b}) = cos {a} cos {b} + sin {a} sin {b}', TAB, [['cos(a-b)'], ['cos(a)*cos(b)', 'sin(a)*sin(b)']], 'cong cos hieu'),
  TR('t-tan-sum', 'Công thức cộng', 'Tan của một tổng', 'tan({a} + {b}) = (tan {a} + tan {b}) / (1 − tan {a} tan {b})', TAB, [['tan(a+b)'], ['(tan(a)+tan(b))/(1-tan(a)*tan(b))']], 'cong tan tong'),
  TR('t-sin2', 'Góc nhân đôi, nhân ba, hạ bậc', 'Sin góc nhân đôi', 'sin 2{a} = 2 sin {a} cos {a}', TA, [['sin(2*a)'], ['2*sin(a)*cos(a)']], 'nhan doi sin 2a'),
  TR('t-cos2', 'Góc nhân đôi, nhân ba, hạ bậc', 'Cos góc nhân đôi', 'cos 2{a} = cos²{a} − sin²{a} = 2cos²{a} − 1 = 1 − 2sin²{a}', TA,
    [['cos(2*a)'], ['cos(a)^2', '-sin(a)^2'], ['2*cos(a)^2', '-1'], ['1', '-2*sin(a)^2']], 'nhan doi cos 2a'),
  TR('t-sin3', 'Góc nhân đôi, nhân ba, hạ bậc', 'Sin góc nhân ba', 'sin 3{a} = 3 sin {a} − 4 sin³{a}', TA, [['sin(3*a)'], ['3*sin(a)', '-4*sin(a)^3']], 'nhan ba sin 3a'),
  TR('t-cos3', 'Góc nhân đôi, nhân ba, hạ bậc', 'Cos góc nhân ba', 'cos 3{a} = 4 cos³{a} − 3 cos {a}', TA, [['cos(3*a)'], ['4*cos(a)^3', '-3*cos(a)']], 'nhan ba cos 3a'),
  TR('t-half-sin', 'Góc nhân đôi, nhân ba, hạ bậc', 'Hạ bậc sin', 'sin²{a} = (1 − cos 2{a}) / 2', TA, [['sin(a)^2'], ['1/2', '-cos(2*a)/2']], 'ha bac sin binh phuong'),
  TR('t-half-cos', 'Góc nhân đôi, nhân ba, hạ bậc', 'Hạ bậc cos', 'cos²{a} = (1 + cos 2{a}) / 2', TA, [['cos(a)^2'], ['1/2', 'cos(2*a)/2']], 'ha bac cos binh phuong'),
  TR('t-prod-sc', 'Biến đổi tích thành tổng và ngược lại', 'Tích sin nhân cos', 'sin {a} cos {b} = ½[sin({a} + {b}) + sin({a} − {b})]', TAB, [['sin(a)*cos(b)'], ['sin(a+b)/2', 'sin(a-b)/2']], 'tich thanh tong sin cos'),
  TR('t-prod-cc', 'Biến đổi tích thành tổng và ngược lại', 'Tích cos nhân cos', 'cos {a} cos {b} = ½[cos({a} + {b}) + cos({a} − {b})]', TAB, [['cos(a)*cos(b)'], ['cos(a+b)/2', 'cos(a-b)/2']], 'tich thanh tong cos cos'),
  TR('t-prod-ss', 'Biến đổi tích thành tổng và ngược lại', 'Tích sin nhân sin', 'sin {a} sin {b} = ½[cos({a} − {b}) − cos({a} + {b})]', TAB, [['sin(a)*sin(b)'], ['cos(a-b)/2', '-cos(a+b)/2']], 'tich thanh tong sin sin'),
  TR('t-sum-s', 'Biến đổi tích thành tổng và ngược lại', 'Tổng hai sin thành tích', 'sin {a} + sin {b} = 2 sin(({a} + {b})/2) cos(({a} − {b})/2)', TAB, [['sin(a)', 'sin(b)'], ['2*sin((a+b)/2)*cos((a-b)/2)']], 'tong thanh tich sin'),
  TR('t-sum-c', 'Biến đổi tích thành tổng và ngược lại', 'Tổng hai cos thành tích', 'cos {a} + cos {b} = 2 cos(({a} + {b})/2) cos(({a} − {b})/2)', TAB, [['cos(a)', 'cos(b)'], ['2*cos((a+b)/2)*cos((a-b)/2)']], 'tong thanh tich cos'),

  // ---------- Đại số ----------
  { kind: 'tool', group: 'algebra', id: 'quadratic', tool: 'quadratic', name: 'Giải phương trình bậc hai', title: '{a}x² + {b}x + {c} = 0', keywords: 'phuong trinh bac hai bac 2 delta nghiem vi et parabol' },
  { kind: 'tool', group: 'algebra', id: 'system', tool: 'system', name: 'Giải hệ hai phương trình bậc nhất', title: '{a₁}x + {b₁}y = {c₁}  và  {a₂}x + {b₂}y = {c₂}', keywords: 'he phuong trinh hai an cramer dinh thuc' },
  { kind: 'tool', group: 'algebra', id: 'expand', tool: 'expand', name: 'Khai triển và rút gọn đa thức', title: '(2x + 3)² = 4x² + 12x + 9', keywords: 'khai trien rut gon da thuc bieu thuc dau ngoac' },
  { kind: 'tool', group: 'algebra', id: 'newton', tool: 'newton', name: 'Nhị thức Newton', title: '({a} + {b})ⁿ = Σ C(n, k) {a}ⁿ⁻ᵏ {b}ᵏ', keywords: 'nhi thuc newton tam giac pascal he so khai trien' },

  // ---------- Hình học ----------
  GEO('rect', 'Hình chữ nhật', 'P = 2({a} + {b})   S = {a}{b}', [pos('a', 'Chiều dài', '8'), pos('b', 'Chiều rộng', '5')], [
    { label: 'Chu vi', expr: '2*(a+b)', text: 'P = 2({a} + {b})' },
    { label: 'Diện tích', expr: 'a*b', text: 'S = {a}·{b}' },
    { label: 'Đường chéo', expr: 'sqrt(a^2+b^2)', text: 'd = √({a}² + {b}²)' },
  ], 'hinh chu nhat chu vi dien tich duong cheo'),
  GEO('square', 'Hình vuông', 'P = 4{a}   S = {a}²', [pos('a', 'Cạnh', '6')], [
    { label: 'Chu vi', expr: '4*a', text: 'P = 4{a}' },
    { label: 'Diện tích', expr: 'a^2', text: 'S = {a}²' },
    { label: 'Đường chéo', expr: 'a*sqrt(2)', text: 'd = {a}√2' },
  ], 'hinh vuong chu vi dien tich duong cheo'),
  GEO('triangle', 'Tam giác (đáy và chiều cao)', 'S = ½ {a} {h}', [pos('a', 'Cạnh đáy', '10'), pos('h', 'Chiều cao', '6')], [
    { label: 'Diện tích', expr: 'a*h/2', text: 'S = {a}·{h} / 2' },
  ], 'tam giac dien tich day chieu cao'),
  GEO('heron', 'Tam giác biết ba cạnh (Heron)', 'S = √(p(p − {a})(p − {b})(p − {c})),  p = ({a} + {b} + {c})/2',
    [pos('a', 'Cạnh a', '3'), pos('b', 'Cạnh b', '4'), pos('c', 'Cạnh c', '5')], [
      { label: 'Chu vi', expr: 'a+b+c', text: 'P = {a} + {b} + {c}' },
      { label: 'Nửa chu vi p', expr: '(a+b+c)/2', text: 'p = ({a} + {b} + {c}) / 2' },
      { label: 'Diện tích', expr: 'sqrt(((a+b+c)/2)*((a+b+c)/2-a)*((a+b+c)/2-b)*((a+b+c)/2-c))', text: 'S = √(p(p − {a})(p − {b})(p − {c}))' },
    ], 'tam giac heron ba canh dien tich chu vi nua chu vi',
    (v) => (v.a + v.b > v.c && v.a + v.c > v.b && v.b + v.c > v.a ? null : 'Ba cạnh này không tạo được tam giác: tổng hai cạnh bất kỳ phải lớn hơn cạnh còn lại.')),
  GEO('pyth-hyp', 'Pythagoras: tìm cạnh huyền', 'c² = {a}² + {b}²', [pos('a', 'Cạnh góc vuông a', '3'), pos('b', 'Cạnh góc vuông b', '4')], [
    { label: 'Cạnh huyền', expr: 'sqrt(a^2+b^2)', text: 'c = √({a}² + {b}²)' },
  ], 'pythagoras dinh ly canh huyen tam giac vuong'),
  GEO('pyth-leg', 'Pythagoras: tìm cạnh góc vuông', '{c}² = {a}² + b²', [pos('c', 'Cạnh huyền c', '5'), pos('a', 'Cạnh góc vuông a', '3')], [
    { label: 'Cạnh góc vuông còn lại', expr: 'sqrt(c^2-a^2)', text: 'b = √({c}² − {a}²)' },
  ], 'pythagoras dinh ly canh goc vuong tam giac vuong',
  (v) => (v.c > v.a ? null : 'Cạnh huyền phải dài hơn cạnh góc vuông.')),
  GEO('trapezoid', 'Hình thang', 'S = ({a} + {b}) {h} / 2', [pos('a', 'Đáy lớn', '9'), pos('b', 'Đáy nhỏ', '5'), pos('h', 'Chiều cao', '4')], [
    { label: 'Diện tích', expr: '(a+b)*h/2', text: 'S = ({a} + {b})·{h} / 2' },
  ], 'hinh thang dien tich day chieu cao'),
  GEO('circle', 'Hình tròn', 'C = 2π{r}   S = π{r}²', [pos('r', 'Bán kính', '5')], [
    { label: 'Chu vi', expr: '2*pi*r', text: 'C = 2π{r}', inPi: true },
    { label: 'Diện tích', expr: 'pi*r^2', text: 'S = π{r}²', inPi: true },
  ], 'hinh tron duong tron chu vi dien tich ban kinh pi'),
  GEO('sphere', 'Hình cầu', 'S = 4π{r}²   V = (4/3)π{r}³', [pos('r', 'Bán kính', '3')], [
    { label: 'Diện tích mặt cầu', expr: '4*pi*r^2', text: 'S = 4π{r}²', inPi: true },
    { label: 'Thể tích', expr: '4/3*pi*r^3', text: 'V = (4/3)π{r}³', inPi: true },
  ], 'hinh cau mat cau dien tich the tich ban kinh pi'),
  GEO('cylinder', 'Hình trụ', 'V = π{r}²{h}', [pos('r', 'Bán kính đáy', '3'), pos('h', 'Chiều cao', '5')], [
    { label: 'Diện tích xung quanh', expr: '2*pi*r*h', text: 'Sxq = 2π{r}{h}', inPi: true },
    { label: 'Diện tích toàn phần', expr: '2*pi*r*(r+h)', text: 'Stp = 2π{r}({r} + {h})', inPi: true },
    { label: 'Thể tích', expr: 'pi*r^2*h', text: 'V = π{r}²{h}', inPi: true },
  ], 'hinh tru dien tich xung quanh toan phan the tich pi'),
  GEO('cone', 'Hình nón', 'V = (1/3)π{r}²{h}', [pos('r', 'Bán kính đáy', '3'), pos('h', 'Chiều cao', '4')], [
    { label: 'Đường sinh', expr: 'sqrt(r^2+h^2)', text: 'l = √({r}² + {h}²)' },
    { label: 'Diện tích xung quanh', expr: 'pi*r*sqrt(r^2+h^2)', text: 'Sxq = π{r}·l', inPi: true },
    { label: 'Thể tích', expr: '1/3*pi*r^2*h', text: 'V = (1/3)π{r}²{h}', inPi: true },
  ], 'hinh non duong sinh dien tich xung quanh the tich pi'),
  GEO('cuboid', 'Hình hộp chữ nhật', 'V = {a}{b}{c}', [pos('a', 'Chiều dài', '4'), pos('b', 'Chiều rộng', '3'), pos('c', 'Chiều cao', '12')], [
    { label: 'Thể tích', expr: 'a*b*c', text: 'V = {a}·{b}·{c}' },
    { label: 'Diện tích toàn phần', expr: '2*(a*b+b*c+c*a)', text: 'Stp = 2({a}{b} + {b}{c} + {c}{a})' },
    { label: 'Đường chéo', expr: 'sqrt(a^2+b^2+c^2)', text: 'd = √({a}² + {b}² + {c}²)' },
  ], 'hinh hop chu nhat the tich dien tich toan phan duong cheo'),
  GEO('distance', 'Khoảng cách hai điểm, trung điểm', 'AB = √(({c} − {a})² + ({d} − {b})²)',
    [{ name: 'a', label: 'Điểm A: hoành độ', example: '1' }, { name: 'b', label: 'Điểm A: tung độ', example: '2' },
      { name: 'c', label: 'Điểm B: hoành độ', example: '4' }, { name: 'd', label: 'Điểm B: tung độ', example: '6' }], [
      { label: 'Độ dài AB', expr: 'sqrt((c-a)^2+(d-b)^2)', text: 'AB = √(({c} − {a})² + ({d} − {b})²)' },
      { label: 'Trung điểm M, hoành độ', expr: '(a+c)/2', text: 'xM = ({a} + {c}) / 2' },
      { label: 'Trung điểm M, tung độ', expr: '(b+d)/2', text: 'yM = ({b} + {d}) / 2' },
    ], 'khoang cach hai diem trung diem toa do do dai doan thang'),
];

export const SPECIAL_ANGLES: { deg: number; rad: string; sin: string; cos: string; tan: string; sinE: string; cosE: string; tanE: string | null }[] = [
  { deg: 0, rad: '0', sin: '0', cos: '1', tan: '0', sinE: '0', cosE: '1', tanE: '0' },
  { deg: 30, rad: 'π/6', sin: '1/2', cos: '√3/2', tan: '√3/3', sinE: '1/2', cosE: 'sqrt(3)/2', tanE: 'sqrt(3)/3' },
  { deg: 45, rad: 'π/4', sin: '√2/2', cos: '√2/2', tan: '1', sinE: 'sqrt(2)/2', cosE: 'sqrt(2)/2', tanE: '1' },
  { deg: 60, rad: 'π/3', sin: '√3/2', cos: '1/2', tan: '√3', sinE: 'sqrt(3)/2', cosE: '1/2', tanE: 'sqrt(3)' },
  { deg: 90, rad: 'π/2', sin: '1', cos: '0', tan: 'không xác định', sinE: '1', cosE: '0', tanE: null },
  { deg: 120, rad: '2π/3', sin: '√3/2', cos: '−1/2', tan: '−√3', sinE: 'sqrt(3)/2', cosE: '-1/2', tanE: '-sqrt(3)' },
  { deg: 135, rad: '3π/4', sin: '√2/2', cos: '−√2/2', tan: '−1', sinE: 'sqrt(2)/2', cosE: '-sqrt(2)/2', tanE: '-1' },
  { deg: 150, rad: '5π/6', sin: '1/2', cos: '−√3/2', tan: '−√3/3', sinE: '1/2', cosE: '-sqrt(3)/2', tanE: '-sqrt(3)/3' },
  { deg: 180, rad: 'π', sin: '0', cos: '−1', tan: '0', sinE: '0', cosE: '-1', tanE: '0' },
];

/** Bỏ dấu tiếng Việt và hạ chữ thường, dùng cho tìm kiếm. */
export const fold = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();

export function searchFormulas(query: string, list: FormulaDef[] = FORMULAS): FormulaDef[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return list;
  return list.filter((f) => {
    const hay = fold(`${f.name} ${f.title.replace(/[{}]/g, '')} ${f.keywords}`);
    return terms.every((t) => hay.includes(t));
  });
}
