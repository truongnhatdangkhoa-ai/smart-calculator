# Bàn giao – Máy tính khoa học

## 1. Cấu trúc thư mục
```
scientific-calculator/
  src/engine/        bộ máy tính toán (evaluate, exact, numtheory, combinatorics, format, errors) + test
  src/calculatorState.ts   logic phím bấm, hoàn tác, Ans, lịch sử (thuần, có test)
  src/graph.ts, GraphPanel.tsx   đồ thị y=f(x)
  src/storage.ts     lưu bền vững + sao lưu/khôi phục lịch sử
  src/App.tsx, styles.css, main.tsx   giao diện React
  capacitor.config.ts, ANDROID.md    đóng gói Android
```
## 2. Chạy trên Chrome
`npm install` rồi `npm run dev`, mở http://localhost:5173 (xem README.md).
## 3. Build APK
Xem `ANDROID.md` (Windows, Android Studio/Gradle, offline).
## 4. Kết quả kiểm thử thực tế (môi trường tạo ra)
- `npm test`: 79/79 đạt (bộ máy, nhập liệu, lưu trữ, đồ thị, lỗi/biên, sao lưu lịch sử).
- Giao diện đã chạy thử trên Chromium 360px ở giai đoạn D/E. Phần sao lưu lịch sử (nút mới) mới được kiểm thử phần logic, chưa thử bằng trình duyệt.
- CHƯA chạy được: `npm run typecheck`/`build` đầy đủ, `cap add android`, build và cài APK (môi trường không tải được npm, không có Android SDK). Cần chạy trên máy của bạn.
## 5. Chức năng hoàn thành
Tính cơ bản, % kiểu Casio, ngoặc, Ans, hoàn tác; lượng giác DEG/RAD, hyperbolic, logarit/mũ, căn, giai thừa; phân số chính xác (BigInt) và ⇄ thập phân; gcd/lcm/mod, nguyên tố/thừa số; nPr/nCr/prob/binom; bộ nhớ MC/MR/M+/M−/MS; lịch sử (tìm, dùng lại, sao chép, xóa); cài đặt (chữ số thập phân, dấu , hoặc ., sáng/tối, DEG/RAD); đồ thị y=f(x) (kéo, thu phóng, chạm xem tọa độ); lưu bền vững; sao lưu/khôi phục lịch sử; cấu hình Capacitor.
## 6. Giới hạn còn tồn tại
- Chưa có số phức, hằng số khoa học, hiển thị số mũ/phân số dạng đẹp.
- Đồ thị chỉ lấy mẫu điểm nên có thể bỏ sót hoặc báo thừa gián đoạn/tiệm cận; chỉ y=f(x).
- Phân số chính xác chỉ khi biểu thức hoàn toàn hữu tỉ; kết quả khác là số thực gần đúng (≈, 12 chữ số có nghĩa).
- Trong APK, nút "Lưu file sao lưu" (tải file qua WebView) có thể không hoạt động trên một số máy; dùng "Sao chép sao lưu". Chưa thử trên thiết bị thật.
- Chưa có biểu tượng/ảnh khởi động riêng (dùng mặc định của Capacitor).
## 7. Sao lưu dữ liệu lịch sử
Mở "Lịch sử":
- **Lưu file sao lưu**: tải `lich-su-may-tinh-<ngày>.json`.
- **Sao chép sao lưu**: chép nội dung JSON vào clipboard, dán vào ghi chú/email để giữ.
- **Nhập từ file** hoặc **Dán sao lưu**: khôi phục. Bản ghi được gộp vào lịch sử hiện có, bỏ trùng, mới nhất trước, tối đa 200; file sai định dạng bị từ chối, bản ghi lỗi bị bỏ qua và báo số lượng.
Bộ nhớ M và cài đặt không nằm trong file sao lưu. Dữ liệu mất khi gỡ app hoặc xóa dữ liệu ứng dụng, nên nên sao lưu trước.
