# Máy tính khoa học (Scientific Calculator)

Giai đoạn A–E: máy tính cơ bản, lượng giác, logarit, phân số, số học, tổ hợp/xác suất, bộ nhớ, lịch sử, cài đặt. Cần Node.js 22+ (https://nodejs.org).

## Chạy trên Chrome
```
npm install
npm run dev        # mở địa chỉ hiện ra (thường http://localhost:5173)
```
## Kiểm thử
```
npm test           # chạy bộ máy tính toán + logic nhập liệu (không cần npm install)
npm run typecheck  # kiểm tra kiểu TypeScript (cần npm install)
npm run build      # build bản web vào thư mục dist
```
## Cấu trúc
- `src/engine/` bộ máy tính toán (tách khỏi giao diện): `evaluate.ts` (số thực), `exact.ts` (phân số chính xác BigInt), `numtheory.ts` (nguyên tố/thừa số), `format.ts`, `errors.ts`
- `src/calculatorState.ts` logic phím bấm, hoàn tác, Ans (thuần, có test)
- `src/graph.ts` logic đồ thị (khung nhìn, lưới, lấy mẫu, phát hiện gián đoạn); `src/GraphPanel.tsx` giao diện đồ thị
- `src/storage.ts` lưu/đọc bộ nhớ, lịch sử, cài đặt (localStorage, chịu được dữ liệu hỏng)
- `src/App.tsx`, `src/styles.css` giao diện React

## Quy ước hiện tại
- `%`: 50% = 0.5; 200×10% = 20; khi cộng/trừ tính theo số đứng trước: 200+10% = 220, 200−10% = 180.
- Góc mặc định DEG; bấm DEG/RAD để đổi. `sin(30)=0.5` (DEG), `sin(π/6)=0.5` (RAD). `tan(90)` báo lỗi.
- Hàm: sin cos tan, asin acos atan (arcsin...), sinh cosh tanh, asinh acosh atanh, log (cơ số 10, cũng log10), ln, log2, `logb(cơ số, x)`, exp, gcd, lcm, mod, floor, ceil, round, frac.
- Phân số: gõ `12/18` rồi `=` được `2/3`; số thập phân hữu hạn `0.75` được `3/4`; nút ⇄ (tab Số học) đổi giữa phân số và thập phân. Kết quả được ghi nhãn: Số nguyên / Phân số chính xác / Số thực (gần đúng).
- Số nguyên 2..10¹² có thêm dòng nguyên tố/phân tích thừa số.
- `mod(-7,3)=2` (cùng dấu số chia); `frac(-1.25)=0.75`; `round(-2.5)=-3`.
- Nhân ngầm: `2π`, `3(4+1)`; `-2^2 = -4`; `2^3^2 = 512`.
- Căn bậc n: `root(n, x)`; `√81`, `sqrt(81)`, `cbrt(x)`, `abs(x)`, `x!` (0–170).
- Dấu "≈" xuất hiện khi kết quả bị cắt ở 12 chữ số có nghĩa. Phân số chính xác chỉ tính được khi biểu thức hoàn toàn hữu tỉ; sin, log, π, √2... luôn là số thực gần đúng.

## Giai đoạn C: tổ hợp, bộ nhớ, lịch sử, cài đặt
- Tab "Tổ hợp": `nPr(n,k)` chỉnh hợp, `nCr(n,k)` tổ hợp, `n!` hoán vị, `prob(m,n)` xác suất cổ điển (m trường hợp thuận lợi / n), `binom(n,k,p)` xác suất nhị thức. Yêu cầu n, k nguyên, 0 ≤ k ≤ n, n ≤ 1000. Kết quả nguyên tính chính xác (ví dụ `nCr(60,30)`).
- Bộ nhớ: MC, MR (chèn `M` vào biểu thức), M+, M− (cộng/trừ kết quả vừa tính hoặc giá trị biểu thức đang gõ), MS. Chữ "M" sáng trên màn hình khi có dữ liệu. Giữ phân số chính xác.
- Lịch sử (nút "Lịch sử"): tự lưu biểu thức, kết quả, thời gian (tối đa 200); dùng lại biểu thức, dùng kết quả, sao chép, tìm kiếm, xóa từng mục, xóa tất cả (có xác nhận).
- Cài đặt: số chữ số thập phân (tự động hoặc 0–10), dấu thập phân `.` hoặc `,` (khi dùng `,` thì dấu ngăn đối số hiển thị là `;`), sáng/tối/theo hệ thống, DEG/RAD.
- Tất cả được lưu trên thiết bị và còn sau khi đóng mở lại.

## Giai đoạn E: đồ thị hàm số
- Bấm "Đồ thị", nhập `y = f(x)` (ví dụ `x^2 - 3x + 1`, `sin(x)`, `1/x`, `ln(x)`), bấm "Vẽ". Biến là `x`; viết `x*sin(x)`, không viết liền `xsin(x)`.
- Khoảng x/y đặt bằng bốn ô số (nhập được cả biểu thức như `-2*pi`) hoặc kéo để di chuyển, cuộn chuột / chụm hai ngón / nút ＋ － để thu phóng, "Tự động y" để chọn khoảng y, "Đặt lại" về −10..10.
- Chạm hoặc bấm vào đồ thị để xem tọa độ gần đúng. Khi canvas đang focus: phím mũi tên di chuyển, + và − thu phóng.
- Vùng không xác định và nghi gián đoạn/tiệm cận chỉ được báo dựa trên lấy mẫu điểm nên có thể bỏ sót hoặc báo thừa.
- Nút "Góc: RAD/DEG" của đồ thị độc lập với DEG/RAD của máy tính (mặc định radian).

## Giai đoạn F: đóng gói Android
Xem `ANDROID.md` (Capacitor, build APK trên Windows, chạy offline). Cấu hình: `capacitor.config.ts`.

## Sao lưu lịch sử và bàn giao
Panel Lịch sử có "Lưu file sao lưu / Sao chép sao lưu / Nhập từ file / Dán sao lưu". Xem `BAN_GIAO.md`.

## Giao diện mới và thư viện công thức
- Thanh dưới: Máy tính, Công thức, Đồ thị, Lịch sử. Cài đặt ở biểu tượng góc trên phải.
- Tab Công thức: tìm không dấu (ví dụ "binh phuong"), nhóm Hằng đẳng thức, Lượng giác, Đại số, Hình học. Mở một thẻ, nhập số, kết quả hiện ngay kèm các bước.
- Hằng đẳng thức: nhập số/phân số để kiểm tra hai vế; nhập chữ x (ví dụ a = 2x, b = 3) để khai triển chính xác theo x (một biến).
- Lượng giác tính bằng số thực, sai khác dưới 1e-9 coi là bằng nhau và có ghi rõ. Hình học: kết quả có π ghi dạng chính xác (25π) kèm giá trị gần đúng.
- Mã: `src/algebra/` (số hữu tỉ, đa thức, giải phương trình), `src/formulas/` (danh mục và bộ tính), kiểm thử trong `algebra.test.ts`, `formulas.test.ts`.
