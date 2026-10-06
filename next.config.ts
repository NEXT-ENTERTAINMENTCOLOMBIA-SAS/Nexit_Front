import type { NextConfig } from "next";
import path from "path";

/**
 * Cabeceras de seguridad para lo que carga el navegador (HTML/JS/CSS). Esto
 * complementa a Nexit_Back/src/Nexit.API/Middleware/SecurityHeadersMiddleware.cs,
 * que protege las respuestas JSON de la API pero no el frontend en sí.
 *
 * CSP sin nonces, a propósito: todas las páginas de esta app son estáticas
 * (ver la salida de `next build`), y un CSP con nonces obliga a que Next.js
 * renderice cada página dinámicamente en cada request (ver
 * node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
 * sección "Static vs Dynamic Rendering with CSP") -- perderíamos esa
 * optimización sin necesidad real, ya que esta app no carga scripts de
 * terceros que haya que aislar uno por uno (sin analytics, sin ads, sin
 * widgets externos). 'unsafe-inline' en script/style-src es el approach
 * "Without Nonces" documentado ahí mismo para este caso.
 */
const isDev = process.env.NODE_ENV === "development";

// connect-src tiene que listar explícitamente el backend y Supabase -- si no,
// el navegador bloquea el fetch()/XHR hacia ellos aunque el backend responda
// bien. NEXT_PUBLIC_API_BASE_URL cambia entre entornos (localhost en dev, el
// dominio real en producción), así que se lee del mismo .env que usa el resto
// del frontend en vez de quedar hardcodeado.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5031";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Monitoreo de errores (Sentry): solo si hay DSN se permite enviar a su servidor de ingesta.
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
let sentryOrigin = "";
try {
  sentryOrigin = sentryDsn ? new URL(sentryDsn).origin : "";
} catch {
  sentryOrigin = "";
}

const connectSrc = ["'self'", apiBaseUrl, supabaseUrl, sentryOrigin].filter(Boolean).join(" ");

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src ${connectSrc};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`;
// upgrade-insecure-requests solo en producción: en dev el backend corre a
// propósito sobre http://localhost (docs/README del backend), y ese
// directiva forzaría al navegador a intentar https:// ahí y romper todas las
// peticiones a la API en desarrollo.

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader.replace(/\s{2,}/g, " ").trim() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Redundante con frame-ancestors del CSP de arriba, pero se deja para
  // navegadores viejos que todavía no soportan frame-ancestors (docs de
  // Next.js, sección X-Frame-Options: "superseded by CSP's frame-ancestors").
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Ignorado por el navegador si la respuesta no llegó por HTTPS (RFC 6797),
  // así que no rompe nada corriendo en local sobre http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // No anunciar "X-Powered-By: Next.js" -- información gratis de menos para
  // quien esté reconociendo el sitio antes de un ataque.
  poweredByHeader: false,
  // Pin the workspace root explicitly. Without this, Next/Turbopack can
  // mis-infer the project root when there's another package.json/lockfile
  // higher up the folder tree (e.g. in Documents/Github), which breaks the
  // build with "Next.js inferred your workspace root, but it may not be
  // correct".
  turbopack: {
    root: path.join(__dirname),
  },
  // /informe desapareció (2026-10-05): lo reemplaza /project-managers. Redirige los enlaces guardados.
  async redirects() {
    return [{ source: "/informe", destination: "/project-managers", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
