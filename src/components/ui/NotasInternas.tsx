"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Dropdown } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RowAction } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/form";
import { AREA_SEGUIMIENTO_COLORS, statusColor } from "@/lib/constants";
import { fmtDateLong } from "@/lib/format";
import { clienteNotasApi } from "@/services/api/cliente-notas-service";
import { useAuthStore } from "@/store/auth-store";
import { useOpciones } from "@/store/config-store";
import { useUiStore } from "@/store/ui-store";
import type { ClienteNota } from "@/types/api";

/**
 * Notas internas de un cliente: elegir el área, escribir y agregar; abajo, la bitácora con quién
 * escribió cada nota y cuándo. Solo la ve el equipo. Borrar: quien la escribió o un administrador.
 */
export function NotasInternasCliente({ clienteId }: { clienteId: string }) {
  const pushToast = useUiStore((s) => s.pushToast);
  const user = useAuthStore((s) => s.user);
  const areas = useOpciones("area-seguimiento");
  const [notas, setNotas] = useState<ClienteNota[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState("General");
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ClienteNota | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de las notas al abrir/cambiar de cliente
    setLoading(true);
    clienteNotasApi
      .list(clienteId)
      .then((items) => {
        if (!cancelled) setNotas(items);
      })
      .catch(() => {
        if (!cancelled) pushToast("No se pudieron cargar las notas internas", "danger");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clienteId, pushToast]);

  async function agregar() {
    if (!texto.trim()) return;
    setSaving(true);
    try {
      const creada = await clienteNotasApi.create(clienteId, { area, nota: texto.trim() });
      setNotas((prev) => [creada, ...prev]);
      setTexto("");
      pushToast("Nota interna agregada", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo agregar la nota", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function borrar() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await clienteNotasApi.remove(clienteId, toDelete.id);
      setNotas((prev) => prev.filter((n) => n.id !== toDelete.id));
      pushToast("Nota eliminada", "success");
      setToDelete(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo eliminar la nota", "danger");
    } finally {
      setDeleting(false);
    }
  }

  const esAdmin = user?.rol === "admin" || user?.rol === "super_admin";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-bg p-3">
        <Dropdown value={area} onChange={(v) => setArea(v || "General")} placeholder="Área" options={areas.map((a) => ({ value: a, label: a }))} />
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={4000}
          placeholder="Nueva nota interna…"
          aria-label="Nueva nota interna"
          className="!bg-surface"
        />
        <button
          type="button"
          disabled={saving || !texto.trim()}
          onClick={agregar}
          className="flex h-9 w-fit cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] bg-teal-mid px-3 text-[13px] font-medium text-white transition-colors hover:bg-green hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={14} strokeWidth={2} />
          {saving ? "Guardando…" : "Agregar nota"}
        </button>
      </div>

      {loading ? (
        <div className="py-1 text-sm text-text-3">Cargando notas internas…</div>
      ) : notas.length === 0 ? (
        <div className="py-1 text-sm text-text-3">Todavía no hay notas internas.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {notas.map((n) => {
            const ac = statusColor(AREA_SEGUIMIENTO_COLORS, n.area);
            const puedeBorrar = esAdmin || (n.autorId != null && n.autorId === user?.id);
            return (
              <div key={n.id} className="rounded-[var(--radius-md)] border border-divider bg-bg px-3 py-2.5 text-[13px]">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge bg={ac.bg} color={ac.c}>{n.area}</Badge>
                  <span className="text-[12px] text-text-3">{n.autorNombre || "Cuenta eliminada"}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-text-3">{fmtDateLong(n.fecha?.slice(0, 10))}</span>
                  {puedeBorrar && (
                    <RowAction label="Eliminar nota" tone="danger" onClick={() => setToDelete(n)}>
                      <Trash2 size={13} strokeWidth={1.8} />
                    </RowAction>
                  )}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed text-text-2">{n.nota}</div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog open={!!toDelete} title="¿Eliminar esta nota?" confirmLabel="Eliminar" loading={deleting} onConfirm={borrar} onClose={() => setToDelete(null)}>
        Se borra para todo el equipo y no se puede recuperar.
      </ConfirmDialog>
    </div>
  );
}
