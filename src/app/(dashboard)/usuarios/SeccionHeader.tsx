"use client";

import type { ReactNode } from "react";
import type { Users } from "lucide-react";

/**
 * Encabezado de las dos secciones de abajo. Existe para que "Invitaciones pendientes" y
 * "Solicitudes de eliminación" se lean como dos bloques hermanos con el mismo peso -- antes uno
 * era un título con un botón al lado y el otro un texto suelto, y la pantalla parecía tres cosas
 * distintas pegadas en vez de una.
 */
export function SeccionHeader({
  icon: Icon,
  titulo,
  descripcion,
  conteo,
  accion,
}: {
  icon: typeof Users;
  titulo: string;
  /** Solo cuando el título y las columnas de abajo no bastan para decir de qué se trata la sección. */
  descripcion?: string;
  conteo?: number;
  accion?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-text-2">
          <Icon size={15} strokeWidth={1.8} />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold leading-tight">{titulo}</h2>
            {conteo !== undefined && conteo > 0 && (
              <span className="rounded-[20px] bg-text px-[7px] py-[2px] font-mono text-[10px] font-medium text-green">
                {conteo}
              </span>
            )}
          </div>
          {descripcion && <div className="mt-0.5 text-[12px] text-text-3">{descripcion}</div>}
        </div>
      </div>
      {accion}
    </div>
  );
}
