"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, FolderKanban, Kanban, LayoutGrid, Rows3 } from "lucide-react";
import { ActiveFilters, Dropdown, EmptyState, Pagination, StatCard, TabButton, TabsShell, type FilterChip } from "@/components/ui/primitives";
import { SavedViews } from "@/components/ui/SavedViews";
import { SkeletonCards, SkeletonRows } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/store/auth-store";
import { usuariosApi } from "@/services/api/usuarios-service";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useClientesStore } from "@/store/clientes-store";
import { useProjectsStore } from "@/store/projects-store";
import { useProvidersStore } from "@/store/providers-store";
import { usePageToolbarStore, type SearchSuggestion } from "@/store/page-toolbar-store";
import { useUiStore } from "@/store/ui-store";
import { useOpciones } from "@/store/config-store";
import { readFilterState, writeFilterState } from "@/lib/use-filter-state";
import { useGridColumns } from "@/lib/use-grid-columns";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { proyectosApi } from "@/services/api/proyectos-service";
import { proyectoAdjuntosApi } from "@/services/api/proyecto-adjuntos-service";
import type { PendingAttachment } from "@/components/ui/EntityAttachments";
import type { AlertaProyecto, Proyecto, ProyectoInput, ProyectosPagina } from "@/types/api";
import { ProjectCard } from "./ProjectCard";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectDetail } from "./ProjectDetail";
import { ProyectosKanban } from "./ProyectosKanban";
import { ejecutivoDe, ProyectosTabla } from "./ProyectosTabla";
import { FILTROS_VACIOS, filtrosAUrl, filtrosDesdeUrl, type FiltrosProyecto } from "./filtros";
import styles from "@/styles/dashboard.module.css";

/** Tope de proyectos que baja el tablero (una sola consulta); si hay más, se avisa y se filtra. */
const MAX_TABLERO = 200;
const POR_PAGINA = [12, 24, 48, 100];

/** Convierte un proyecto guardado en lo que espera la API al editar (para mover de estado sin tocar el resto). */
function aInput(p: Proyecto, estadoId: string): ProyectoInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...resto } = p;
  void _id;
  void _c;
  void _u;
  return { ...resto, estadoId };
}

export default function ProyectosPage() {
  const { addProject, updateProject, removeProject } = useProjectsStore();
  const { items: providers, fetchAll: fetchProviders } = useProvidersStore();
  const { items: clientes, fetchAll: fetchClientes } = useClientesStore();
  const { estadosProyecto, fetchBase } = useCatalogosStore();
  const tiposProyecto = useOpciones("tipo-proyecto");
  const pushToast = useUiStore((s) => s.pushToast);
  const authUser = useAuthStore((s) => s.user);
  const setToolbar = usePageToolbarStore((s) => s.setToolbar);
  const clearToolbar = usePageToolbarStore((s) => s.clearToolbar);
  const esAdmin = authUser?.rol === "admin" || authUser?.rol === "super_admin";
  const searchParams = useSearchParams();

  const [filtros, setFiltros] = useState<FiltrosProyecto>(FILTROS_VACIOS);
  const [restaurado, setRestaurado] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(POR_PAGINA[0]);
  const [datos, setDatos] = useState<ProyectosPagina | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombresPm, setNombresPm] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Proyecto | null>(null);
  const [pendingAdjuntos, setPendingAdjuntos] = useState<PendingAttachment[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [extra, setExtra] = useState<Proyecto | null>(null);
  const { ref: cardsGridRef, columns: cardsGridColumns } = useGridColumns();

  const { search, estadoId, clienteId, tipo, pmId, alerta, vista } = filtros;
  const rows = useMemo(() => datos?.items ?? [], [datos]);
  const total = datos?.total ?? 0;
  const resumen = datos?.resumen;
  const set = useCallback(<K extends keyof FiltrosProyecto>(k: K, v: FiltrosProyecto[K]) => {
    setFiltros((f) => ({ ...f, [k]: v }));
    setPage(1);
  }, []);

  useEffect(() => {
    void fetchProviders();
    void fetchClientes();
    void fetchBase();
  }, [fetchProviders, fetchClientes, fetchBase]);

  // Filtros iniciales: primero los del enlace (para poder compartir), si no los de la última visita en esta sesión.
  useEffect(() => {
    const delEnlace = filtrosDesdeUrl(new URLSearchParams(window.location.search));
    const guardado = delEnlace ? null : readFilterState<FiltrosProyecto>("proyectos-v2");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura filtros una sola vez al montar
    setFiltros({ ...FILTROS_VACIOS, ...(guardado ?? {}), ...(delEnlace ?? {}), vista: delEnlace?.vista ?? "cards" });
    setRestaurado(true);
  }, []);

  // Cada cambio de filtro se refleja en el enlace y en la sesión.
  useEffect(() => {
    if (!restaurado) return;
    const qs = filtrosAUrl(filtros);
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    writeFilterState("proyectos-v2", { ...filtros });
  }, [filtros, restaurado]);

  // Abrir un proyecto por enlace (?open=ID), por ejemplo desde el buscador global.
  useEffect(() => {
    const openId = searchParams.get("open");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deep-link que abre el panel de detalle
    if (openId) setDetailId(openId);
  }, [searchParams]);

  // Buscador de la barra superior: filtra esta pantalla.
  useEffect(() => {
    function onGlobalSearch(event: Event) {
      set("search", (event as CustomEvent<string>).detail);
    }
    window.addEventListener("nexit:search", onGlobalSearch);
    return () => window.removeEventListener("nexit:search", onGlobalSearch);
  }, [set]);

  // --- Datos: una página (o el tablero) pedida al servidor con los filtros aplicados -----------------
  const pageSize = vista === "board" ? MAX_TABLERO : perPage;
  const peticion = useRef(0);
  const cargar = useCallback(
    async (silencioso = false) => {
      const id = ++peticion.current;
      if (!silencioso) setCargando(true);
      try {
        const r = await proyectosApi.pagina({ q: search, estadoId, clienteId, tipo, gerenteId: pmId, alerta, page: vista === "board" ? 1 : page, pageSize });
        if (id !== peticion.current) return; // llegó una respuesta vieja: se descarta
        setDatos(r);
        setError(null);
      } catch (err) {
        if (id === peticion.current) setError(err instanceof Error ? err.message : "No se pudieron cargar los proyectos.");
      } finally {
        if (id === peticion.current) setCargando(false);
      }
    },
    [search, estadoId, clienteId, tipo, pmId, alerta, vista, page, pageSize],
  );

  useEffect(() => {
    if (!restaurado) return;
    const id = window.setTimeout(() => void cargar(), search ? 250 : 0); // con texto se espera a que termine de escribir
    return () => window.clearTimeout(id);
  }, [cargar, restaurado, search]);

  // Cambios de otras personas: se actualiza al volver a la pestaña y cada minuto.
  useLiveRefresh(() => void cargar(true));

  // El detalle abierto por enlace puede no estar en la página actual: se pide por id.
  const enPagina = detailId ? rows.find((p) => p.id === detailId) : undefined;
  useEffect(() => {
    if (!detailId || enPagina) return;
    let vivo = true;
    proyectosApi
      .getById(detailId)
      .then((p) => vivo && setExtra(p))
      .catch(() => vivo && setDetailId(null));
    return () => {
      vivo = false;
    };
  }, [detailId, enPagina]);
  const detailProject = detailId ? (enPagina ?? (extra?.id === detailId ? extra : null)) : null;

  // Nombres de los Project Managers.
  useEffect(() => {
    let vivo = true;
    (esAdmin ? usuariosApi.list() : usuariosApi.equipo())
      .then((us) => vivo && setNombresPm(Object.fromEntries(us.map((u) => [u.id, `${u.nombre} ${u.apellido}`.trim()]))))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [esAdmin]);

  const clienteNombre = useCallback((id?: string | null) => clientes.find((c) => c.id === id)?.nombre, [clientes]);
  const pmNombre = useCallback((id?: string | null) => (id ? nombresPm[id] : undefined), [nombresPm]);
  const estadosOrdenados = useMemo(() => [...estadosProyecto].sort((a, b) => a.fase - b.fase || a.orden - b.orden), [estadosProyecto]);
  const estadoEnCursoId = estadosProyecto.find((e) => e.nombre === "En curso")?.id ?? "";
  const opcionesPm = useMemo(
    () => Object.entries(nombresPm).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "es")),
    [nombresPm],
  );

  useEffect(() => {
    setToolbar({
      entidad: "proyectos",
      searchPlaceholder: "Filtrar proyectos por nombre, cliente o ejecutivo…",
      puedeImportar: esAdmin,
      onExport: proyectosApi.exportar,
      onImport: proyectosApi.importar,
      onImported: () => void cargar(),
      addLabel: "Nuevo proyecto",
      onAdd: () => {
        setEditing(null);
        setPendingAdjuntos([]);
        setFormOpen(true);
      },
      // Sugerencias a partir de lo que ya está en pantalla; para buscar en TODO está Ctrl+K.
      getSuggestions: (query) => {
        const q = query.toLowerCase();
        return rows
          .filter((p) => p.nombre?.toLowerCase().includes(q) || ejecutivoDe(p).toLowerCase().includes(q))
          .slice(0, 8)
          .map((p): SearchSuggestion => ({ id: p.id, label: p.nombre, sublabel: [clienteNombre(p.clienteId), p.fechaEvento?.slice(0, 10)].filter(Boolean).join(" · ") || undefined }));
      },
      onSelectSuggestion: (s) => setDetailId(s.id),
    });
    return clearToolbar;
  }, [rows, clienteNombre, clearToolbar, esAdmin, cargar, setToolbar]);

  const hayFiltros = Boolean(search || estadoId || clienteId || tipo || pmId || alerta);
  const chips: FilterChip[] = [
    search && { key: "search", label: `“${search}”` },
    estadoId && { key: "estadoId", label: estadosProyecto.find((e) => e.id === estadoId)?.nombre ?? "" },
    clienteId && { key: "clienteId", label: clienteNombre(clienteId) ?? "" },
    tipo && { key: "tipo", label: tipo },
    pmId && { key: "pmId", label: `PM: ${nombresPm[pmId] ?? "Project Manager"}` },
    alerta && { key: "alerta", label: { sinPm: "Sin Project Manager", sinProveedor: "Sin proveedor", proximos7: "Evento en 7 días", proximos30: "Evento en 30 días" }[alerta] },
  ].filter(Boolean) as FilterChip[];

  function removeChip(key: string) {
    set(key as keyof FiltrosProyecto, "" as never);
  }
  function clearAll() {
    setFiltros((f) => ({ ...FILTROS_VACIOS, vista: f.vista }));
    setPage(1);
  }
  function alternarAlerta(a: AlertaProyecto) {
    set("alerta", alerta === a ? "" : a);
  }

  async function handleSave(input: ProyectoInput) {
    try {
      if (editing) {
        await updateProject(editing.id, input);
        pushToast("Proyecto actualizado", "success");
        setFormOpen(false);
        setEditing(null);
      } else {
        const creado = await addProject(input);
        for (const p of pendingAdjuntos) {
          try {
            if (p.tipo === "link" && p.url) await proyectoAdjuntosApi.crearLink(creado.id, { tipo: "link", nombre: p.nombre, url: p.url });
            else if (p.file) await proyectoAdjuntosApi.subirArchivo(creado.id, p.file);
          } catch (err) {
            pushToast(err instanceof Error ? err.message : `No se pudo subir "${p.nombre}"`, "danger");
          }
        }
        setPendingAdjuntos([]);
        pushToast("Proyecto agregado", "success");
        setEditing(creado);
      }
      void cargar(true);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo guardar el proyecto", "danger");
    }
  }

  async function handleDelete(id: string) {
    try {
      await removeProject(id);
      setDetailId(null);
      setFormOpen(false);
      setEditing(null);
      pushToast("Proyecto eliminado", "success");
      void cargar(true);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo eliminar el proyecto", "danger");
    }
  }

  // Tablero: mover una tarjeta de columna cambia el estado (se ve al instante y se revierte si el servidor lo rechaza).
  async function mover(p: Proyecto, nuevoEstadoId: string) {
    const antes = datos;
    setDatos((d) => (d ? { ...d, items: d.items.map((x) => (x.id === p.id ? { ...x, estadoId: nuevoEstadoId } : x)) } : d));
    try {
      await proyectosApi.update(p.id, aInput(p, nuevoEstadoId));
      pushToast(`“${p.nombre}” pasó a ${estadosProyecto.find((e) => e.id === nuevoEstadoId)?.nombre ?? "otro estado"}`, "success");
      void cargar(true);
    } catch (err) {
      setDatos(antes);
      pushToast(err instanceof Error ? err.message : "No se pudo cambiar el estado", "danger");
    }
  }

  function abrirEdicion(p: Proyecto) {
    setEditing(p);
    setFormOpen(true);
  }

  const paginationBar = (
    <Pagination total={total} page={page} perPage={perPage} perPageOptions={POR_PAGINA} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
  );
  const primeraCarga = cargando && !datos;

  return (
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-text-3">Operación</div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={styles.h1}>Gestión de proyectos</h1>
          <p className="mb-5 text-[13px] text-text-2">Cada evento con su cliente, equipo asignado, estado y proveedores vinculados.</p>
        </div>
        <div className="flex items-center gap-2">
          <SavedViews<FiltrosProyecto> clave="proyectos" actual={filtros} hayFiltros={hayFiltros} onApply={(f) => { setFiltros({ ...FILTROS_VACIOS, ...f }); setPage(1); }} />
          <TabsShell>
            <TabButton active={vista === "cards"} icon={LayoutGrid} onClick={() => set("vista", "cards")}>Tarjetas</TabButton>
            <TabButton active={vista === "table"} icon={Rows3} onClick={() => set("vista", "table")}>Tabla</TabButton>
            <TabButton active={vista === "board"} icon={Kanban} onClick={() => set("vista", "board")}>Tablero</TabButton>
          </TabsShell>
        </div>
      </div>

      {/* Tarjetas clicables: cada una es también un filtro rápido ("alerta"). */}
      <div className={`mb-5 ${styles.kpis5}`}>
        <KpiBoton activo={!hayFiltros} onClick={clearAll} etiqueta="Ver todos los proyectos"><StatCard n={resumen?.total ?? "—"} label="Total de proyectos" /></KpiBoton>
        <KpiBoton activo={Boolean(estadoEnCursoId) && estadoId === estadoEnCursoId} onClick={() => estadoEnCursoId && set("estadoId", estadoId === estadoEnCursoId ? "" : estadoEnCursoId)} etiqueta="Filtrar por En curso"><StatCard n={resumen?.enCurso ?? "—"} label="En curso" accent="#27500A" /></KpiBoton>
        <KpiBoton activo={alerta === "proximos7"} onClick={() => alternarAlerta("proximos7")} etiqueta="Filtrar eventos en los próximos 7 días"><StatCard n={resumen?.proximos7Dias ?? "—"} label="Evento en 7 días" accent="#7a4e00" /></KpiBoton>
        <KpiBoton activo={alerta === "sinProveedor"} onClick={() => alternarAlerta("sinProveedor")} etiqueta="Filtrar proyectos sin proveedor"><StatCard n={resumen?.sinProveedor ?? "—"} label="Sin proveedor" accent="#8A2525" /></KpiBoton>
        <KpiBoton activo={alerta === "sinPm"} onClick={() => alternarAlerta("sinPm")} etiqueta="Filtrar proyectos sin Project Manager"><StatCard n={resumen?.sinGerente ?? "—"} label="Sin Project Manager" accent="#8A2525" /></KpiBoton>
      </div>

      <div className={`mb-4 ${styles.filtersPanel}`}>
        <div className={styles.filterControls}>
          <Dropdown value={estadoId} onChange={(v) => set("estadoId", v)} placeholder="Cualquier estado" options={estadosOrdenados.map((e) => ({ value: e.id, label: e.nombre }))} />
          <Dropdown value={clienteId} onChange={(v) => set("clienteId", v)} placeholder="Todo cliente" options={clientes.map((c) => ({ value: c.id, label: c.nombre }))} />
          <Dropdown value={tipo} onChange={(v) => set("tipo", v)} placeholder="Cualquier tipo" options={tiposProyecto.map((t) => ({ value: t, label: t }))} />
          <Dropdown value={pmId} onChange={(v) => set("pmId", v)} placeholder="Cualquier Project Manager" options={opcionesPm} />
        </div>
        <ActiveFilters chips={chips} onRemove={removeChip} onClearAll={clearAll} variant="panel" />
      </div>

      {primeraCarga ? (
        vista === "table" ? <SkeletonRows /> : <SkeletonCards columns={cardsGridColumns} />
      ) : error && !datos ? (
        <EmptyState icon={AlertTriangle} title={error} tone="danger" action={{ label: "Reintentar", onClick: () => void cargar() }} />
      ) : rows.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No se encontraron proyectos con estos filtros." />
      ) : (
        <div className="flex flex-col gap-3">
          {vista === "board" ? (
            total > MAX_TABLERO && (
              <div className="rounded-[var(--radius-md)] border border-border bg-amber-light px-3 py-2 text-[12.5px] text-amber">
                El tablero muestra los {MAX_TABLERO} proyectos con evento más reciente de {total}. Usa los filtros para acotar.
              </div>
            )
          ) : (
            <div className="border-b border-border pb-3">{paginationBar}</div>
          )}
          {vista === "cards" && (
            <div ref={cardsGridRef} className={styles.cardsGrid} style={{ display: "grid", gap: 12, gridTemplateColumns: `repeat(${cardsGridColumns}, minmax(0, 1fr))`, opacity: cargando ? 0.6 : 1 }}>
              {rows.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={() => setDetailId(p.id)} onEdit={() => abrirEdicion(p)} />
              ))}
            </div>
          )}
          {vista === "table" && (
            <ProyectosTabla proyectos={rows} estados={estadosProyecto} clienteNombre={clienteNombre} onOpen={(p) => setDetailId(p.id)} onEdit={abrirEdicion} onDelete={handleDelete} />
          )}
          {vista === "board" && (
            <ProyectosKanban proyectos={rows} estados={estadosOrdenados} clienteNombre={clienteNombre} pmNombre={pmNombre} onOpen={(p) => setDetailId(p.id)} onMover={mover} />
          )}
        </div>
      )}

      <ProjectFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setPendingAdjuntos([]);
        }}
        onSave={handleSave}
        onDelete={() => editing && handleDelete(editing.id)}
        editing={editing}
        providers={providers}
        pendingAdjuntos={pendingAdjuntos}
        onPendingAdjuntosChange={setPendingAdjuntos}
      />

      <ProjectDetail
        project={detailProject}
        providers={providers}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          setDetailId(null);
          if (detailProject) abrirEdicion(detailProject);
        }}
      />
    </div>
  );
}

/** Envuelve una tarjeta de cifra para que se comporte como botón-filtro, con un anillo cuando está activa. */
function KpiBoton({ activo, onClick, etiqueta, children }: { activo: boolean; onClick: () => void; etiqueta: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo} aria-label={etiqueta} className={`block cursor-pointer rounded-[var(--radius-lg)] text-left outline-offset-2 ${activo ? "ring-2 ring-text" : ""}`}>
      {children}
    </button>
  );
}
