"use client";

import { useCallback, useEffect, useState } from "react";

export type Tema = "light" | "dark";
const CLAVE = "nexit:tema";

/** Modo oscuro (2026-10-05). Solo cambia cuando la persona lo pide: por defecto se ve igual que siempre. */
export function useTheme() {
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee la preferencia guardada una sola vez al montar
    setTema(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  const alternar = useCallback(() => {
    setTema((actual) => {
      const nuevo: Tema = actual === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nuevo;
      try {
        window.localStorage.setItem(CLAVE, nuevo);
      } catch {
        // sin almacenamiento (modo privado): el cambio vale solo para esta visita
      }
      return nuevo;
    });
  }, []);

  return { tema, alternar };
}

/** Script que corre antes de pintar para aplicar el tema guardado y evitar el parpadeo blanco. */
export const SCRIPT_TEMA = `try{var t=localStorage.getItem("${CLAVE}");if(t==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;
