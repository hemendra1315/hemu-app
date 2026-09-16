import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hemu.cricketacademy',
  appName: 'CAM',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  server: process.env.CAP_LIVE_RELOAD
    ? {
        url: `http://${process.env.CAP_LIVE_RELOAD}:5173`,
        cleartext: true,
      }
    : {
        androidScheme: 'https',
      },
};

export default config;
