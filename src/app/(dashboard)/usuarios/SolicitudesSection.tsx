"use client";

import { Check, ShieldQuestion, X } from "lucide-react";
import { Badge, Tag } from "@/components/ui/primitives";
import { RowAction, Table, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { haceCuanto } from "@/lib/format";
import type { SolicitudEliminacion, TipoEntidadEliminable } from "@/types/api";
import { SeccionHeader } from "./SeccionHeader";

const ENTIDAD_LABELS: Record<TipoEntidadEliminable, string> = {
  cliente: "Cliente",
  proveedor: "Proveedor",
  proyecto: "Proyecto",
  usuario: "Usuario",
};

/**
 * Los estados de una solicitud de eliminación (Nexit_Back/docs/11, sección 9). Solo
 * `pendiente_admin` espera una decisión de quien está mirando esta pantalla: `pendiente_gerente`
 * espera al gerente responsable de ESE proyecto, y las otras dos ya terminaron su camino. Antes los
 * botones de aprobar/rechazar salían en todas las filas por igual, así que en tres de los cuatro
 * estados el clic solo servía para recibir un error del backend.
 */
const SOLICITUD_ESTADOS: Record<string, { label: string; bg: string; c: string }> = {
  pendiente_gerente: { label: "Espera al gerente", bg: "#FBF0DC", c: "#7A4E00" },
  pendiente_admin: { label: "Espera tu decisión", bg: "#E6F1FB", c: "#0C447C" },
  aprobada: { label: "Aprobada", bg: "#E4F9EE", c: "#036B3C" },
  rechazada: { label: "Rechazada", bg: "#FCEBEB", c: "#791F1F" },
};

/** Solicitudes de eliminación (clientes, proveedores, proyectos y cuentas): quién pidió qué y qué decisión toca. */
export function SolicitudesSection({
  solicitudes,
  porDecidir,
  entidadNombre,
  usuarioNombre,
  onAprobar,
  onRechazar,
}: {
  solicitudes: SolicitudEliminacion[];
  porDecidir: number;
  entidadNombre: (s: SolicitudEliminacion) => string;
  usuarioNombre: (id: string | null | undefined) => string;
  onAprobar: (s: SolicitudEliminacion, nombre: string) => void;
  onRechazar: (s: SolicitudEliminacion, nombre: string) => void;
}) {
  return (
<div>
  <SeccionHeader
    icon={ShieldQuestion}
    titulo="Solicitudes de eliminación"
    conteo={porDecidir}
  />

  {solicitudes.length === 0 ? (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface px-5 py-9 text-center">
      <ShieldQuestion size={24} strokeWidth={1.5} className="mx-auto mb-2 text-text-3" />
      <div className="text-[13px] text-text-2">Nadie ha pedido eliminar nada.</div>
      <div className="mt-1 text-[12px] text-text-3">
        Aquí llegan las solicitudes de clientes, proveedores, proyectos y cuentas del equipo.
      </div>
    </div>
  ) : (
    <Table>
      <Thead>
        <Th>Qué se quiere eliminar</Th>
        <Th className="text-center">Solicitado por</Th>
        <Th className="text-center">Motivo</Th>
        <Th className="text-center">Estado</Th>
        <Th className="text-center">Acciones</Th>
      </Thead>
      <tbody>
        {solicitudes.map((s) => {
          const nombre = entidadNombre(s);
          const estado = SOLICITUD_ESTADOS[s.estado] ?? { label: s.estado, bg: "var(--gray-light)", c: "var(--text-2)" };
          const meToca = s.estado === "pendiente_admin";
          return (
            <Tr key={s.id}>
              <Td>
                <div className="flex items-center gap-2">
                  <Tag>{ENTIDAD_LABELS[s.tipoEntidad]}</Tag>
                  <span className="font-medium">{nombre}</span>
                </div>
                <div className="mt-0.5 pl-1 text-[11px] text-text-3">Solicitado {haceCuanto(s.createdAt)}</div>
              </Td>
              <Td className="text-center text-text-2">{usuarioNombre(s.solicitadoPorId)}</Td>
              <Td className="max-w-[240px] truncate text-center text-text-2" >
                {s.motivo || <span className="text-text-3">Sin motivo</span>}
              </Td>
              <Td className="text-center">
                <Badge bg={estado.bg} color={estado.c}>
                  {estado.label}
                </Badge>
              </Td>
              <Td>
                <div className="flex justify-center gap-1.5">
                  {meToca ? (
                    <>
                      <RowAction
                        label={`Aprobar y eliminar ${nombre}`}
                        onClick={() => onAprobar(s, nombre)}
                      >
                        <Check size={13} strokeWidth={2} />
                      </RowAction>
                      <RowAction
                        label={`Rechazar la solicitud sobre ${nombre}`}
                        tone="danger"
                        onClick={() => onRechazar(s, nombre)}
                      >
                        <X size={13} strokeWidth={2} />
                      </RowAction>
                    </>
                  ) : (
                    // El estado (columna de al lado) ya dice por qué no hay nada que hacer acá
                    // -- "Espera al gerente", "Aprobada", "Rechazada" -- repetirlo en Acciones
                    // no agrega nada.
                    <span className="text-[12px] text-text-3">—</span>
                  )}
                </div>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  )}
</div>
  );
}
