import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gamehub.app',
  appName: 'GameHub',
  webDir: 'out',
  server: {
    // Under development, point server.url to the Next.js dev server URL.
    // For production, this should point to your hosted Next.js production domain.
    url: process.env.CAPACITOR_SERVER_URL || 'http://10.0.2.2:3000',
    cleartext: true,
    allowNavigation: ['*']
  }
};

export default config;
