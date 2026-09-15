import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hemu.cricketacademy',
  appName: 'CAM',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  server: {
    url: process.env.CAP_LIVE_RELOAD
      ? `http://${process.env.CAP_LIVE_RELOAD}:5173`
      : 'https://hemu-app-main.vercel.app',
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: [
      'hemu-app-main.vercel.app',
      '*.vercel.app',
      '*.supabase.co',
      '*.google.com',
      '*.googleapis.com',
    ],
  },
};

export default config;
