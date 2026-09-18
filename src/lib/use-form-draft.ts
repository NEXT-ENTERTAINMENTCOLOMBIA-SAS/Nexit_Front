"use client";

import { useEffect, useRef } from "react";

/**
 * Autoguardado de borradores de formulario (Alicia 2026-09-07): mientras un
 * formulario de crear/editar (Cliente, Proveedor, Proyecto) está abierto, se
 * guarda una copia de lo que se lleva escrito en localStorage, con un
 * pequeño debounce. Si cierras el drawer sin querer (o recargas la
 * página) y vuelves a abrir ESE MISMO formulario, se restaura solo, con un
 * aviso. Se borra al guardar con éxito -- un borrador viejo no debe
 * reaparecer sobre un registro que ya quedó guardado.
 */

const PREFIX = "nexit:draft:";

export function readFormDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearFormDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) -- no es crítico, se ignora.
  }
}

/** Guarda `value` en localStorage ~600ms después del último cambio, mientras `enabled` es true. */
export function useFormDraftAutosave<T>(key: string | null, value: T, enabled: boolean) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !key) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch {
        // idem -- no es crítico, se ignora.
      }
    }, 600);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
     
  }, [key, value, enabled]);
}
