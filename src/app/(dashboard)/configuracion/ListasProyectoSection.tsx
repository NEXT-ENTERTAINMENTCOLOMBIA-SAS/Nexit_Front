"use client";

import { useMemo } from "react";
import { useConfigStore, OPCIONES_RESPALDO } from "@/store/config-store";
import type { ItemCatalogo, ListaConfigurable } from "@/types/api";
import { CatalogList } from "./CatalogList";

const SINGULAR: Record<ListaConfigurable, [string, string]> = {
  "tipo-proyecto": ["tipo", "tipos"],
  prioridad: ["prioridad", "prioridades"],
  "sede-next": ["sede", "sedes"],
  "estado-propuesta": ["estado", "estados"],
  "area-seguimiento": ["área", "áreas"],
};

/**
 * Una lista de Proyectos editable (tipo, prioridad, sede, estado de la propuesta, área de seguimiento).
 * Renombrar un valor actualiza también los proyectos que ya lo usan (lo hace el backend); los valores
 * que el sistema necesita con su nombre exacto salen con candado.
 */
export function ListasProyectoSection({ lista }: { lista: ListaConfigurable }) {
  const opciones = useConfigStore((s) => s.opciones);
  const { addOpcion, updateOpcion, removeOpcion } = useConfigStore();

  const items = useMemo<(ItemCatalogo & { protegido: boolean })[]>(() => {
    const reales = opciones?.[lista];
    if (reales) return reales.map((o) => ({ id: o.id, nombre: o.valor, protegido: o.protegido }));
    return OPCIONES_RESPALDO[lista].map((v) => ({ id: v, nombre: v, protegido: true }));
  }, [opciones, lista]);

  const [uno, varios] = SINGULAR[lista];
  const protegidos = new Set(items.filter((i) => i.protegido).map((i) => i.id));

  return (
    <CatalogList
      items={items}
      itemLabel={items.length === 1 ? uno : varios}
      placeholder={`Nuev${uno === "tipo" || uno === "estado" ? "o" : "a"} ${uno}…`}
      emptyLabel="Sin valores todavía."
      onAdd={(n) => addOpcion(lista, n)}
      onUpdate={(id, n) => updateOpcion(lista, id, n)}
      onRemove={(id) => removeOpcion(lista, id)}
      isLocked={(i) => protegidos.has(i.id)}
      accent="var(--success)"
      accentLight="var(--success-light)"
    />
  );
}
