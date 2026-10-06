"use client";

import { useEffect } from "react";
import { reportarError } from "@/lib/monitoring";
import { AlertTriangle } from "lucide-react";
import "@/styles/globals.css";
import { NexitWordmark } from "@/components/ui/Logo";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Última red de seguridad: solo se activa si el ROOT layout.tsx en sí
 * revienta (por ejemplo, un error al montar <Toaster />), algo que ningún
 * otro error.tsx puede atrapar porque todos viven DENTRO del layout raíz.
 * Por eso reemplaza <html>/<body> por completo -- no puede depender del
 * layout que acaba de fallar, así que aquí se fija a mano un font-family
 * de respaldo en vez de confiar en la variable --font-archivo (que la
 * pone next/font en el <html> del layout raíz, que en este caso no llegó
 * a renderizarse). Solo corre en producción -- en desarrollo Next.js
 * muestra su propio overlay de error primero.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Nexit] Error crítico (root layout):", error);
    reportarError(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "Helvetica, Arial, sans-serif" }}>
        <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
          <div className="mb-10">
            <NexitWordmark height={22} />
          </div>

          <ErrorState
            tone="danger"
            icon={AlertTriangle}
            eyebrow="Algo salió mal"
            title="La aplicación no pudo iniciar"
            description="Ocurrió un error crítico inesperado. Intenta recargar la página; si el problema sigue, contacta a soporte."
            primaryAction={{ label: "Reintentar", onClick: reset }}
            digest={error.digest}
          />
        </div>
      </body>
    </html>
  );
}
