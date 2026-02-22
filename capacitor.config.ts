import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tinykings.void',
  appName: 'VOID',
  webDir: 'out',
  server: {
    // Use https scheme so that cookies and secure APIs work correctly inside the WebView
    androidScheme: 'https',
  },
};

export default config;
