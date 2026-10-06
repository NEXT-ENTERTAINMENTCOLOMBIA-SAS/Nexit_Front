"use client";

import { reportarError } from "@/lib/monitoring";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Error dentro de una vista del panel (Clientes, Proyectos, etc.) -- vive
 * dentro de (dashboard)/layout.tsx, así que el rail/menú móvil se quedan
 * visibles y la persona puede navegar a otra sección aunque esta haya
 * fallado. No necesita "volver al inicio" porque ya está dentro de la app.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Nexit] Error en el panel:", error);
    reportarError(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ErrorState
        tone="danger"
        icon={AlertTriangle}
        eyebrow="Algo salió mal"
        title="No se pudo cargar esta sección"
        description="Ocurrió un error inesperado al mostrar esta vista. Puedes intentar de nuevo o moverte a otra sección desde el menú."
        primaryAction={{ label: "Reintentar", onClick: reset }}
        digest={error.digest}
      />
    </div>
  );
}
