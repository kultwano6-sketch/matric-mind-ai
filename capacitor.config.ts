import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.matricmind.ai',
  appName: 'MatricMind AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://matric-mind-ai-production.up.railway.app',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 4000,
      backgroundColor: '#1e3a5f',
      showSpinner: true,
      spinnerColor: '#f59e0b',
    },
  },
};

export default config;