import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.frogparkour.game',
  appName: 'Frog Parkour',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
};

export default config;
