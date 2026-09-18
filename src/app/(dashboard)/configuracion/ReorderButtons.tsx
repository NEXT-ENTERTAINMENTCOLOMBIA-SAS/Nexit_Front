"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Flechas para mover una fila un puesto arriba/abajo dentro de su lista -- reemplaza el campo
 * "Orden" que antes había que escribir a mano en Estados de proyecto y Etapas de cliente (Alicia
 * 2026-09-10: "mejorar el diseño... que sea flexible y uno pueda trabajar superfácil y rápido").
 * Escribir un número y arriesgarse a repetirlo con el de al lado no es rápido ni fácil -- un botón
 * que intercambia el orden con el vecino y guarda al toque sí lo es. El componente solo pinta las
 * flechas; quien lo usa decide cómo se calcula/guarda el intercambio (ver moverArriba/moverAbajo
 * en cada sección -- difieren en si el "vecino" se busca dentro de toda la lista o solo dentro de
 * un grupo, como la fase de un estado de proyecto).
 */
export function ReorderButtons({
  onUp,
  onDown,
  disabledUp,
  disabledDown,
  moving,
}: {
  onUp: () => void;
  onDown: () => void;
  disabledUp: boolean;
  disabledDown: boolean;
  moving: boolean;
}) {
  return (
    <div className="flex flex-shrink-0 flex-col">
      <button
        type="button"
        aria-label="Subir"
        title="Subir"
        disabled={disabledUp || moving}
        onClick={onUp}
        className="flex h-[15px] w-[22px] cursor-pointer items-center justify-center rounded-t-[3px] border border-b-0 border-border bg-transparent text-text-2 transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronUp size={12} strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Bajar"
        title="Bajar"
        disabled={disabledDown || moving}
        onClick={onDown}
        className="flex h-[15px] w-[22px] cursor-pointer items-center justify-center rounded-b-[3px] border border-border bg-transparent text-text-2 transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronDown size={12} strokeWidth={2} />
      </button>
    </div>
  );
}
