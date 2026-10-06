"use client";

import { Mail, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import {
  DetailBox,
  DetailRow,
  Drawer,
  DrawerCloseButton,
  DrawerFooter,
  DrawerHeader,
  DrawerIconButton,
} from "@/components/ui/Drawer";
import {
  CUENTA_ACTIVA_COLOR,
  CUENTA_INACTIVA_COLOR,
  ROL_COLORS,
  } from "@/lib/constants";
import { inicialesPersona } from "@/lib/format";
import { fmtFechaHora } from "@/lib/historial";
import type { PresenciaUsuario, Usuario } from "@/types/api";
import { useRolLabels, useRolDescripciones } from "@/store/config-store";

/**
 * Perfil de una persona del equipo (Alicia 2026-09-08: "dónde está la parte para ver el perfil del
 * usuario, eso también falta"). Panel lateral, igual que el detalle de Cliente/Proveedor/Proyecto,
 * para no perder de vista la lista.
 *
 * Editar y eliminar aparecen para admin/super_admin (2026-09-09: ya no exclusivo de super_admin,
 * varias administradoras van a manejar usuarios), y sobre la propia cuenta salen deshabilitados con
 * el motivo a la vista: el backend ya rechaza desactivarse, quitarse el rol o eliminarse a uno mismo
 * (docs/06/docs/11), pero enterarse por un error rojo después de hacer clic es peor experiencia que
 * ver el botón apagado y entender por qué.
 */
export function UsuarioDetail({
  usuario,
  presencia,
  puedeEditar,
  esMiPropiaCuenta,
  onClose,
  onEdit,
  motivoNoEliminable,
  onDelete,
}: {
  usuario: Usuario | null;
  presencia: PresenciaUsuario | undefined;
  puedeEditar: boolean;
  esMiPropiaCuenta: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** Por qué no se puede pedir la baja de esta cuenta, o null si sí se puede (ver la pantalla de Usuarios). */
  motivoNoEliminable: string | null;
  onDelete: () => void;
}) {
  const rolLabels = useRolLabels();
  const rolDescripciones = useRolDescripciones();
  if (!usuario) {
    return (
      <Drawer open={false} onClose={onClose} size="detail">
        <></>
      </Drawer>
    );
  }

  const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`.trim();
  const rolColor = ROL_COLORS[usuario.rol];
  const cuentaColor = usuario.activo ? CUENTA_ACTIVA_COLOR : CUENTA_INACTIVA_COLOR;
  const enLinea = presencia?.enLinea ?? false;

  // docs/17: una cuenta desactivada se elimina sola a los 30 días de haberse desactivado.
  const fechaEliminacion = usuario.fechaDesactivacion
    ? new Date(new Date(usuario.fechaDesactivacion).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <Drawer open={Boolean(usuario)} onClose={onClose} size="detail">
      <DrawerHeader>
        <div className="relative">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-ink text-[15px] font-semibold text-green">
            {inicialesPersona(usuario.nombre, usuario.apellido)}
          </div>
          {enLinea && (
            <span
              aria-hidden
              title="Conectado ahora"
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold leading-tight tracking-[-0.025em]">{nombreCompleto || "Sin nombre"}</div>
          <div className="mt-1 truncate text-[13px] text-text-3">{usuario.email}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge bg={rolColor.bg} color={rolColor.c}>
              {rolLabels[usuario.rol]}
            </Badge>
            <Badge bg={cuentaColor.bg} color={cuentaColor.c}>
              {usuario.activo ? "Cuenta activa" : "Cuenta desactivada"}
            </Badge>
          </div>
        </div>
        {puedeEditar && (
          <DrawerIconButton label={esMiPropiaCuenta ? "Editar mi perfil" : "Editar"} onClick={onEdit}>
            <Pencil size={15} strokeWidth={1.9} />
          </DrawerIconButton>
        )}
        <DrawerCloseButton onClose={onClose} />
      </DrawerHeader>

      <div className="flex-1 px-[22px] py-4">
        <DetailBox title="Acceso">
          <DetailRow k="Rol" v={rolLabels[usuario.rol]} />
          <DetailRow k="Permisos" v={<span className="text-text-2">{rolDescripciones[usuario.rol]}</span>} />
          <DetailRow
            k="Estado"
            v={
              usuario.activo ? (
                "Puede entrar al sistema"
              ) : (
                <span className="text-text-2">
                  Sin acceso desde el {fmtFechaHora(usuario.fechaDesactivacion!)}
                  {fechaEliminacion && (
                    <>
                      {" "}
                      — se elimina sola el{" "}
                      <span className="font-medium text-red">
                        {fechaEliminacion.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}
                      </span>
                    </>
                  )}
                </span>
              )
            }
          />
          <DetailRow
            k="Ahora"
            v={
              enLinea ? (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
                  Conectado
                </span>
              ) : presencia?.ultimaActividad ? (
                <span className="text-text-2">Última vez: {fmtFechaHora(presencia.ultimaActividad)}</span>
              ) : (
                <span className="text-text-3">Desconectado</span>
              )
            }
          />
        </DetailBox>

        <DetailBox title="Datos">
          <DetailRow k="Nombre" v={usuario.nombre || "—"} />
          <DetailRow k="Apellido" v={usuario.apellido || "—"} />
          <DetailRow k="Correo" v={usuario.email} />
          <DetailRow k="En Nexit desde" v={fmtFechaHora(usuario.createdAt)} />
          {usuario.updatedAt && <DetailRow k="Última edición" v={fmtFechaHora(usuario.updatedAt)} />}
        </DetailBox>
      </div>

      <DrawerFooter>
        <a
          href={`mailto:${usuario.email}`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3.5 py-2 text-[13px] font-medium text-text transition-colors hover:bg-gray-light"
        >
          <Mail size={15} strokeWidth={1.9} />
          Escribirle
        </a>
        {/* Pedir la baja no es exclusivo del super_admin: un administrador también puede, y no
            elimina nada por sí solo -- abre una solicitud que alguien tiene que aprobar. */}
        <button
          type="button"
          onClick={onDelete}
          disabled={motivoNoEliminable !== null}
          title={motivoNoEliminable ?? "Pedir que se elimine esta cuenta"}
          className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3.5 py-2 text-[13px] font-medium text-text-2 transition-colors hover:border-red hover:bg-red-light hover:text-red disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-text-2"
        >
          <Trash2 size={15} strokeWidth={1.9} />
          Pedir eliminación
        </button>
      </DrawerFooter>
    </Drawer>
  );
}
