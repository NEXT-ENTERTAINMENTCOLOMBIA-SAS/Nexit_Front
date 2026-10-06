"use client";

import { useEffect, useRef } from "react";

/**
 * Actualización "en vivo" sencilla (2026-10-05): vuelve a pedir los datos cuando la persona regresa a la
 * pestaña y, mientras la pestaña está visible, cada `cada` ms. Así los cambios que hicieron otros aparecen
 * sin recargar. No usa websockets: es un sondeo liviano y se pausa solo en pestañas ocultas.
 */
export function useLiveRefresh(refrescar: () => void, cada = 60_000) {
  const ref = useRef(refrescar);
  useEffect(() => {
    ref.current = refrescar;
  }, [refrescar]);

  useEffect(() => {
    function alVolver() {
      if (document.visibilityState === "visible") ref.current();
    }
    document.addEventListener("visibilitychange", alVolver);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") ref.current();
    }, cada);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.clearInterval(id);
    };
  }, [cada]);
}
