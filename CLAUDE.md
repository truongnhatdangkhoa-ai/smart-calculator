# CLAUDE.md – Scientific Calculator (Máy tính khoa học)

Giao diện tiếng Việt, React + Vite + TypeScript, chạy offline, sau cùng đóng gói APK bằng Capacitor.
Người dùng không phải lập trình viên: viết mã đầy đủ, chạy được, có hướng dẫn lệnh. Không chỉ đưa kế hoạch.

## Quy tắc chung (luôn áp dụng)
- Tách bộ máy tính (`src/engine/`) khỏi giao diện. Không dùng `eval()`/`Function`; chỉ parser an toàn, danh sách trắng ký tự/hàm.
- Phân biệt lỗi cú pháp / miền xác định / vượt giới hạn; thông báo tiếng Việt dễ hiểu. Giới hạn độ dài, độ sâu, số bước.
- Không làm tròn giá trị nội bộ; chỉ làm tròn khi hiển thị. Nêu rõ khi kết quả gần đúng (≈).
- Không có nút giả hoặc tính năng chưa hoạt động mà đánh dấu hoàn thành.
- Kiểm thử số thực dùng dung sai. KHÔNG tuyên bố test đạt nếu chưa chạy thật (`npm test`).
- Chỉ sửa phần cần sửa, không tạo lại toàn bộ dự án, không xóa/ghi đè dự án khác.
- Nút đủ lớn trên điện thoại, không tràn/che khuất, hỗ trợ bàn phím vật lý, điều hướng Tab, sáng/tối.

## Quy trình làm việc theo giai đoạn
1. Làm giai đoạn đầu tiên còn lại trong file này (từ trên xuống).
2. Chạy `npm test` và `npm run typecheck` (và `npm run build` nếu có mạng); sửa lỗi đến khi đạt.
3. Báo cáo: file đã tạo/sửa, chức năng hoàn thành, kiểm thử đã chạy + kết quả, lỗi còn tồn tại, lệnh chạy.
4. **Xóa toàn bộ mục giai đoạn vừa xong khỏi file này** (cả tiêu đề), cập nhật "Trạng thái" bên dưới.
5. Làm tiếp giai đoạn kế tiếp. Khi hết giai đoạn, thực hiện mục "Bàn giao" rồi xóa luôn mục đó.

## Trạng thái
- Đã xong: Giai đoạn A (máy tính cơ bản), B (lượng giác, logarit/mũ, phân số chính xác, số học, thừa số), C (tổ hợp/xác suất, bộ nhớ, lịch sử, cài đặt), D (kiểm thử tổng thể, bố cục, bàn phím, tương phản), E (đồ thị y=f(x)). 79 test đạt (`npm test`).
- Giao diện React đã được bundle bằng esbuild và chạy thử trong Chromium ở độ rộng 360px (tổ hợp, MS/MR, lịch sử, tìm kiếm, cài đặt, tải lại trang, xóa có xác nhận): không lỗi JS, không tràn ngang. Vẫn cần `npm install` + `npm run typecheck` + `npm run dev` trên máy có mạng (môi trường tạo ra chưa cài được @types/react/vite). Phần không phải React đã typecheck sạch bằng `tsc` toàn cục.
- Quy ước đã chốt: `%` kiểu Casio khi cộng/trừ (200+10% = 220), còn lại ÷100. `mod` cùng dấu với số chia (mod(-7,3)=2). `frac(x)=x−⌊x⌋`. `round` làm tròn xa số 0. Góc mặc định DEG.
- Giai đoạn C: `nPr(n,k)`, `nCr(n,k)` (alias `perm`, `comb`; 0 ≤ k ≤ n, nguyên, n ≤ 1000, tính BigInt), `prob(m,n)` (m/n, 0 ≤ m ≤ n, n ≥ 1), `binom(n,k,p)`. `M` là hằng bộ nhớ trong biểu thức (MR chèn `M`). Biểu thức/kết quả bên trong luôn dùng "." và ","; dấu thập phân "," chỉ đổi khi hiển thị (đối số hiển thị là ";"). Lưu bền vững một khóa localStorage `sci-calc:v1` (`storage.ts`; phân số lưu dạng "n/d"); lịch sử tối đa 200 bản ghi. Số chữ số thập phân cố định áp dụng cả số nguyên (5 → 5.00).
- Giai đoạn D: đã thêm `phaseD.test.ts` (chia 0, log/căn/arcsin ngoài miền, cú pháp sai, quá dài/quá sâu/tràn, fuzz 3000 chuỗi không ném lỗi, DEG/RAD, sửa lỗi rồi tính tiếp). Đã kiểm tra trên Chromium ở 360×740, 320×568, 360×640: không tràn ngang, mọi nút ≥ 36px; bàn phím vật lý (số, + − * / ^ ! ( ) , ; Enter, Backspace, Esc) và Tab đều chạy; gõ trong ô tìm kiếm không lọt vào biểu thức; Esc đóng Lịch sử/Cài đặt. Tương phản chữ/nền tính theo WCAG đều ≥ 4,5:1 ở cả sáng và tối. Không phát hiện lỗi chức năng cần sửa; chỉ chỉnh chip tiêu đề không xuống dòng ở màn hình hẹp.
- Giai đoạn E: `compile(src)` (engine) trả hàm f(x), NaN tại điểm không xác định; `x` chỉ dùng được trong đồ thị (ở máy tính thường báo lỗi rõ). `graph.ts` (khung nhìn, thu phóng/di chuyển có giới hạn 1e-9..1e9, lưới 1-2-5, lấy mẫu ≤ 2000 điểm, phát hiện vùng không xác định và nhảy đổi dấu, tự chọn y) + `GraphPanel.tsx` (canvas: kéo, cuộn chuột, chụm 2 ngón, chạm để xem tọa độ gần đúng, phím mũi tên và +/− khi focus canvas). Đồ thị có nút góc riêng, mặc định RAD (độc lập với DEG/RAD của máy tính). Nhập `x*sin(x)` (không viết liền `xsin(x)`); `2x`, `3(x+1)` được. Đã thử trên Chromium 360px: vẽ, 1/x, ln, tan, lỗi cú pháp, ô khoảng nhập biểu thức (vd `-2*pi`), tối/sáng, không lỗi JS, không tràn ngang.
- Giai đoạn F (một phần): đã thêm `capacitor.config.ts` (appId `com.maytinhkhoahoc.app`, webDir `dist`, không có server.url → offline), dependency Capacitor 7 trong package.json, script `cap:add`/`cap:sync`/`cap:open`/`apk:debug`, `.gitignore`, `ANDROID.md` (hướng dẫn Windows). CHƯA chạy `cap add android`/build APK vì môi trường không tải được npm và không có Android SDK; 73 test vẫn đạt.
- Sau giai đoạn F: thêm sao lưu/khôi phục lịch sử (`exportHistory`, `parseHistoryImport`, `mergeHistory` trong storage.ts; action `historySet`; nút trong panel Lịch sử; test `phaseF.test.ts`) và `BAN_GIAO.md` (đủ 7 mục bàn giao). Mục 4 (APK) cần xác nhận trên máy thật.
- Chưa làm (để sau): số phức, hằng số khoa học (chưa có nguồn xác thực trong môi trường này), hiển thị số mũ/phân số dạng đẹp, biểu tượng/ảnh khởi động riêng cho APK.

---

## Giai đoạn F – còn lại (chưa chạy được trong môi trường tạo ra: chặn npm, không có Android SDK)
- Trên máy có mạng: `npm install` (đã khai báo sẵn @capacitor/core, cli, android ^7), `npm run build`, `npx cap add android`, `npm run cap:sync`, build APK theo `ANDROID.md`.
- Kiểm tra thực tế: `android/` được tạo, APK cài và chạy offline trên điện thoại. Sau đó xóa mục này.

## Bàn giao (sau Giai đoạn F)
1. Mã nguồn đầy đủ + cấu trúc thư mục. 2. Hướng dẫn chạy trên Chrome. 3. Hướng dẫn build APK. 4. Kết quả kiểm thử thực tế.
5. Danh sách chức năng hoàn thành. 6. Danh sách giới hạn còn tồn tại. 7. Hướng dẫn sao lưu dữ liệu lịch sử.
