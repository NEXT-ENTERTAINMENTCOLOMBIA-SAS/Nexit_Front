"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { normalizarBusqueda } from "@/components/ui/primitives";
import { RowAction } from "@/components/ui/Table";
import { Input } from "@/components/ui/form";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useUiStore } from "@/store/ui-store";
import { CatalogList } from "./CatalogList";
import type { Pais } from "@/types/api";

const BUSCADOR_DESDE = 6;

/**
 * Países -> regiones (departamentos/estados) -> ciudades, en cascada -- cada país trae su propia
 * "etiquetaRegion" (Alicia: Colombia usa "Departamento", México usa "Estado"), así que el segundo
 * nivel se rotula dinámicamente con eso en vez de un genérico "Región".
 *
 * Rediseño 2026-09-10 (Alicia: "mejorar ese diseño... que sea flexible y uno pueda trabajar
 * superfácil y rápido"): la v1 apilaba país -> regiones -> pastillas "Ver ciudades de X" ->
 * ciudades, uno debajo del otro, así que entre más se avanzaba más scroll hacía falta y el cuadro
 * para agregar quedaba cada vez más lejos. Ahora es un panel maestro-detalle de dos columnas fijas
 * (izquierda: países, siempre visible; derecha: el nivel actual con una migaja de pan arriba) --
 * ningún nivel empuja al siguiente hacia abajo, y regiones/ciudades reusan el mismo `CatalogList`
 * en modo `selectable` que ya usan los países, en vez de un control aparte (las pastillas).
 */
export function UbicacionesSection() {
  const { paises, regionesPorPais, ciudadesPorRegion, fetchRegiones, fetchCiudades, addPais, updatePais, addRegion, updateRegion, addCiudad, updateCiudad, removeCatalogo } =
    useCatalogosStore();
  const pushToast = useUiStore((s) => s.pushToast);

  const [paisIdSeleccionado, setPaisIdSeleccionado] = useState("");
  const [regionId, setRegionId] = useState("");
  const [busquedaPais, setBusquedaPais] = useState("");

  const [nuevoPaisNombre, setNuevoPaisNombre] = useState("");
  const [nuevoPaisEtiqueta, setNuevoPaisEtiqueta] = useState("");
  const [addingPais, setAddingPais] = useState(false);
  const [editandoPais, setEditandoPais] = useState<Pais | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editEtiqueta, setEditEtiqueta] = useState("");
  const [paisAEliminar, setPaisAEliminar] = useState<Pais | null>(null);

  // Arranca con el primer país ya elegido (2026-09-10): así la columna derecha nunca abre en
  // blanco a la espera de un clic -- entrar a Ubicaciones deja ver de una vez sus regiones. Se
  // deriva en el render (no en un efecto con setState) para no encadenar renders de más -- y de
  // paso, si el país elegido se borra, cae solo al primero que quede en vez de a un id fantasma.
  const paisId = paisIdSeleccionado && paises.some((p) => p.id === paisIdSeleccionado) ? paisIdSeleccionado : (paises[0]?.id ?? "");

  useEffect(() => {
    if (paisId) fetchRegiones(paisId);
  }, [paisId, fetchRegiones]);

  useEffect(() => {
    if (regionId) fetchCiudades(regionId);
  }, [regionId, fetchCiudades]);

  const paisActual = paises.find((p) => p.id === paisId) ?? null;
  const regiones = paisId ? (regionesPorPais[paisId] ?? []) : [];
  const regionActual = regiones.find((r) => r.id === regionId) ?? null;
  const ciudades = regionId ? (ciudadesPorRegion[regionId] ?? []) : [];

  const paisesVisibles = useMemo(() => {
    if (!busquedaPais.trim()) return paises;
    const q = normalizarBusqueda(busquedaPais);
    return paises.filter((p) => normalizarBusqueda(p.nombre).includes(q));
  }, [paises, busquedaPais]);

  /**
   * Plural de la etiqueta de región del país (Departamento/Estado/Región, texto libre que cada
   * país define -- ver Pais.etiquetaRegion). "+ es" a secas daba "departamentoes"/"estadoes"
   * (bug encontrado 2026-09-10 revisando el fix del scroll): en español, una palabra que termina
   * en vocal pluraliza con "s", no con "es". "región" es aparte porque pierde el acento al
   * pluralizar ("regiones", no "regiónes").
   */
  function pluralizarEtiqueta(etiqueta: string): string {
    const base = etiqueta.toLowerCase();
    if (base === "región") return "regiones";
    return /[aeiouáéíóú]$/.test(base) ? `${base}s` : `${base}es`;
  }

  function elegirPais(id: string) {
    setPaisIdSeleccionado(id);
    setRegionId("");
  }

  async function handleAddPais() {
    if (!nuevoPaisNombre.trim() || !nuevoPaisEtiqueta.trim()) return;
    setAddingPais(true);
    try {
      const creado = await addPais({ nombre: nuevoPaisNombre.trim(), etiquetaRegion: nuevoPaisEtiqueta.trim() });
      setNuevoPaisNombre("");
      setNuevoPaisEtiqueta("");
      elegirPais(creado.id);
      pushToast("País agregado", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo agregar el país", "danger");
    } finally {
      setAddingPais(false);
    }
  }

  function startEditPais(p: Pais) {
    setEditandoPais(p);
    setEditNombre(p.nombre);
    setEditEtiqueta(p.etiquetaRegion);
  }

  async function saveEditPais() {
    if (!editandoPais || !editNombre.trim() || !editEtiqueta.trim()) return;
    try {
      await updatePais(editandoPais.id, { nombre: editNombre.trim(), etiquetaRegion: editEtiqueta.trim() });
      setEditandoPais(null);
      pushToast("País actualizado", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo actualizar el país", "danger");
    }
  }

  async function confirmDeletePais() {
    if (!paisAEliminar) return;
    try {
      await removeCatalogo("paises", paisAEliminar.id);
      if (paisId === paisAEliminar.id) { setPaisIdSeleccionado(""); setRegionId(""); }
      pushToast("País eliminado", "success");
      setPaisAEliminar(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo eliminar -- puede tener ciudades o registros que dependen de él", "danger");
    }
  }

  return (
    <div className="flex flex-col gap-5 min-[1001px]:flex-row">
      {/* Columna izquierda: países -- siempre visible, no se mueve al elegir uno (2026-09-10). */}
      <div className="flex flex-col gap-2 min-[1001px]:w-[300px] min-[1001px]:flex-shrink-0">
        <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[0_1px_3px_rgba(12,12,12,.04)] transition-shadow hover:shadow-[0_2px_10px_rgba(12,12,12,.07)]">
          <div className="border-b border-[#EFEDE7] bg-gray-light px-3 py-2.5">
            <div className="flex gap-1.5">
              <Input
                value={nuevoPaisNombre}
                onChange={(e) => setNuevoPaisNombre(e.target.value)}
                placeholder="Nuevo país…"
                className="h-9 min-w-0 flex-1 bg-surface"
              />
              <div className="w-[140px] flex-shrink-0">
                <Input
                  value={nuevoPaisEtiqueta}
                  onChange={(e) => setNuevoPaisEtiqueta(e.target.value)}
                  placeholder="Ej. Departamento"
                  className="h-9 bg-surface"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddPais(); } }}
                />
              </div>
              <RowAction label="Agregar país" onClick={handleAddPais} disabled={addingPais || !nuevoPaisNombre.trim() || !nuevoPaisEtiqueta.trim()}>
                <Plus size={14} strokeWidth={2} />
              </RowAction>
            </div>
          </div>

          {paises.length > BUSCADOR_DESDE && (
            <div className="flex items-center gap-2 border-b border-[#EFEDE7] px-3 py-2">
              <Search size={13} strokeWidth={1.8} className="flex-shrink-0 text-text-3" />
              <input
                value={busquedaPais}
                onChange={(e) => setBusquedaPais(e.target.value)}
                placeholder="Buscar país…"
                className="h-6 flex-1 border-none bg-transparent text-[13px] text-text outline-none placeholder:text-text-3"
              />
            </div>
          )}

          <div className="max-h-[520px] overflow-y-auto">
            {paises.length === 0 && <div className="px-4 py-3.5 text-sm text-text-3">Sin países todavía.</div>}
            {paises.length > 0 && paisesVisibles.length === 0 && (
              <div className="px-4 py-3.5 text-sm text-text-3">Nada que coincida con &ldquo;{busquedaPais}&rdquo;.</div>
            )}
            {paisesVisibles.map((p, idx) => (
              <div key={p.id} className={`flex items-center gap-1.5 px-3 py-2.5 ${idx !== paisesVisibles.length - 1 ? "border-b border-[#EFEDE7]" : ""} ${paisId === p.id ? "bg-gray-light" : ""}`}>
                {editandoPais?.id === p.id ? (
                  <div className="flex w-full flex-col gap-1.5">
                    <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} placeholder="País" className="h-8" />
                    <div className="flex gap-1.5">
                      <Input value={editEtiqueta} onChange={(e) => setEditEtiqueta(e.target.value)} placeholder="Etiqueta de región" className="h-8 flex-1" />
                      <RowAction label="Guardar" onClick={saveEditPais}><Check size={13} strokeWidth={2} /></RowAction>
                      <RowAction label="Cancelar" onClick={() => setEditandoPais(null)}><X size={13} strokeWidth={2} /></RowAction>
                    </div>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => elegirPais(p.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left">
                      <MapPin size={13} strokeWidth={1.8} className={paisId === p.id ? "text-teal-mid" : "text-text-3"} />
                      <span className={`min-w-0 truncate text-[13px] ${paisId === p.id ? "font-semibold text-text" : ""}`}>{p.nombre}</span>
                      <ChevronRight size={13} strokeWidth={1.8} className="flex-shrink-0 text-text-3" />
                    </button>
                    <RowAction label="Editar" onClick={() => startEditPais(p)}><Pencil size={13} strokeWidth={1.8} /></RowAction>
                    <RowAction label="Eliminar" tone="danger" onClick={() => setPaisAEliminar(p)}><Trash2 size={13} strokeWidth={1.8} /></RowAction>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="px-0.5 text-xs text-text-3">{paises.length} países</div>
      </div>

      {/* Columna derecha: el nivel actual (regiones o ciudades), con migaja de pan -- ya no crece
          hacia abajo con cada clic, solo cambia de contenido (2026-09-10). */}
      <div className="min-w-0 flex-1">
        {!paisId && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-border px-4 py-16 text-center">
            <MapPin size={22} strokeWidth={1.5} className="text-text-3" />
            <div className="text-[13px] text-text-2">Agrega un país a la izquierda para empezar a cargar sus regiones y ciudades.</div>
          </div>
        )}

        {paisId && !regionId && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-text-3">
              <span className="font-semibold text-text">{paisActual?.nombre}</span>
            </div>
            <CatalogList
              items={regiones.map((r) => ({ id: r.id, nombre: r.nombre }))}
              itemLabel={regiones.length === 1 ? (paisActual?.etiquetaRegion?.toLowerCase() ?? "región") : pluralizarEtiqueta(paisActual?.etiquetaRegion ?? "región")}
              placeholder={`Nuevo/a ${paisActual?.etiquetaRegion?.toLowerCase() ?? "región"}…`}
              emptyLabel={`Sin ${paisActual?.etiquetaRegion?.toLowerCase() ?? "regiones"} todavía.`}
              onAdd={(nombre) => addRegion({ paisId, nombre })}
              onUpdate={(id, nombre) => updateRegion(id, { paisId, nombre })}
              onRemove={(id) => removeCatalogo("regiones", id)}
              selectable
              selectedId={regionId || null}
              onSelect={(item) => setRegionId(item.id)}
            />
          </div>
        )}

        {paisId && regionId && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-text-3">
              <button type="button" onClick={() => setRegionId("")} className="cursor-pointer text-text-2 hover:text-text hover:underline">
                {paisActual?.nombre}
              </button>
              <ChevronRight size={11} strokeWidth={2} />
              <span className="font-semibold text-text">{regionActual?.nombre}</span>
            </div>
            <CatalogList
              items={ciudades.map((c) => ({ id: c.id, nombre: c.nombre }))}
              itemLabel={ciudades.length === 1 ? "ciudad" : "ciudades"}
              placeholder="Nueva ciudad…"
              emptyLabel="Sin ciudades todavía."
              onAdd={(nombre) => addCiudad({ regionId, nombre })}
              onUpdate={(id, nombre) => updateCiudad(id, { regionId, nombre })}
              onRemove={(id) => removeCatalogo("ciudades", id)}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!paisAEliminar}
        title={`¿Eliminar "${paisAEliminar?.nombre}"?`}
        confirmLabel="Eliminar"
        onConfirm={confirmDeletePais}
        onClose={() => setPaisAEliminar(null)}
      >
        Si tiene regiones o ciudades, o clientes/proveedores lo están usando, el backend va a rechazar el borrado.
      </ConfirmDialog>
    </div>
  );
}
