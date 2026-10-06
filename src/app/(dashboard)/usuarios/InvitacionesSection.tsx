"use client";

import { MailPlus, Send, X } from "lucide-react";
import { Badge, Button, Tag } from "@/components/ui/primitives";
import { RowAction, Table, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { ROL_COLORS } from "@/lib/constants";
import { haceCuanto } from "@/lib/format";
import { fmtFechaHora } from "@/lib/historial";
import type { Invitacion, Rol } from "@/types/api";
import { SeccionHeader } from "./SeccionHeader";

/** Invitaciones por correo: las pendientes siempre, y las ya respondidas si se piden. */
export function InvitacionesSection({
  invitaciones,
  pendientes,
  visibles,
  verRespondidas,
  onToggleRespondidas,
  rolLabels,
  onInvitar,
  onCancelar,
}: {
  invitaciones: Invitacion[];
  pendientes: Invitacion[];
  visibles: Invitacion[];
  verRespondidas: boolean;
  onToggleRespondidas: () => void;
  rolLabels: Record<Rol, string>;
  onInvitar: () => void;
  onCancelar: (i: Invitacion) => void;
}) {
  return (
    <div className="mb-9">
      <SeccionHeader
        icon={MailPlus}
        titulo="Invitaciones pendientes"
        descripcion="Ya recibieron el correo, pero todavía no han creado su perfil."
        conteo={pendientes.length}
        accion={
          <Button variant="primary" icon={Send} onClick={() => onInvitar()}>
            Invitar usuarios
          </Button>
        }
      />

      {visibles.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface px-5 py-9 text-center">
          <MailPlus size={24} strokeWidth={1.5} className="mx-auto mb-2 text-text-3" />
          <div className="text-[13px] text-text-2">No hay invitaciones esperando respuesta.</div>
          <div className="mt-1 text-[12px] text-text-3">
            Con “Invitar” puedes mandar varios correos de una vez, o subir una lista desde Excel.
          </div>
        </div>
      ) : (
        <Table
          footer={
            invitaciones.length > pendientes.length ? (
              <button
                type="button"
                onClick={() => onToggleRespondidas()}
                className="cursor-pointer text-[12px] text-text-2 underline-offset-2 hover:underline"
              >
                {verRespondidas
                  ? "Ver solo las que siguen pendientes"
                  : `Ver también las ${invitaciones.length - pendientes.length} ya respondidas`}
              </button>
            ) : undefined
          }
        >
          <Thead>
            <Th>Correo invitado</Th>
            <Th className="text-center">Rol propuesto</Th>
            <Th className="text-center">Invitada por</Th>
            <Th className="text-center">Enviada</Th>
            <Th className="text-center">Acciones</Th>
          </Thead>
          <tbody>
            {visibles.map((i) => {
              const rolColor = ROL_COLORS[i.rol];
              const pendiente = i.estado === "Pendiente";
              return (
                <Tr key={i.id}>
                  <Td>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-gray-light text-text-2">
                        <MailPlus size={14} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{i.email}</span>
                          {!pendiente && <Tag>{i.estado}</Tag>}
                        </div>
                        {i.mensaje ? (
                          <div className="mt-0.5 truncate text-[11px] italic text-text-3">“{i.mensaje}”</div>
                        ) : (
                          <div className="mt-0.5 text-[11px] text-text-3">Sin mensaje</div>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td className="text-center">
                    <Badge bg={rolColor.bg} color={rolColor.c}>
                      {rolLabels[i.rol]}
                    </Badge>
                  </Td>
                  <Td className="text-center text-text-2">{i.invitadoPorNombre ?? "—"}</Td>
                  <Td className="text-center">
                    <span title={fmtFechaHora(i.createdAt)} className="text-text-2">
                      {haceCuanto(i.createdAt)}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex justify-center">
                      {pendiente ? (
                        <RowAction
                          label={`Cancelar la invitación a ${i.email}`}
                          tone="danger"
                          onClick={() => onCancelar(i)}
                        >
                          <X size={13} strokeWidth={2} />
                        </RowAction>
                      ) : (
                        <span className="text-[12px] text-text-3">
                          {i.fechaRespuesta ? haceCuanto(i.fechaRespuesta) : "—"}
                        </span>
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
