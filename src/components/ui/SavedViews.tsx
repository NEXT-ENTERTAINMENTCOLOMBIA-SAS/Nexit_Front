"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";

interface Vista<T> {
  id: string;
  nombre: string;
  filtros: T;
}

/**
 * Vistas guardadas (2026-10-05): la persona nombra la combinación de filtros que usa seguido
 * ("Mis eventos de la semana") y la vuelve a aplicar con un clic. Se guardan en ESTE navegador
 * (no viajan entre equipos); para compartir una vista con alguien se copia el enlace de la pantalla.
 */
export function SavedViews<T>({ clave, actual, hayFiltros, onApply }: { clave: string; actual: T; hayFiltros: boolean; onApply: (f: T) => void }) {
  const almacen = `nexit:vistas:${clave}`;
  const [abierto, setAbierto] = useState(false);
  const [vistas, setVistas] = useState<Vista<T>[]>([]);
  const [nombre, setNombre] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(almacen);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lee las vistas guardadas una sola vez al montar
      if (raw) setVistas(JSON.parse(raw) as Vista<T>[]);
    } catch {
      // almacenamiento no disponible: la función queda vacía pero la pantalla sigue funcionando
    }
  }, [almacen]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  function persistir(lista: Vista<T>[]) {
    setVistas(lista);
    try {
      window.localStorage.setItem(almacen, JSON.stringify(lista));
    } catch {
      // sin almacenamiento: la vista vale solo mientras la pantalla esté abierta
    }
  }

  function guardar() {
    const n = nombre.trim();
    if (!n) return;
    persistir([...vistas.filter((v) => v.nombre.toLowerCase() !== n.toLowerCase()), { id: crypto.randomUUID(), nombre: n, filtros: actual }]);
    setNombre("");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-[13px] text-text-2 transition-colors hover:border-border-strong hover:text-text"
      >
        <Bookmark size={14} strokeWidth={1.8} />
        Vistas{vistas.length > 0 && <span className="font-mono text-[11px] text-text-3">{vistas.length}</span>}
      </button>
      {abierto && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-72 rounded-[var(--radius-lg)] border border-border bg-surface p-2 shadow-lg">
          {vistas.length === 0 && <div className="px-2 py-2 text-[12.5px] text-text-3">Aún no tienes vistas guardadas.</div>}
          {vistas.map((v) => (
            <div key={v.id} className="flex items-center gap-1 rounded-[3px] hover:bg-hover-bg">
              <button
                type="button"
                onClick={() => {
                  onApply(v.filtros);
                  setAbierto(false);
                }}
                className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[13px] text-text"
              >
                {v.nombre}
              </button>
              <button
                type="button"
                aria-label={`Eliminar la vista ${v.nombre}`}
                onClick={() => persistir(vistas.filter((x) => x.id !== v.id))}
                className="flex h-7 w-7 items-center justify-center text-text-3 hover:text-red"
              >
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            </div>
          ))}
          <div className="mt-1 border-t border-divider pt-2">
            <div className="flex gap-1.5">
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && hayFiltros && guardar()}
                placeholder={hayFiltros ? "Nombre de la vista" : "Aplica algún filtro primero"}
                disabled={!hayFiltros}
                className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-2 py-1.5 text-[12.5px] text-text outline-none focus:border-teal-mid disabled:opacity-60"
              />
              <button
                type="button"
                onClick={guardar}
                disabled={!hayFiltros || !nombre.trim()}
                className="rounded-[var(--radius-md)] bg-teal-mid px-2.5 text-[12.5px] font-medium text-white disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
            <div className="mt-1.5 px-0.5 text-[11px] text-text-3">Se guardan en este navegador.</div>
          </div>
        </div>
      )}
    </div>
  );
}
