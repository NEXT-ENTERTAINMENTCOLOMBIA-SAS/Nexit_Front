"use client";

import { Calendar, MapPin, Pencil, Truck } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { PROJECT_STATUS_COLORS, statusColor } from "@/lib/constants";
import { fmtDateShort } from "@/lib/format";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useClientesStore } from "@/store/clientes-store";
import type { Proyecto } from "@/types/api";

/** Miembro del equipo cuyo rol suena a "ejecutivo" -- el mockup asume un rol fijo con ese
 * nombre exacto; nuestro `equipo` es una lista libre de {rol, nombre}, así que se busca por
 * coincidencia parcial en vez de asumir una posición fija. */
function ejecutivoDe(project: Proyecto): string | undefined {
  return project.equipo.find((m) => m.rol?.toLowerCase().includes("ejecutivo"))?.nombre;
}

export function ProjectCard({ project, onOpen, onEdit }: { project: Proyecto; onOpen: () => void; onEdit: () => void }) {
  const { estadosProyecto } = useCatalogosStore();
  const { items: clientes } = useClientesStore();
  const estadoNombre = estadosProyecto.find((e) => e.id === project.estadoId)?.nombre ?? "—";
  const clienteNombre = clientes.find((c) => c.id === project.clienteId)?.nombre;
  const st = statusColor(PROJECT_STATUS_COLORS, estadoNombre);
  const ejecutivo = ejecutivoDe(project);
  const fechaLabel = fmtDateShort(project.fechaEvento?.slice(0, 10)) || "Sin fecha";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="flex cursor-pointer flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-[border-color,box-shadow] hover:border-text hover:shadow-[0_2px_14px_rgba(12,12,12,0.07)]"
    >
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold leading-tight tracking-[-0.015em]">
          {project.nombre || "(Sin nombre)"}
        </div>
        <div className="mt-0.5 truncate text-xs text-text-3">{clienteNombre || "Sin cliente"}</div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-[7px] truncate text-[13px] text-text-2">
          <Calendar size={14} strokeWidth={1.8} className="flex-shrink-0 text-text-3" />
          <span className="truncate">
            {fechaLabel}
            {ejecutivo && <> · {ejecutivo}</>}
          </span>
        </div>
        {project.ciudad && (
          <div className="flex items-center gap-[7px] truncate text-[13px] text-text-2">
            <MapPin size={14} strokeWidth={1.8} className="flex-shrink-0 text-text-3" />
            <span className="truncate">{project.ciudad}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-3">
        <Badge bg={st.bg} color={st.c}>
          {estadoNombre}
        </Badge>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs text-text-3">
          <Truck size={13} strokeWidth={1.8} className="flex-shrink-0" />
          {project.proveedorIds.length} proveedor{project.proveedorIds.length === 1 ? "" : "es"}
        </span>
        <button
          type="button"
          aria-label={`Editar ${project.nombre}`}
          title="Editar este proyecto"
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
