"use client";

import type { MouseEvent, ReactNode } from "react";

/**
 * Vista de tabla para las listas de Clientes/Proyectos/Proveedores -- ported
 * 2026-09-03 del mockup aprobado (Claude Diseño), que en las tres pantallas
 * ofrece un switch "Tarjetas / Tabla" (ver TabsShell/TabButton en
 * primitives.tsx) junto a esta vista alterna de solo lectura con acciones
 * rápidas de editar/eliminar por fila.
 */
/** `footer` aloja la barra de paginación (ver `Pagination` en primitives.tsx)
 * -- fondo `#FBFAF7` y borde superior, tal como el pie de tabla del mockup. */
export function Table({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-[13px]">{children}</table>
      </div>
      {footer && <div className="border-t border-border bg-soft px-4 py-3">{footer}</div>}
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border bg-bg text-left font-mono text-[10px] font-medium uppercase tracking-[0.11em] text-text-2">
        {children}
      </tr>
    </thead>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-[11px] font-medium ${className ?? ""}`}>{children}</th>;
}

export function Tr({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-divider last:border-b-0 ${onClick ? "cursor-pointer hover:bg-soft" : ""}`}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className ?? ""}`}>{children}</td>;
}

/**
 * Botón de acción rápida por fila (editar / eliminar) -- 30x30 con borde,
 * el editar se invierte a negro+verde al pasar el mouse y el eliminar a rojo,
 * tal como en el mockup aprobado.
 */
export function RowAction({
  label,
  tone = "neutral",
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  tone?: "neutral" | "danger";
  /** Para acciones que existen pero no aplican a ESTA fila (p. ej. eliminar la propia cuenta):
   *  se ve apagada en vez de dejar hacer clic y recibir un error del backend. */
  disabled?: boolean;
  onClick: (e: MouseEvent) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-transparent text-text-2 transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : tone === "danger"
            ? "cursor-pointer hover:border-red hover:bg-red-light hover:text-red"
            : "cursor-pointer hover:border-text hover:bg-ink hover:text-green"
      }`}
    >
      {children}
    </button>
  );
}
