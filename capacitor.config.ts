import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hemu.cricketacademy',
  appName: 'CAM',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

// Enable live reload during development if the CAP_LIVE_RELOAD env var is set.
if (process.env.CAP_LIVE_RELOAD) {
  config.server = {
    url: `http://${process.env.CAP_LIVE_RELOAD}:5173`,
    cleartext: true,
  };
}

export default config;
