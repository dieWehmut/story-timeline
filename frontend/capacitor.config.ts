import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.storytimeline.app',
  appName: '物語集',

  webDir: 'dist',

  server: {
    androidScheme: 'https',
    url: 'https://REDACTED.example.com',
    cleartext: false,
    allowNavigation: [
      "story-timeline.hc-dsw-nexus.me",
      "github.com",
      "api.github.com",
      "accounts.google.com",
      "*.google.com",
      "*.googleusercontent.com"
    ]
  }
};

export default config;