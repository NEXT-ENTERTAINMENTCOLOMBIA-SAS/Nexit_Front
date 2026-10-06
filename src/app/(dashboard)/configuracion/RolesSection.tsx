"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { RowAction } from "@/components/ui/Table";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { ROLES, ROL_COLORS } from "@/lib/constants";
import { useConfigStore, useRolDescripciones, useRolLabels } from "@/store/config-store";
import { useUiStore } from "@/store/ui-store";
import type { Rol } from "@/types/api";

/** Nombre y descripción de cada rol. La clave técnica (super_admin, admin…) no cambia: los permisos dependen de ella. */
export function RolesSection() {
  const labels = useRolLabels();
  const descripciones = useRolDescripciones();
  const updateRol = useConfigStore((s) => s.updateRol);
  const pushToast = useUiStore((s) => s.pushToast);
  const [editando, setEditando] = useState<Rol | null>(null);
  const [etiqueta, setEtiqueta] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  function empezar(r: Rol) {
    setEditando(r);
    setEtiqueta(labels[r]);
    setDescripcion(descripciones[r]);
  }

  async function guardar(r: Rol) {
    if (!etiqueta.trim()) return;
    setGuardando(true);
    try {
      await updateRol(r, { etiqueta: etiqueta.trim(), descripcion: descripcion.trim() });
      pushToast("Rol actualizado", "success");
      setEditando(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo actualizar el rol", "danger");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[0_1px_3px_rgba(12,12,12,.04)]">
      {ROLES.map((r, idx) => (
        <div key={r} className={`flex items-start gap-3 px-4 py-3 ${idx !== ROLES.length - 1 ? "border-b border-divider" : ""}`}>
          {editando === r ? (
            <>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Input autoFocus value={etiqueta} maxLength={40} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Nombre del rol" aria-label="Nombre del rol" className="h-9" />
                <Input value={descripcion} maxLength={200} onChange={(e) => setDescripcion(e.target.value)} placeholder="Qué puede hacer" aria-label="Descripción del rol" className="h-9" onKeyDown={(e) => { if (e.key === "Enter") guardar(r); if (e.key === "Escape") setEditando(null); }} />
              </div>
              <RowAction label="Guardar" onClick={() => guardar(r)} disabled={guardando}><Check size={14} strokeWidth={2} /></RowAction>
              <RowAction label="Cancelar" onClick={() => setEditando(null)}><X size={14} strokeWidth={2} /></RowAction>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge bg={ROL_COLORS[r].bg} color={ROL_COLORS[r].c}>{labels[r]}</Badge>
                  <span className="font-mono text-[10.5px] text-text-3">{r}</span>
                </div>
                <p className="mt-1 text-[12.5px] text-text-2">{descripciones[r]}</p>
              </div>
              <RowAction label="Editar" onClick={() => empezar(r)}><Pencil size={13} strokeWidth={1.8} /></RowAction>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
