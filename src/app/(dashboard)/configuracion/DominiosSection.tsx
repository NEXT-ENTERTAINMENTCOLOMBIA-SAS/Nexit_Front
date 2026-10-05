"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RowAction } from "@/components/ui/Table";
import { Input } from "@/components/ui/form";
import { configuracionApi } from "@/services/api/configuracion-service";
import { useUiStore } from "@/store/ui-store";
import type { DominioCorreo } from "@/types/api";

/** Dominios de correo autorizados para crear cuentas -- solo el super administrador los cambia. */
export function DominiosSection() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [items, setItems] = useState<DominioCorreo[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<DominioCorreo | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await configuracionApi.dominiosCorreo.list());
    } catch (err) {
      setItems([]);
      pushToast(err instanceof Error ? err.message : "No se pudieron cargar los dominios", "danger");
    }
  }, [pushToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    load();
  }, [load]);

  async function agregar() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const d = await configuracionApi.dominiosCorreo.create(draft.trim());
      setItems((p) => [...(p ?? []), d]);
      setDraft("");
      pushToast("Dominio agregado", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo agregar", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!toDelete) return;
    try {
      await configuracionApi.dominiosCorreo.remove(toDelete.id);
      setItems((p) => (p ?? []).filter((x) => x.id !== toDelete.id));
      pushToast("Dominio eliminado", "success");
      setToDelete(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo eliminar", "danger");
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[0_1px_3px_rgba(12,12,12,.04)]">
      <div className="flex items-center gap-2 border-b border-[#EFEDE7] bg-gray-light px-4 py-2.5">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="ejemplo.com" aria-label="Nuevo dominio" className="h-9 flex-1 bg-surface" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }} />
        <RowAction label="Agregar" onClick={agregar} disabled={saving || !draft.trim()}><Plus size={14} strokeWidth={2} /></RowAction>
      </div>
      {items === null && <div className="px-4 py-3.5 text-sm text-text-3">Cargando…</div>}
      {items?.length === 0 && <div className="px-4 py-3.5 text-sm text-text-3">Sin dominios todavía.</div>}
      {items?.map((d, i) => (
        <div key={d.id} className={`flex items-center gap-2 px-4 py-2.5 ${i !== items.length - 1 ? "border-b border-[#EFEDE7]" : ""}`}>
          <span className="min-w-0 flex-1 truncate font-mono text-[13px]">@{d.dominio}</span>
          <RowAction label="Eliminar" tone="danger" onClick={() => setToDelete(d)}><Trash2 size={13} strokeWidth={1.8} /></RowAction>
        </div>
      ))}
      <ConfirmDialog open={!!toDelete} title={`¿Quitar @${toDelete?.dominio}?`} confirmLabel="Quitar" onConfirm={eliminar} onClose={() => setToDelete(null)}>
        Nadie con ese dominio podrá registrarse nuevo. Las cuentas que ya existen no se afectan.
      </ConfirmDialog>
    </div>
  );
}
