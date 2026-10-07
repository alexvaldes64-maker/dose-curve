// One Content Security Policy, used by both the build (meta tag) and Vercel (HTTP header).
// connect-src 'self' is the key line: the browser refuses any fetch, XHR, beacon or
// WebSocket to another origin, so app data cannot be sent anywhere even by mistake.
export const CSP = [
  "default-src 'self'",
  "connect-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')
