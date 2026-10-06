"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { NexitWordmark } from "@/components/ui/Logo";
import { ErrorState } from "@/components/ui/ErrorState";
import { reportarError } from "@/lib/monitoring";

/**
 * Red de seguridad del segmento raíz -- atrapa errores no controlados en
 * "/" y en "/login" (ninguna de las dos tiene su propio error.tsx), y
 * también cualquier error que reviente dentro de (dashboard)/layout.tsx,
 * ya que un error.tsx no puede atrapar errores de SU PROPIO layout, solo
 * de un segmento padre -- por eso este es el que realmente lo cubre.
 * (dashboard)/error.tsx sigue siendo el que se ve normalmente para errores
 * dentro de una página del panel, porque ese sí mantiene el layout/rail.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El mensaje real se recorta en producción por seguridad -- lo único
    // fiable para diagnosticar es el digest, que sí queda en los logs del
    // servidor.
    console.error("[Nexit] Error no controlado:", error);
    reportarError(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      <div className="mb-10">
        <NexitWordmark height={22} />
      </div>

      <ErrorState
        tone="danger"
        icon={AlertTriangle}
        eyebrow="Algo salió mal"
        title="No se pudo cargar la página"
        description="Ocurrió un error inesperado. Puedes intentar de nuevo, o volver al inicio si el problema persiste."
        primaryAction={{ label: "Reintentar", onClick: reset }}
        secondaryAction={{ label: "Volver al inicio", href: "/" }}
        digest={error.digest}
      />
    </div>
  );
}
