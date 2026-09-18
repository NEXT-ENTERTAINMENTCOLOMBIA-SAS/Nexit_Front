"use client";

import { MapPin, Pencil } from "lucide-react";
import { Avatar, Badge } from "@/components/ui/primitives";
import { CLIENT_STATUS_COLORS, statusColor } from "@/lib/constants";
import { useCatalogosStore } from "@/store/catalogos-store";
import type { Cliente } from "@/types/api";

export function ClienteCard({ cliente, onOpen, onEdit }: { cliente: Cliente; onOpen: () => void; onEdit: () => void }) {
  const { paises, regionesPorPais, ciudadesPorRegion } = useCatalogosStore();
  const sc = statusColor(CLIENT_STATUS_COLORS, cliente.estado);
  // ClientesPage precarga región/ciudad para todos los países/regiones presentes en la lista
  // (ver su useEffect) para que esto resuelva "Ciudad · Departamento · País" sin pedirle un
  // fetch aparte a cada tarjeta. Si el cliente es de antes del catálogo (o nunca se le asignó),
  // cae al texto libre `ciudad`.
  const paisNombre = paises.find((p) => p.id === cliente.paisId)?.nombre;
  const regionNombre = regionesPorPais[cliente.paisId ?? ""]?.find((r) => r.id === cliente.regionId)?.nombre;
  const ciudadNombre = ciudadesPorRegion[cliente.regionId ?? ""]?.find((c) => c.id === cliente.ciudadId)?.nombre;
  const ubicacion = [ciudadNombre, regionNombre, paisNombre].filter(Boolean).join(" · ") || cliente.ciudad;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="flex cursor-pointer flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-[border-color,box-shadow] hover:border-text hover:shadow-[0_2px_14px_rgba(12,12,12,0.07)]"
    >
      <div className="flex items-start gap-[11px]">
        <Avatar nombre={cliente.nombre} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight tracking-[-0.015em]">{cliente.nombre}</div>
          <div className="mt-0.5 truncate text-xs text-text-3">{cliente.sector || "Sin sector"}</div>
        </div>
      </div>

      {ubicacion && (
        <div className="flex items-center gap-[7px] text-[13px] text-text-2">
          <MapPin size={14} strokeWidth={1.8} className="flex-shrink-0 text-text-3" />
          <span className="truncate">{ubicacion}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[#EFEDE7] pt-3">
        <Badge bg={sc.bg} color={sc.c}>
          {cliente.estado}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-xs text-text-3">{cliente.contacto || "Sin contacto"}</span>
        <button
          type="button"
          aria-label={`Editar ${cliente.nombre}`}
          title="Editar este cliente"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="flex h-[30px] w-[30px] flex-shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-border bg-transparent text-text-2 transition-colors hover:border-text hover:bg-text hover:text-green"
        >
          <Pencil size={14} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
