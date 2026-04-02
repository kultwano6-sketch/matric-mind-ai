import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.matricmind.ai',
  appName: 'MatricMind',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://matric-mind-ai-production.up.railway.app',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e3a5f',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1e3a5f',
    },
  },
};

export default config;