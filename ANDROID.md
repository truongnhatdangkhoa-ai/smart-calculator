# Build APK Android (Capacitor) trên Windows

Ứng dụng chạy hoàn toàn offline: giao diện được nhúng vào APK, không cần mạng, không cần tài khoản Google/Expo.
Cần mạng một lần để tải thư viện (npm, Gradle) khi build.

## 1. Cài công cụ (một lần)
1. **Node.js 22+**: https://nodejs.org (kiểm tra: `node -v`).
2. **Android Studio** (bản mới, có sẵn JDK 21 bên trong): https://developer.android.com/studio . Mở lần đầu, để nó tải **Android SDK** (Platform 35 trở lên) và Build-Tools.
   Capacitor 7 yêu cầu: Android Studio Ladybug trở lên, JDK 21, Android 6.0+ (API 23) khi chạy.

## 2. Tạo dự án Android (một lần, trong thư mục dự án)
Mở PowerShell trong thư mục `scientific-calculator`:
```
npm install
npm run build
npx cap add android
npm run cap:sync
```
Thư mục `android/` được tạo ra. (`capacitor.config.ts` đã có sẵn: `appId = com.maytinhkhoahoc.app`, `webDir = dist`. Nên chốt appId trước khi chạy `cap add android`.)

## 3. Build APK
**Cách A – Android Studio (dễ nhất)**
1. `npm run cap:open` (mở thư mục `android/` bằng Android Studio), chờ Gradle sync xong.
2. Menu **Build ▸ Build Bundle(s) / APK(s) ▸ Build APK(s)**.
3. Bấm "locate" khi có thông báo. File ở `android\app\build\outputs\apk\debug\app-debug.apk`.

**Cách B – dòng lệnh (Gradle)**
```
npm run apk:debug
```
Nếu báo thiếu JDK/SDK: đặt `JAVA_HOME` = thư mục `jbr` của Android Studio (thường `C:\Program Files\Android\Android Studio\jbr`) và tạo `android\local.properties` với dòng `sdk.dir=C:\\Users\\<tên>\\AppData\\Local\\Android\\Sdk`.

## 4. Cài lên điện thoại
- Chép `app-debug.apk` sang điện thoại, mở file, cho phép "cài từ nguồn không rõ".
- Hoặc bật Gỡ lỗi USB, cắm cáp, rồi trong Android Studio bấm **Run ▸ Run 'app'**.
- APK debug dùng để dùng riêng/thử nghiệm. Muốn đăng Google Play cần APK/AAB đã ký (**Build ▸ Generate Signed Bundle / APK**) – tự tạo keystore, giữ file này an toàn.

## 5. Sau khi sửa mã
```
npm run cap:sync     # build web + chép vào android/
```
rồi build APK lại.

## Lưu ý
- Dữ liệu (lịch sử, bộ nhớ, cài đặt) lưu trong localStorage của WebView, còn sau khi đóng mở app; sẽ mất nếu gỡ app hoặc xóa dữ liệu ứng dụng.
- Cập nhật bản mới: cài đè cùng appId và cùng khóa ký thì dữ liệu được giữ.

## Cách khác: để GitHub tự build APK (không cần cài Android Studio)
1. Up cả dự án (gồm thư mục ẩn `.github`) lên GitHub, nhánh `main`.
2. Vào tab **Actions** của repo, workflow **Build APK** tự chạy (khoảng 5–10 phút lần đầu). Nếu cần chạy tay: Actions ▸ Build APK ▸ Run workflow.
3. Khi xong, tải APK ở mục **Releases** (bên phải trang repo, bản "Bản mới nhất") hoặc ở **Artifacts** cuối trang lần chạy.
4. Mỗi lần push mã mới, APK được build lại và cập nhật tự động.
Nếu repo Private, Releases chỉ bạn xem được. Nếu thất bại, mở lần chạy lỗi, copy dòng đỏ gửi mình.

## Logo / biểu tượng app
Logo tự thiết kế (đường hình sin + trục tọa độ + chấm vàng), vẽ bằng hình học SVG, không dùng ảnh hay phông chữ của ai nên không vướng bản quyền. Nguồn ở `assets/` (`icon-only`, `icon-foreground`, `icon-background`, `splash`, cả .svg lẫn .png).
- GitHub Actions tự tạo icon/splash cho Android từ thư mục này.
- Build trên máy: sau `npx cap add android` chạy `npm run icons` rồi `npm run cap:sync`.
- Muốn đổi logo: sửa các file `.svg`, xuất lại PNG cùng tên (1024×1024; splash 2732×2732).
