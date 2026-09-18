"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/form";
import { RowAction } from "@/components/ui/Table";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useUiStore } from "@/store/ui-store";
import { ReorderButtons } from "./ReorderButtons";
import type { EtapaCliente } from "@/types/api";

/**
 * Etapas del proceso comercial del cliente (E1-E6, docs/33) -- distinta de los estados de
 * proyecto: esta vive en el Cliente y cubre las etapas previas a que exista un brief. Cada etapa
 * tiene un `orden` (posición) y un `porcentajeProceso` (0-100, cuánto del proceso comercial
 * representa esa etapa -- lo que alimenta cualquier indicador de avance comercial).
 *
 * Rediseño 2026-09-10: mismo cambio que Estados de proyecto -- el `orden` ya no se escribe a
 * mano (ni al agregar ni al editar), se mueve con las flechas de `ReorderButtons`. El porcentaje
 * SÍ se sigue escribiendo: es un dato de negocio real (qué tanto del proceso representa esa
 * etapa), no una posición en una lista.
 */
export function EtapasClienteSection() {
  const { etapasCliente, addEtapaCliente, updateEtapaCliente, removeCatalogo } = useCatalogosStore();
  const pushToast = useUiStore((s) => s.pushToast);

  const [nombre, setNombre] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [adding, setAdding] = useState(false);

  const [editando, setEditando] = useState<EtapaCliente | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editPorcentaje, setEditPorcentaje] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [aEliminar, setAEliminar] = useState<EtapaCliente | null>(null);
  const [moviendoId, setMoviendoId] = useState<string | null>(null);

  const ordenadas = [...etapasCliente].sort((a, b) => a.orden - b.orden);

  async function handleAdd() {
    if (!nombre.trim()) return;
    setAdding(true);
    try {
      const orden = ordenadas.length === 0 ? 1 : Math.max(...ordenadas.map((e) => e.orden)) + 1;
      await addEtapaCliente({
        nombre: nombre.trim(),
        orden,
        porcentajeProceso: porcentaje.trim() ? Number(porcentaje) : 0,
      });
      setNombre("");
      setPorcentaje("");
      pushToast("Etapa agregada", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo agregar la etapa", "danger");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(e: EtapaCliente) {
    setEditando(e);
    setEditNombre(e.nombre);
    setEditPorcentaje(String(e.porcentajeProceso));
  }

  async function saveEdit() {
    if (!editando || !editNombre.trim()) return;
    setSavingEdit(true);
    try {
      await updateEtapaCliente(editando.id, {
        nombre: editNombre.trim(),
        orden: editando.orden,
        porcentajeProceso: editPorcentaje.trim() ? Number(editPorcentaje) : editando.porcentajeProceso,
      });
      setEditando(null);
      pushToast("Etapa actualizada", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo actualizar la etapa", "danger");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!aEliminar) return;
    try {
      await removeCatalogo("etapas-cliente", aEliminar.id);
      pushToast("Etapa eliminada", "success");
      setAEliminar(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo eliminar -- puede haber clientes en esa etapa", "danger");
    }
  }

  async function mover(e: EtapaCliente, direccion: -1 | 1) {
    const idx = ordenadas.findIndex((x) => x.id === e.id);
    const vecino = ordenadas[idx + direccion];
    if (!vecino) return;
    setMoviendoId(e.id);
    try {
      await Promise.all([
        updateEtapaCliente(e.id, { nombre: e.nombre, orden: vecino.orden, porcentajeProceso: e.porcentajeProceso }),
        updateEtapaCliente(vecino.id, { nombre: vecino.nombre, orden: e.orden, porcentajeProceso: vecino.porcentajeProceso }),
      ]);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo mover -- vuelve a intentar", "danger");
    } finally {
      setMoviendoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[0_1px_3px_rgba(12,12,12,.04)] transition-shadow hover:shadow-[0_2px_10px_rgba(12,12,12,.07)]">
        <div className="flex items-center gap-2 border-b border-[#EFEDE7] px-4 py-2.5" style={{ background: "var(--success-light)" }}>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            placeholder="Nueva etapa…"
            className="h-9 min-w-0 flex-1 bg-surface"
          />
          <div className="w-[130px] flex-shrink-0">
            <Input
              type="number"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="% del proceso"
              className="h-9 bg-surface"
            />
          </div>
          <RowAction label="Agregar" onClick={handleAdd} disabled={adding || !nombre.trim()}>
            <Plus size={14} strokeWidth={2} />
          </RowAction>
        </div>

        {ordenadas.length === 0 && <div className="px-4 py-3.5 text-sm text-text-3">Sin etapas todavía.</div>}
        {ordenadas.map((e, idx) => (
          <div key={e.id} className={`flex items-center gap-2 px-4 py-2.5 ${idx !== ordenadas.length - 1 ? "border-b border-[#EFEDE7]" : ""}`}>
            {editando?.id === e.id ? (
              <>
                <Input
                  autoFocus
                  value={editNombre}
                  onChange={(ev) => setEditNombre(ev.target.value)}
                  onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); saveEdit(); } if (ev.key === "Escape") setEditando(null); }}
                  placeholder="Nombre"
                  className="h-9 flex-1"
                />
                <div className="w-[80px] flex-shrink-0">
                  <Input type="number" value={editPorcentaje} onChange={(ev) => setEditPorcentaje(ev.target.value)} placeholder="%" className="h-9" />
                </div>
                <RowAction label="Guardar" onClick={saveEdit} disabled={savingEdit}><Check size={14} strokeWidth={2} /></RowAction>
                <RowAction label="Cancelar" onClick={() => setEditando(null)}><X size={14} strokeWidth={2} /></RowAction>
              </>
            ) : (
              <>
                <ReorderButtons
                  onUp={() => mover(e, -1)}
                  onDown={() => mover(e, 1)}
                  disabledUp={idx === 0}
                  disabledDown={idx === ordenadas.length - 1}
                  moving={moviendoId === e.id}
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">{e.nombre}</span>
                <span className="flex-shrink-0 rounded-[20px] bg-gray-light px-2 py-[3px] font-mono text-[11px] text-text-2">{e.porcentajeProceso}%</span>
                <RowAction label="Editar" onClick={() => startEdit(e)}><Pencil size={13} strokeWidth={1.8} /></RowAction>
                <RowAction label="Eliminar" tone="danger" onClick={() => setAEliminar(e)}><Trash2 size={13} strokeWidth={1.8} /></RowAction>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="px-0.5 text-xs text-text-3">{ordenadas.length} {ordenadas.length === 1 ? "etapa" : "etapas"}</div>

      <ConfirmDialog
        open={!!aEliminar}
        title={`¿Eliminar "${aEliminar?.nombre}"?`}
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onClose={() => setAEliminar(null)}
      >
        Si algún cliente está en esta etapa ahora mismo, el backend va a rechazar el borrado.
      </ConfirmDialog>
    </div>
  );
}
