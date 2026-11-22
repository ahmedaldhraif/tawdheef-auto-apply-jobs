/** The private tracker is never embeddable. Only the public, closed demo is. */
export const DEMO_CSP = "default-src 'self'; connect-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'";
const NATIVE_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
export function contentSecurityPolicy(path) {
  const demo = path === '/demo/' || path === '/demo/index.html' || /^\/demo\/assets\/[a-zA-Z0-9_.-]+\.(?:js|css)$/.test(path);
  return demo ? DEMO_CSP : NATIVE_CSP;
}
