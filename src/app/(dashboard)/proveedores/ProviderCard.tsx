"use client";

import { Pencil } from "lucide-react";
import { Avatar, Badge, CountryBadge, Stars, Tag } from "@/components/ui/primitives";
import { PROVIDER_STATUS_COLORS, statusColor } from "@/lib/constants";
import { useCatalogosStore } from "@/store/catalogos-store";
import type { Proveedor } from "@/types/api";

export function ProviderCard({
  provider,
  onOpen,
  onEdit,
}: {
  provider: Proveedor;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const { paises, categoriasProveedor, regionesPorPais, ciudadesPorRegion } = useCatalogosStore();
  const sc = statusColor(PROVIDER_STATUS_COLORS, provider.estado);
  const paisNombre = paises.find((p) => p.id === provider.paisId)?.nombre;
  const regionNombre = regionesPorPais[provider.paisId ?? ""]?.find((r) => r.id === provider.regionId)?.nombre;
  const ciudadNombre = ciudadesPorRegion[provider.regionId ?? ""]?.find((c) => c.id === provider.ciudadId)?.nombre;
  const categoriaNombre = categoriasProveedor.find((c) => c.id === provider.categoriaId)?.nombre;
  const ubicacion = [ciudadNombre, regionNombre].filter(Boolean).join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="flex cursor-pointer flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-[border-color,box-shadow] hover:border-text hover:shadow-[0_2px_14px_rgba(12,12,12,0.07)]"
    >
      <div className="flex items-start gap-[11px]">
        <Avatar nombre={provider.nombre} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight tracking-[-0.015em]">{provider.nombre}</div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-text-3">
            <CountryBadge pais={paisNombre} />
            <span className="truncate">{ubicacion || paisNombre || "Sin ubicación"}</span>
          </div>
        </div>
        {typeof provider.score === "number" && <Stars n={provider.score} size={12} />}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge bg={sc.bg} color={sc.c}>
          {provider.estado}
        </Badge>
        {categoriaNombre && <Tag>{categoriaNombre}</Tag>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-3">
        <span className="min-w-0 flex-1 truncate text-xs text-text-3">{provider.contacto || "Sin contacto"}</span>
        <button
          type="button"
          aria-label={`Editar ${provider.nombre}`}
          title="Editar este proveedor"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="flex h-[30px] w-[30px] flex-shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-border bg-transparent text-text-2 transition-colors hover:border-text hover:bg-ink hover:text-green"
        >
          <Pencil size={14} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
