"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/form";
import { RowAction } from "@/components/ui/Table";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useUiStore } from "@/store/ui-store";
import { ReorderButtons } from "./ReorderButtons";
import type { EstadoProyecto } from "@/types/api";

/**
 * Fases de proyecto (fijas -- solo se les cambia el nombre, no se crean/eliminan) y, dentro de
 * cada una, sus estados (estos sí se crean/editan/eliminan, con un `orden` que decide en qué
 * posición aparecen dentro de esa fase -- mismo `orden` que ya usa el Dropdown de "Estado del
 * proyecto" agrupado por fase en ProjectFormModal).
 *
 * Rediseño 2026-09-10: la v1 pedía escribir el número de orden a mano, tanto al agregar como al
 * editar -- fácil de repetir sin querer el mismo número que un vecino, y nada rápido para
 * reordenar varios de una vez. Ahora un estado nuevo siempre entra al final de su fase, y para
 * moverlo se usan las flechas de `ReorderButtons` (intercambian el orden con el vecino y guardan
 * al toque) -- el número de orden ya no es algo que la persona escribe, es una consecuencia de
 * dónde arrastra... o más bien empuja, la fila.
 */
export function EstadosProyectoSection() {
  const { fasesProyecto, estadosProyecto, updateFase, addEstadoProyecto, updateEstadoProyecto, removeCatalogo } = useCatalogosStore();
  const pushToast = useUiStore((s) => s.pushToast);

  const [editandoFase, setEditandoFase] = useState<number | null>(null);
  const [faseNombreDraft, setFaseNombreDraft] = useState("");

  const [nuevoNombrePorFase, setNuevoNombrePorFase] = useState<Record<number, string>>({});
  const [addingFase, setAddingFase] = useState<number | null>(null);

  const [editandoEstado, setEditandoEstado] = useState<EstadoProyecto | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [aEliminar, setAEliminar] = useState<EstadoProyecto | null>(null);
  const [moviendoId, setMoviendoId] = useState<string | null>(null);

  async function saveFase(fase: number) {
    if (!faseNombreDraft.trim()) return;
    try {
      await updateFase(fase, faseNombreDraft.trim());
      setEditandoFase(null);
      pushToast("Fase actualizada", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo actualizar la fase", "danger");
    }
  }

  async function handleAdd(fase: number) {
    const nombre = (nuevoNombrePorFase[fase] ?? "").trim();
    if (!nombre) return;
    const deLaFase = estadosProyecto.filter((e) => e.fase === fase);
    const orden = deLaFase.length === 0 ? 1 : Math.max(...deLaFase.map((e) => e.orden)) + 1;
    setAddingFase(fase);
    try {
      await addEstadoProyecto({ nombre, fase, orden });
      setNuevoNombrePorFase((s) => ({ ...s, [fase]: "" }));
      pushToast("Estado agregado", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo agregar el estado", "danger");
    } finally {
      setAddingFase(null);
    }
  }

  function startEditEstado(e: EstadoProyecto) {
    setEditandoEstado(e);
    setEditNombre(e.nombre);
  }

  async function saveEditEstado() {
    if (!editandoEstado || !editNombre.trim()) return;
    setSavingEdit(true);
    try {
      await updateEstadoProyecto(editandoEstado.id, { nombre: editNombre.trim(), fase: editandoEstado.fase, orden: editandoEstado.orden });
      setEditandoEstado(null);
      pushToast("Estado actualizado", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo actualizar el estado", "danger");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!aEliminar) return;
    try {
      await removeCatalogo("estados-proyecto", aEliminar.id);
      pushToast("Estado eliminado", "success");
      setAEliminar(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo eliminar -- puede haber proyectos en ese estado", "danger");
    }
  }

  async function mover(fase: number, e: EstadoProyecto, direccion: -1 | 1) {
    const deLaFase = estadosProyecto.filter((x) => x.fase === fase).sort((a, b) => a.orden - b.orden);
    const idx = deLaFase.findIndex((x) => x.id === e.id);
    const vecino = deLaFase[idx + direccion];
    if (!vecino) return;
    setMoviendoId(e.id);
    try {
      await Promise.all([
        updateEstadoProyecto(e.id, { nombre: e.nombre, fase: e.fase, orden: vecino.orden }),
        updateEstadoProyecto(vecino.id, { nombre: vecino.nombre, fase: vecino.fase, orden: e.orden }),
      ]);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo mover -- vuelve a intentar", "danger");
    } finally {
      setMoviendoId(null);
    }
  }

  const fasesOrdenadas = [...fasesProyecto].sort((a, b) => a.fase - b.fase);

  return (
    <div className="flex flex-col gap-6">
      {fasesOrdenadas.map((f) => {
        const estados = estadosProyecto.filter((e) => e.fase === f.fase).sort((a, b) => a.orden - b.orden);
        return (
          <div key={f.fase}>
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-xs text-[#00a85a]">Fase {f.fase}</span>
              {editandoFase === f.fase ? (
                <>
                  <Input autoFocus value={faseNombreDraft} onChange={(e) => setFaseNombreDraft(e.target.value)} className="h-8 max-w-[220px]" />
                  <RowAction label="Guardar" onClick={() => saveFase(f.fase)}><Check size={13} strokeWidth={2} /></RowAction>
                  <RowAction label="Cancelar" onClick={() => setEditandoFase(null)}><X size={13} strokeWidth={2} /></RowAction>
                </>
              ) : (
                <>
                  <span className="text-[15px] font-semibold text-text">{f.nombre}</span>
                  <RowAction label="Editar nombre de la fase" onClick={() => { setEditandoFase(f.fase); setFaseNombreDraft(f.nombre); }}>
                    <Pencil size={12} strokeWidth={1.8} />
                  </RowAction>
                  <span className="ml-auto text-xs text-text-3">{estados.length} {estados.length === 1 ? "estado" : "estados"}</span>
                </>
              )}
            </div>

            <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface transition-shadow hover:shadow-[0_1px_6px_rgba(12,12,12,.05)]">
              <div className="flex items-center gap-2 border-b border-[#EFEDE7] bg-gray-light px-4 py-2.5">
                <Input
                  value={nuevoNombrePorFase[f.fase] ?? ""}
                  onChange={(e) => setNuevoNombrePorFase((s) => ({ ...s, [f.fase]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(f.fase); } }}
                  placeholder={`Nuevo estado en ${f.nombre}…`}
                  className="h-9 flex-1 bg-surface"
                />
                <RowAction label="Agregar" onClick={() => handleAdd(f.fase)} disabled={addingFase === f.fase || !(nuevoNombrePorFase[f.fase] ?? "").trim()}>
                  <Plus size={14} strokeWidth={2} />
                </RowAction>
              </div>

              {estados.length === 0 && <div className="px-4 py-3.5 text-sm text-text-3">Sin estados en esta fase todavía.</div>}
              {estados.map((e, idx) => (
                <div key={e.id} className={`flex items-center gap-2 px-4 py-2.5 ${idx !== estados.length - 1 ? "border-b border-[#EFEDE7]" : ""}`}>
                  {editandoEstado?.id === e.id ? (
                    <>
                      <Input
                        autoFocus
                        value={editNombre}
                        onChange={(ev) => setEditNombre(ev.target.value)}
                        onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); saveEditEstado(); } if (ev.key === "Escape") setEditandoEstado(null); }}
                        placeholder="Nombre"
                        className="h-9 flex-1"
                      />
                      <RowAction label="Guardar" onClick={saveEditEstado} disabled={savingEdit}><Check size={14} strokeWidth={2} /></RowAction>
                      <RowAction label="Cancelar" onClick={() => setEditandoEstado(null)}><X size={14} strokeWidth={2} /></RowAction>
                    </>
                  ) : (
                    <>
                      <ReorderButtons
                        onUp={() => mover(f.fase, e, -1)}
                        onDown={() => mover(f.fase, e, 1)}
                        disabledUp={idx === 0}
                        disabledDown={idx === estados.length - 1}
                        moving={moviendoId === e.id}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{e.nombre}</span>
                      <RowAction label="Editar" onClick={() => startEditEstado(e)}><Pencil size={13} strokeWidth={1.8} /></RowAction>
                      <RowAction label="Eliminar" tone="danger" onClick={() => setAEliminar(e)}><Trash2 size={13} strokeWidth={1.8} /></RowAction>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        open={!!aEliminar}
        title={`¿Eliminar "${aEliminar?.nombre}"?`}
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onClose={() => setAEliminar(null)}
      >
        Si algún proyecto está en este estado ahora mismo, el backend va a rechazar el borrado.
      </ConfirmDialog>
    </div>
  );
}
