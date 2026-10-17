import type { CapacitorConfig } from '@capacitor/cli';

// Chạy hoàn toàn offline: giao diện được nhúng sẵn từ thư mục dist (không đặt `server.url`).
// LƯU Ý: appId không nên đổi sau khi đã chạy `npx cap add android`.
const config: CapacitorConfig = {
  appId: 'com.maytinhkhoahoc.app',
  appName: 'Máy tính khoa học',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
