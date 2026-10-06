/**
 * Monitoreo de errores (2026-10-05). Solo se activa si existe NEXT_PUBLIC_SENTRY_DSN; sin esa variable
 * no se descarga ni se ejecuta nada de Sentry. No envía datos personales ni grabaciones de pantalla.
 */
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
let iniciado: Promise<typeof import("@sentry/browser") | null> | null = null;

function cargar() {
  if (!DSN || typeof window === "undefined") return Promise.resolve(null);
  iniciado ??= import("@sentry/browser")
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
        tracesSampleRate: 0,
      });
      return Sentry;
    })
    .catch(() => null);
  return iniciado;
}

export function iniciarMonitoreo() {
  void cargar();
}

export function reportarError(error: unknown) {
  void cargar().then((Sentry) => Sentry?.captureException(error));
}
