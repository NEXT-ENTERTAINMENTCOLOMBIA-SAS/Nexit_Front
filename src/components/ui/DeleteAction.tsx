"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Send, Trash2 } from "lucide-react";
import { Button } from "./primitives";
import { RowAction } from "./Table";
import { solicitudesEliminacionApi } from "@/services/api/solicitudes-eliminacion-service";
import { useAuthStore } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { TipoEntidadEliminable } from "@/types/api";

/**
 * Ventana de confirmación de eliminación -- ported del mockup aprobado ("¿Pedir
 * eliminar a X?"): icono de alerta, título, explicación y un motivo opcional.
 * Reemplaza el `window.confirm`/`window.prompt` nativo del navegador que usaba
 * antes esta acción (feo, sin estilo, y sin espacio para explicar qué pasa).
 */
function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  nombre,
  esAdmin,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  nombre: string;
  /** Nombre engañoso por compatibilidad -- en realidad es "puede eliminar directo" (solo super_admin, Alicia 2026-09-18). */
  esAdmin: boolean;
  loading: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  const [motivoError, setMotivoError] = useState(false);
  // Mismo lock compartido que Drawer/Modal (ver src/lib/use-body-scroll-lock.ts).
  useBodyScrollLock(open);

  if (typeof document === "undefined" || !open) return null;

  // El motivo solo es obligatorio para quien pide la eliminación (no para el admin, que
  // elimina directo): el administrador que revisa la solicitud necesita saber por qué se
  // pide, así que no puede llegar vacía.
  function handleConfirmClick() {
    if (!esAdmin && !motivo.trim()) {
      setMotivoError(true);
      return;
    }
    onConfirm(motivo);
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-5" onClick={onClose}>
      <div
        className="w-full max-w-[440px] rounded-[var(--radius-lg)] bg-surface p-6 shadow-[0_24px_70px_rgba(12,12,12,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <span className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-red-light text-red">
            <AlertTriangle size={20} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-[-0.02em]">
              {esAdmin ? `¿Eliminar a ${nombre}?` : `¿Pedir eliminar a ${nombre}?`}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-text-2">
              {esAdmin
                ? "Esta acción no se puede deshacer."
                : "Un administrador revisa la solicitud y decide si se elimina o no. Te llega una notificación con la respuesta."}
            </p>
          </div>
        </div>

        <label className="mt-3.5 block">
          <span className="text-xs font-medium text-text-2">
            Motivo {!esAdmin && <span className="text-red">*</span>}
            {esAdmin && " (opcional)"}
          </span>
          <textarea
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (e.target.value.trim()) setMotivoError(false);
            }}
            rows={2}
            placeholder="Por qué se debe eliminar…"
            className={`mt-1.5 w-full resize-y rounded-[var(--radius-md)] border bg-bg px-3 py-2.5 text-sm text-text outline-none transition-colors focus:bg-surface ${
              motivoError ? "border-red focus:border-red" : "border-border focus:border-text"
            }`}
          />
          {motivoError && <div className="mt-1 text-xs text-red">Escribe por qué se debe eliminar.</div>}
        </label>

        <div className="mt-[22px] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 cursor-pointer rounded-[var(--radius-md)] border border-border bg-transparent text-sm font-medium text-text transition-colors hover:border-text hover:bg-bg"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirmClick}
            className="h-11 flex-1 cursor-pointer rounded-[var(--radius-md)] bg-red text-sm font-medium text-white transition-colors hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Enviando…" : esAdmin ? "Eliminar" : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Botón de eliminar de cliente/proveedor/proyecto -- construido 2026-08-28, corregido 2026-09-18.
 * Solo super_admin elimina directo (el backend igual lo exige -- política SuperAdminOnly, ver
 * *-service.ts de cada módulo). Cualquier otro rol -- admin y manager incluidos -- nunca borra de
 * verdad desde acá: dispara una solicitud real (SolicitudesEliminacionController, docs/23) con
 * motivo obligatorio, que un gerente (si aplica) y luego un admin o el super_admin revisan.
 *
 * `compact` cambia el trigger de un botón con texto a un ícono cuadrado de
 * 30x30 (mismo `RowAction` que "editar" en las tablas) -- usado en la fila de
 * la tabla, donde no cabe el botón completo junto al de editar.
 */
export function DeleteOrRequestButton({
  tipoEntidad,
  entidadId,
  nombre,
  onDelete,
  compact = false,
}: {
  tipoEntidad: TipoEntidadEliminable;
  entidadId: string;
  /** Nombre a mostrar en el diálogo de confirmación ("¿Eliminar a {nombre}?"). */
  nombre: string;
  onDelete: () => void;
  compact?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const pushToast = useUiStore((s) => s.pushToast);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [yaSolicitado, setYaSolicitado] = useState(false);
  const esAdmin = user?.rol === "super_admin";

  async function handleConfirm(motivo: string) {
    if (esAdmin) {
      setOpen(false);
      onDelete();
      return;
    }
    setLoading(true);
    try {
      await solicitudesEliminacionApi.create({ tipoEntidad, entidadId, motivo: motivo || null });
      setYaSolicitado(true);
      setOpen(false);
      pushToast("Solicitud de eliminación enviada", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo enviar la solicitud", "danger");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {compact ? (
        <RowAction
          label={esAdmin ? "Eliminar este registro" : yaSolicitado ? "Solicitud enviada" : "Solicitar eliminación"}
          tone="danger"
          onClick={(e) => {
            e.stopPropagation();
            if (!yaSolicitado) setOpen(true);
          }}
        >
          <Trash2 size={14} strokeWidth={1.8} />
        </RowAction>
      ) : (
        <Button
          variant="danger"
          icon={esAdmin ? Trash2 : Send}
          onClick={() => setOpen(true)}
          disabled={yaSolicitado}
        >
          {esAdmin ? "Eliminar" : yaSolicitado ? "Solicitud enviada" : "Solicitar eliminación"}
        </Button>
      )}
      <ConfirmDeleteDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        nombre={nombre}
        esAdmin={esAdmin}
        loading={loading}
      />
    </>
  );
}
