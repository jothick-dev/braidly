/**
 * Vercel programmatic config for the Braidly UI.
 *
 * The frontend is static (Vite build from ui/). API requests are reverse-proxied
 * to the Railway backend so `/api/*` stays same-origin in the browser (no CORS).
 * The WebSocket is NOT proxied (Vercel rewrites can't upgrade); the client reads
 * PUBLIC_WS_URL from /api/config and connects to wss://<railway>/ws directly.
 *
 * Requires the env var BACKEND_URL (Vercel project settings, e.g.
 * https://braidly-api.up.railway.app). vercel.ts runs at build time, so the
 * value is baked in per deployment — change it there and redeploy the UI.
 */
import { routes, deploymentEnv, type VercelConfig } from '@vercel/config/v1'

const backend = deploymentEnv('BACKEND_URL')

export const config: VercelConfig = {
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  framework: 'vite',
  rewrites: [
    // Proxy API calls to the Railway backend (same-origin from the browser's view).
    routes.rewrite('/api/:path*', `${backend}/:path*`),
    // SPA fallback: everything else serves the React app (client-side routing).
    routes.rewrite('/((?!api/).*)', '/index.html'),
  ],
  headers: [
    // Hashed Vite assets are immutable.
    routes.cacheControl('/assets/(.*)', { public: true, maxAge: '1y', immutable: true }),
  ],
}
