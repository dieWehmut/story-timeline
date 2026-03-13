import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN;
  const sentryOrg = env.SENTRY_ORG;
  const sentryProject = env.SENTRY_PROJECT_FRONTEND || env.SENTRY_PROJECT;
  const sentryRelease = env.SENTRY_RELEASE;
  const enableSentry = env.SENTRY_UPLOAD === 'true' && Boolean(sentryAuthToken && sentryOrg && sentryProject);

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
      tailwindcss(),
      ...(enableSentry
        ? [
            sentryVitePlugin({
              authToken: sentryAuthToken,
              org: sentryOrg,
              project: sentryProject,
              release: sentryRelease ? { name: sentryRelease } : undefined,
              telemetry: false,
            }),
          ]
        : []),
    ],
    build: {
      sourcemap: enableSentry,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': ['lucide-react'],
          },
        },
      },
    },
    preview: {
      headers: {
        // index.html must always revalidate
        'Cache-Control': 'no-cache',
      },
    },
  };
});
