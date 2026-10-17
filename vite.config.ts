import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' để sau này đóng gói Capacitor/APK chạy được từ file cục bộ.
export default defineConfig({ plugins: [react()], base: './' });
