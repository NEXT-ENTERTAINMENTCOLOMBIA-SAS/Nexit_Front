"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { useCatalogosStore } from "@/store/catalogos-store";
import type { Proveedor } from "@/types/api";

export function ProviderPicker({
  providers,
  selectedIds,
  onToggle,
}: {
  providers: Proveedor[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { categoriasProveedor } = useCatalogosStore();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return providers.filter((p) => {
      const cat = categoriasProveedor.find((c) => c.id === p.categoriaId)?.nombre ?? "";
      return !s || [p.nombre, cat].some((v) => v?.toLowerCase().includes(s));
    });
  }, [providers, search, categoriasProveedor]);

  return (
    <div>
      {/* Alicia 2026-09-18: la lupa quedaba encima de la primera letra del placeholder -- más
          espacio entre el ícono y el texto (pl-10 en vez de pl-[34px]). */}
      <div className="relative mb-2">
        <Search size={14} strokeWidth={2} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proveedor por nombre o categoría…"
          className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface py-2 pl-10 pr-3 text-[13px] outline-none transition-colors focus:border-teal-mid"
        />
      </div>
      <div className="mb-1.5 text-xs text-text-2">{selectedIds.size} proveedores seleccionados</div>
      <div className="flex max-h-[220px] flex-col overflow-y-auto rounded-[var(--radius-md)] border border-border">
        {filtered.length === 0 && (
          <div className="py-3.5 text-center text-xs text-text-3">No se encontraron proveedores</div>
        )}
        {filtered.map((p) => {
          const checked = selectedIds.has(p.id);
          const cat = categoriasProveedor.find((c) => c.id === p.categoriaId)?.nombre ?? "";
          return (
            <label
              key={p.id}
              className="flex cursor-pointer items-center gap-2.5 border-b border-border px-2.5 py-2 last:border-b-0 hover:bg-gray-light"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(p.id)}
                className="h-[15px] w-[15px] flex-shrink-0 cursor-pointer accent-teal-mid"
              />
              <Avatar nombre={p.nombre} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{p.nombre}</div>
                <div className="truncate text-[11px] text-text-2">{cat}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
