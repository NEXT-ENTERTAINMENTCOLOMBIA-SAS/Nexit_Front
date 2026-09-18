"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { normalizarBusqueda } from "@/components/ui/primitives";
import { RowAction } from "@/components/ui/Table";
import { Input } from "@/components/ui/form";
import { useUiStore } from "@/store/ui-store";
import type { ItemCatalogo } from "@/types/api";

/** A partir de cuántos ítems vale la pena mostrar el buscador -- mismo criterio que el Dropdown
 *  (`DROPDOWN_SEARCH_THRESHOLD`): con pocas opciones el campo solo estorba. */
const BUSCADOR_DESDE = 6;

/**
 * Lista editable genérica para un catálogo simple `{id, nombre}` -- categorías de proveedor,
 * servicios, regiones y ciudades tienen exactamente esta forma, así que comparten este componente
 * en vez de duplicar la misma tabla cuatro veces (Alicia 2026-09-09/10, pantalla de Configuración).
 *
 * Rediseño 2026-09-10 (Alicia: "mejorar ese diseño... que sea flexible y uno pueda trabajar
 * superfácil y rápido, sin problema ni inconveniente"): tres cambios de fondo sobre la v1 --
 * (1) agregar ahora es la PRIMERA fila, siempre a la vista, en vez de un cuadro aparte debajo de
 * toda la lista al que había que bajar con scroll cada vez; (2) buscador cuando hay más de
 * `BUSCADOR_DESDE` ítems, para no tener que leer una lista larga entera solo para encontrar uno;
 * (3) modo `selectable` opcional -- cuando una fila representa un nivel dentro de un drill-down
 * (regiones de un país, por ejemplo), hace doble función: se edita/elimina igual que cualquier
 * fila, y con un clic en el nombre se "entra" a ese nivel (resaltado + flecha), sin necesitar un
 * control aparte como las pastillas "Ver ciudades de X" que tenía la v1.
 */
export function CatalogList({
  items,
  itemLabel,
  placeholder,
  emptyLabel,
  onAdd,
  onUpdate,
  onRemove,
  selectable = false,
  selectedId = null,
  onSelect,
  accent = "var(--text)",
  accentLight = "var(--gray-light)",
}: {
  items: ItemCatalogo[];
  /** Nombre en plural de lo que contiene esta lista, para el contador ("12 categorías"). */
  itemLabel: string;
  placeholder: string;
  emptyLabel: string;
  onAdd: (nombre: string) => Promise<unknown>;
  onUpdate: (id: string, nombre: string) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  /** Cuando una fila también sirve para "entrar" a un nivel siguiente (regiones -> ciudades). */
  selectable?: boolean;
  selectedId?: string | null;
  onSelect?: (item: ItemCatalogo) => void;
  /** Color de acento del grupo de Configuración al que pertenece este catálogo (2026-09-18,
   *  Alicia: "el resto de cosas acá no están manejando la misma paleta de colores con el resto
   *  del sistema") -- tiñe la fila de "agregar" y la fila seleccionada con el mismo color del
   *  grupo activo en el riel, para que todo el panel se sienta de una sola pieza, no solo el
   *  encabezado de arriba. Con valores por defecto neutros para cualquier otro uso de esta lista
   *  que no pase estos props. */
  accent?: string;
  accentLight?: string;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [toDelete, setToDelete] = useState<ItemCatalogo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visibles = useMemo(() => {
    if (!busqueda.trim()) return items;
    const q = normalizarBusqueda(busqueda);
    return items.filter((item) => normalizarBusqueda(item.nombre).includes(q));
  }, [items, busqueda]);

  async function handleAdd() {
    if (!draft.trim()) return;
    setAdding(true);
    try {
      await onAdd(draft.trim());
      setDraft("");
      pushToast("Agregado", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo agregar", "danger");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(item: ItemCatalogo) {
    setEditingId(item.id);
    setEditDraft(item.nombre);
  }

  async function saveEdit(id: string) {
    if (!editDraft.trim()) return;
    setSavingEdit(true);
    try {
      await onUpdate(id, editDraft.trim());
      setEditingId(null);
      pushToast("Actualizado", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo actualizar", "danger");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await onRemove(toDelete.id);
      pushToast("Eliminado", "success");
      setToDelete(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo eliminar -- puede estar en uso todavía", "danger");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[0_1px_3px_rgba(12,12,12,.04)] transition-shadow hover:shadow-[0_2px_10px_rgba(12,12,12,.07)]">
        {/* Agregar es la primera fila -- siempre a la vista, sin bajar con scroll (2026-09-10). */}
        <div className="flex items-center gap-2 border-b border-[#EFEDE7] px-4 py-2.5" style={{ background: accentLight }}>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
            }}
            placeholder={placeholder}
            className="h-9 flex-1 bg-surface"
          />
          <RowAction label="Agregar" onClick={handleAdd} disabled={adding || !draft.trim()}>
            <Plus size={14} strokeWidth={2} />
          </RowAction>
        </div>

        {items.length > BUSCADOR_DESDE && (
          <div className="flex items-center gap-2 border-b border-[#EFEDE7] px-4 py-2">
            <Search size={13} strokeWidth={1.8} className="flex-shrink-0 text-text-3" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={`Buscar en ${items.length}…`}
              className="h-6 flex-1 border-none bg-transparent text-[13px] text-text outline-none placeholder:text-text-3"
            />
            <span className="flex-shrink-0 text-xs text-text-3">
              {visibles.length} de {items.length}
            </span>
          </div>
        )}

        {/* Región interna con scroll acotado (2026-09-10): antes esta lista crecía sin límite --
            con Colombia y sus ~32 departamentos, había que bajar toda la página para ver el
            último. Ahora el panel de agregar/buscar arriba se queda siempre a la vista y solo
            esta región hace scroll, como ya hacía la columna de países al lado. */}
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 && <div className="px-4 py-3.5 text-sm text-text-3">{emptyLabel}</div>}
          {items.length > 0 && visibles.length === 0 && (
            <div className="px-4 py-3.5 text-sm text-text-3">Nada que coincida con &ldquo;{busqueda}&rdquo;.</div>
          )}
          {visibles.map((item, idx) => (
          <div
            key={item.id}
            className={`flex items-center gap-2 px-4 py-2.5 ${idx !== visibles.length - 1 ? "border-b border-[#EFEDE7]" : ""}`}
            style={selectable && selectedId === item.id ? { background: accentLight } : undefined}
          >
            {editingId === item.id ? (
              <>
                <Input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveEdit(item.id); }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-9 flex-1"
                />
                <RowAction label="Guardar" onClick={() => saveEdit(item.id)} disabled={savingEdit}>
                  <Check size={14} strokeWidth={2} />
                </RowAction>
                <RowAction label="Cancelar" onClick={() => setEditingId(null)}>
                  <X size={14} strokeWidth={2} />
                </RowAction>
              </>
            ) : selectable ? (
              <>
                <button
                  type="button"
                  onClick={() => onSelect?.(item)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                >
                  <MapPin size={13} strokeWidth={1.8} className={selectedId !== item.id ? "text-text-3" : undefined} style={selectedId === item.id ? { color: accent } : undefined} />
                  <span className={`truncate text-[13px] ${selectedId === item.id ? "font-semibold text-text" : ""}`}>{item.nombre}</span>
                  <ChevronRight size={13} strokeWidth={1.8} className="flex-shrink-0 text-text-3" />
                </button>
                <RowAction label="Editar" onClick={() => startEdit(item)}>
                  <Pencil size={13} strokeWidth={1.8} />
                </RowAction>
                <RowAction label="Eliminar" tone="danger" onClick={() => setToDelete(item)}>
                  <Trash2 size={13} strokeWidth={1.8} />
                </RowAction>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-[13px]">{item.nombre}</span>
                <RowAction label="Editar" onClick={() => startEdit(item)}>
                  <Pencil size={13} strokeWidth={1.8} />
                </RowAction>
                <RowAction label="Eliminar" tone="danger" onClick={() => setToDelete(item)}>
                  <Trash2 size={13} strokeWidth={1.8} />
                </RowAction>
              </>
            )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-0.5 text-xs text-text-3">
        {items.length} {itemLabel}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title={`¿Eliminar "${toDelete?.nombre}"?`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      >
        Si ya hay clientes/proveedores/proyectos usando esto, el backend va a rechazar el borrado.
      </ConfirmDialog>
    </div>
  );
}
