"use client";

import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { DeleteOrRequestButton } from "@/components/ui/DeleteAction";
import { RowAction, Table, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { PROJECT_STATUS_COLORS, statusColor } from "@/lib/constants";
import { fmtDateShort } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { EstadoProyecto, Proyecto } from "@/types/api";

/** Miembro del equipo cuyo rol suena a "ejecutivo" (ver ProjectCard.tsx). */
export function ejecutivoDe(project: Proyecto): string {
  return project.equipo.find((m) => m.rol?.toLowerCase().includes("ejecutivo"))?.nombre ?? "—";
}

export function ProyectosTabla({
  proyectos,
  estados,
  clienteNombre,
  onOpen,
  onEdit,
  onDelete,
}: {
  proyectos: Proyecto[];
  estados: EstadoProyecto[];
  clienteNombre: (id?: string | null) => string | undefined;
  onOpen: (p: Proyecto) => void;
  onEdit: (p: Proyecto) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Table>
      <Thead>
        <Th>Proyecto</Th>
        <Th>Cliente</Th>
        <Th>Fecha</Th>
        <Th>Estado</Th>
        <Th>Valor</Th>
        <Th>Ejecutivo</Th>
        <Th className="text-right">Acciones</Th>
      </Thead>
      <tbody>
        {proyectos.map((p) => {
          const estadoNombre = estados.find((e) => e.id === p.estadoId)?.nombre ?? "—";
          const st = statusColor(PROJECT_STATUS_COLORS, estadoNombre);
          return (
            <Tr key={p.id} onClick={() => onOpen(p)}>
              <Td className="font-medium">{p.nombre || "(Sin nombre)"}</Td>
              <Td className="text-text-2">{clienteNombre(p.clienteId) || "Sin cliente"}</Td>
              <Td className="text-text-2">{fmtDateShort(p.fechaEvento?.slice(0, 10)) || "—"}</Td>
              <Td>
                <Badge bg={st.bg} color={st.c}>
                  {estadoNombre}
                </Badge>
              </Td>
              <Td className="text-text-2">{formatMoney(p.valor, p.moneda)}</Td>
              <Td className="text-text-2">{ejecutivoDe(p)}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <RowAction
                    label="Editar este proyecto"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(p);
                    }}
                  >
                    <Pencil size={14} strokeWidth={1.8} />
                  </RowAction>
                  <DeleteOrRequestButton compact tipoEntidad="proyecto" entidadId={p.id} nombre={p.nombre} onDelete={() => onDelete(p.id)} />
                </div>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
