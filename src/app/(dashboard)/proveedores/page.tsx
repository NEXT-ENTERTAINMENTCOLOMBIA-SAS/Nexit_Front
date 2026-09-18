"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FolderOpen, LayoutGrid, Pencil, Rows3 } from "lucide-react";
import {
  ActiveFilters,
  Avatar,
  Badge,
  CountryBadge,
  Dropdown,
  EmptyState,
  Pagination,
  StatCard,
  Stars,
  TabButton,
  TabsShell,
  Tag,
  type FilterChip,
} from "@/components/ui/primitives";
import { DeleteOrRequestButton } from "@/components/ui/DeleteAction";
import { Spinner } from "@/components/ui/Spinner";
import { RowAction, Table, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { PROVIDER_STATUS_COLORS, statusColor } from "@/lib/constants";
import { useAuthStore } from "@/store/auth-store";
import { useCatalogosStore } from "@/store/catalogos-store";
import { usePageToolbarStore } from "@/store/page-toolbar-store";
import { useProvidersStore } from "@/store/providers-store";
import { readFilterState, writeFilterState } from "@/lib/use-filter-state";
import type { SearchSuggestion } from "@/store/page-toolbar-store";
import { useGridColumns } from "@/lib/use-grid-columns";
import { useUiStore } from "@/store/ui-store";
import { proveedoresApi } from "@/services/api/proveedores-service";
import { proveedorAdjuntosApi } from "@/services/api/proveedor-adjuntos-service";
import type { PendingAttachment } from "@/components/ui/EntityAttachments";
import type { Proveedor, ProveedorInput } from "@/types/api";
import { ProviderCard } from "./ProviderCard";
import { ProviderFormModal } from "./ProviderFormModal";
import { ProviderDetail } from "./ProviderDetail";
import styles from "@/styles/dashboard.module.css";

export default function ProveedoresPage() {
  const {
    items: providers,
    loading,
    error,
    fetchAll,
    refresh,
    addProvider,
    updateProvider,
    removeProvider,
  } = useProvidersStore();
  const { paises, categoriasProveedor, estadosProveedor, regionesPorPais, ciudadesPorRegion, fetchBase, fetchRegiones, fetchCiudades } =
    useCatalogosStore();
  const pushToast = useUiStore((s) => s.pushToast);
  const authUser = useAuthStore((s) => s.user);
  const setToolbar = usePageToolbarStore((s) => s.setToolbar);
  const clearToolbar = usePageToolbarStore((s) => s.clearToolbar);
  const esAdmin = authUser?.rol === "admin" || authUser?.rol === "super_admin";

  useEffect(() => {
    fetchAll();
    fetchBase();
  }, [fetchAll, fetchBase]);

  // Precarga región/ciudad de cada país/región presente en la lista -- así tarjetas y tabla
  // resuelven "Ciudad · Departamento · País" sin que cada una pida su propio fetch (igual que
  // en Clientes: fetchRegiones/fetchCiudades cachean por id, repetir la llamada no cuesta nada).
  useEffect(() => {
    const paisIds = [...new Set(providers.map((p) => p.paisId).filter((id): id is string => Boolean(id)))];
    paisIds.forEach((id) => fetchRegiones(id));
  }, [providers, fetchRegiones]);

  useEffect(() => {
    const regionIds = [...new Set(providers.map((p) => p.regionId).filter((id): id is string => Boolean(id)))];
    regionIds.forEach((id) => fetchCiudades(id));
  }, [providers, fetchCiudades]);

  const [search, setSearch] = useState("");
  const [filtPais, setFiltPais] = useState("");
  const [filtRegion, setFiltRegion] = useState("");
  const [filtCiudad, setFiltCiudad] = useState("");
  const [filtCat, setFiltCat] = useState("");
  const [filtEstado, setFiltEstado] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  // Columnas de la grilla de tarjetas calculadas para llenar el ancho
  // disponible sin franja vacía, con o sin el riel expandido (Alicia
  // 2026-09-08) -- ver use-grid-columns.ts.
  const { ref: cardsGridRef, columns: cardsGridColumns } = useGridColumns();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [pendingAdjuntos, setPendingAdjuntos] = useState<PendingAttachment[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Autoguardado de filtros (Alicia 2026-09-07): restaura lo que había
  // quedado filtrado/buscado la última vez en esta pantalla, en esta misma
  // sesión del navegador (ver src/lib/use-filter-state.ts). Incluye
  // "Mis proveedores" -- si ya no aplica (0 favoritos) el efecto de arriba
  // que lo apaga automáticamente sigue funcionando igual.
  useEffect(() => {
    const saved = readFilterState<{
      search: string;
      filtPais: string;
      filtRegion: string;
      filtCiudad: string;
      filtCat: string;
      filtEstado: string;
      view: "cards" | "table";
    }>("proveedores");
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura filtros guardados una sola vez al montar, no es un ciclo de sincronizacion
    if (saved.search !== undefined) setSearch(saved.search);
    if (saved.filtPais !== undefined) setFiltPais(saved.filtPais);
    if (saved.filtRegion !== undefined) setFiltRegion(saved.filtRegion);
    if (saved.filtCiudad !== undefined) setFiltCiudad(saved.filtCiudad);
    if (saved.filtCat !== undefined) setFiltCat(saved.filtCat);
    if (saved.filtEstado !== undefined) setFiltEstado(saved.filtEstado);
    // Alicia 2026-09-08: NO restauramos `view` (Tarjetas/Tabla) desde la sesion
    // guardada. Esto era la causa real de "me aparece una tarjeta supergrande":
    // cada pantalla (Clientes/Proveedores/Proyectos) recordaba su propia vista
    // por separado en sessionStorage, asi que si en algun momento quedaba en
    // "Tabla" en una pantalla y en "Tarjetas" en otra, al entrar se veian
    // distintas entre si -- y las filas de la vista Tabla (una por fila, ancho
    // completo) se confundian con una tarjeta gigante rota. Los demas filtros
    // (busqueda, estado, etc.) SI se siguen restaurando; la vista simplemente
    // siempre arranca en "Tarjetas" para que las tres pantallas se vean iguales.
     
  }, []);

  useEffect(() => {
    writeFilterState("proveedores", {
      search,
      filtPais,
      filtRegion,
      filtCiudad,
      filtCat,
      filtEstado,
      view,
    });
  }, [search, filtPais, filtRegion, filtCiudad, filtCat, filtEstado, view]);

  useEffect(() => {
    function onGlobalSearch(event: Event) {
      setSearch((event as CustomEvent<string>).detail);
    }
    window.addEventListener("nexit:search", onGlobalSearch);
    return () => window.removeEventListener("nexit:search", onGlobalSearch);
  }, []);

  useEffect(() => {
    setToolbar({
      entidad: "proveedores",
      searchPlaceholder: "Buscar proveedor, categoría, ciudad o contacto…",
      puedeImportar: esAdmin,
      onExport: proveedoresApi.exportar,
      onImport: proveedoresApi.importar,
      onImported: refresh,
      addLabel: "Nuevo proveedor",
      onAdd: () => {
        setEditing(null);
        setPendingAdjuntos([]);
        setFormOpen(true);
      },
      // Buscador más inteligente (Alicia 2026-09-18), mismo criterio que Clientes: el nombre que
      // empieza igual que lo escrito manda primero.
      getSuggestions: (query) => {
        const q = query.toLowerCase();
        return providers
          .map((p) => {
            const nombre = p.nombre?.toLowerCase() ?? "";
            const categoria = categoriasProveedor.find((cat) => cat.id === p.categoriaId)?.nombre;
            const rank = nombre.startsWith(q) ? 0 : nombre.includes(q) ? 1 : [categoria, p.contacto].some((v) => v?.toLowerCase().includes(q)) ? 2 : -1;
            return { p, categoria, rank };
          })
          .filter((x) => x.rank >= 0)
          .sort((a, b) => a.rank - b.rank || a.p.nombre.localeCompare(b.p.nombre))
          .slice(0, 8)
          .map(({ p, categoria }): SearchSuggestion => ({
            id: p.id,
            label: p.nombre,
            sublabel: [categoria, p.contacto].filter(Boolean).join(" · ") || undefined,
          }));
      },
      onSelectSuggestion: (s) => setDetailId(s.id),
    });
    return clearToolbar;
  }, [providers, categoriasProveedor, clearToolbar, esAdmin, refresh, setToolbar]);

  const regionOptions = useMemo(() => regionesPorPais[filtPais] ?? [], [regionesPorPais, filtPais]);
  const cityOptions = useMemo(() => ciudadesPorRegion[filtRegion] ?? [], [ciudadesPorRegion, filtRegion]);

  function handleFiltPais(v: string) {
    setFiltPais(v);
    setFiltRegion("");
    setFiltCiudad("");
    if (v) fetchRegiones(v);
  }

  function handleFiltRegion(v: string) {
    setFiltRegion(v);
    setFiltCiudad("");
    if (v) fetchCiudades(v);
  }

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return providers.filter((p) => {
      const matchesSearch =
        !s ||
        [p.nombre, p.contacto, ...p.telefonos.map((t) => t.telefono), ...p.emails.map((e) => e.email)].some((v) => v?.toLowerCase().includes(s));
      const matchesPais = !filtPais || p.paisId === filtPais;
      const matchesRegion = !filtRegion || p.regionId === filtRegion;
      const matchesCiudad = !filtCiudad || p.ciudadId === filtCiudad;
      const matchesCat = !filtCat || p.categoriaId === filtCat;
      const matchesEstado = !filtEstado || p.estado === filtEstado;
      return matchesSearch && matchesPais && matchesRegion && matchesCiudad && matchesCat && matchesEstado;
    });
  }, [providers, search, filtPais, filtRegion, filtCiudad, filtCat, filtEstado]);

  // Vuelve a la página 1 cada vez que cambia el resultado filtrado -- si no, quedarse en la
  // página 3 con un filtro que deja solo 1 resultado mostraría una lista vacía sin explicación.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional al cambiar de filtro/vista, no una sincronización derivable sin efecto
    setPage(1);
  }, [search, filtPais, filtRegion, filtCiudad, filtCat, filtEstado, view]);

  const per = perPage === 0 ? Math.max(filtered.length, 1) : perPage;
  const totalPages = Math.max(1, Math.ceil(filtered.length / per));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * per, (currentPage - 1) * per + per);

  const stats = useMemo(() => {
    const total = providers.length;
    const inactivos = providers.filter((p) => p.estado === "Bloqueado").length;
    const paisesCount = new Set(providers.map((p) => p.paisId).filter(Boolean)).size;
    const conScore = providers.filter((p) => typeof p.score === "number");
    const avg = conScore.length ? conScore.reduce((a, b) => a + (b.score ?? 0), 0) / conScore.length : 0;
    return { total, inactivos, paisesCount, avg };
  }, [providers]);

  const chips: FilterChip[] = [
    search && { key: "search", label: `“${search}”` },
    filtPais && { key: "pais", label: paises.find((p) => p.id === filtPais)?.nombre ?? filtPais },
    filtRegion && { key: "region", label: regionOptions.find((r) => r.id === filtRegion)?.nombre ?? filtRegion },
    filtCiudad && { key: "ciudad", label: cityOptions.find((c) => c.id === filtCiudad)?.nombre ?? filtCiudad },
    filtCat && { key: "cat", label: categoriasProveedor.find((c) => c.id === filtCat)?.nombre ?? filtCat },
    filtEstado && { key: "estado", label: filtEstado },
  ].filter(Boolean) as FilterChip[];

  function removeChip(key: string) {
    if (key === "search") setSearch("");
    if (key === "pais") handleFiltPais("");
    if (key === "region") handleFiltRegion("");
    if (key === "ciudad") setFiltCiudad("");
    if (key === "cat") setFiltCat("");
    if (key === "estado") setFiltEstado("");
  }

  function clearAll() {
    setSearch("");
    setFiltPais("");
    setFiltRegion("");
    setFiltCiudad("");
    setFiltCat("");
    setFiltEstado("");
  }

  async function handleSave(input: ProveedorInput) {
    try {
      if (editing) {
        await updateProvider(editing.id, input);
        pushToast("Proveedor actualizado", "success");
        setFormOpen(false);
        setEditing(null);
      } else {
        const creado = await addProvider(input);
        // Sube/crea, uno por uno, los archivos y links agregados ANTES de guardar (Alicia
        // 2026-09-10) -- antes de pasar a modo edición, para que EntityAttachments ya los
        // encuentre ahí en su primera carga en vivo.
        for (const p of pendingAdjuntos) {
          try {
            if (p.tipo === "link" && p.url) await proveedorAdjuntosApi.crearLink(creado.id, { tipo: "link", nombre: p.nombre, url: p.url });
            else if (p.file) await proveedorAdjuntosApi.subirArchivo(creado.id, p.file);
          } catch (err) {
            pushToast(err instanceof Error ? err.message : `No se pudo subir "${p.nombre}"`, "danger");
          }
        }
        setPendingAdjuntos([]);
        pushToast("Proveedor agregado", "success");
        setEditing(creado);
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo guardar el proveedor", "danger");
    }
  }

  // El "¿Eliminar a X?" ya lo confirma el diálogo propio de DeleteOrRequestButton --
  // esto solo se llama después de que un admin confirma ahí.
  async function handleDelete(id: string) {
    try {
      await removeProvider(id);
      setDetailId(null);
      setFormOpen(false);
      setEditing(null);
      pushToast("Proveedor eliminado", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo eliminar el proveedor", "danger");
    }
  }

  const detailProvider = detailId ? (providers.find((p) => p.id === detailId) ?? null) : null;

  const paginationBar = (
    <Pagination
      total={filtered.length}
      page={currentPage}
      perPage={perPage}
      onPageChange={setPage}
      onPerPageChange={(n) => {
        setPerPage(n);
        setPage(1);
      }}
    />
  );

  return (
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-text-3">Base de datos</div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={styles.h1}>Gestión de proveedores</h1>
          <p className="mb-5 text-[13px] text-text-2">Cada proveedor con su cobertura, servicios y valoración.</p>
        </div>
        <TabsShell>
          <TabButton active={view === "cards"} icon={LayoutGrid} onClick={() => setView("cards")}>
            Tarjetas
          </TabButton>
          <TabButton active={view === "table"} icon={Rows3} onClick={() => setView("table")}>
            Tabla
          </TabButton>
        </TabsShell>
      </div>

      <div className={`mb-5 ${styles.kpis}`}>
        <StatCard n={stats.total} label="Total de proveedores" />
        <button
          type="button"
          onClick={() => setFiltEstado((v) => (v === "Bloqueado" ? "" : "Bloqueado"))}
          title="Ver solo los proveedores inactivos"
          className="min-h-[80px] cursor-pointer rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:border-text"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">Inactivos</div>
          <div className="mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.03em]" style={{ color: "#8A2525" }}>
            {stats.inactivos}
          </div>
        </button>
        <StatCard n={stats.paisesCount} label="Países donde trabajamos" />
        <div className="min-h-[80px] rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">Valoración promedio</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[28px] font-semibold leading-none tracking-[-0.03em]">{stats.avg.toFixed(1)}</span>
            <Stars n={Math.round(stats.avg)} size={14} />
          </div>
        </div>
      </div>

      <div className={`mb-4 ${styles.filtersPanel}`}>
        <div className={styles.filterControls}>
          <Dropdown
            value={filtPais}
            onChange={handleFiltPais}
            placeholder="Todos los países"
            options={paises.map((p) => ({ value: p.id, label: p.nombre }))}
          />
          <Dropdown
            value={filtRegion}
            onChange={handleFiltRegion}
            placeholder="Todos los departamentos"
            disabled={!filtPais}
            disabledHint="— elige país primero —"
            options={regionOptions.map((r) => ({ value: r.id, label: r.nombre }))}
          />
          <Dropdown
            value={filtCiudad}
            onChange={setFiltCiudad}
            placeholder="Todas las ciudades"
            disabled={!filtRegion}
            disabledHint="— elige departamento primero —"
            options={cityOptions.map((c) => ({ value: c.id, label: c.nombre }))}
          />
          <Dropdown
            value={filtCat}
            onChange={setFiltCat}
            placeholder="Todas las categorías"
            options={categoriasProveedor.map((c) => ({ value: c.id, label: c.nombre }))}
          />
          <Dropdown
            value={filtEstado}
            onChange={setFiltEstado}
            placeholder="Cualquier estado"
            options={estadosProveedor.map((e) => ({ value: e.nombre, label: e.nombre }))}
          />
        </div>

        <ActiveFilters chips={chips} onRemove={removeChip} onClearAll={clearAll} variant="panel" />
      </div>

      {loading && providers.length === 0 ? (
        <div className="flex justify-center py-14 text-text-2">
          <Spinner label="Cargando proveedores…" />
        </div>
      ) : error ? (
        <EmptyState icon={AlertTriangle} title={error} tone="danger" action={{ label: "Reintentar", onClick: fetchAll }} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No se encontraron proveedores con estos filtros." />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Antes vivía debajo de las tarjetas/tabla -- Alicia pidió subirla arriba,
             junto a los filtros, porque abajo quedaba pegada a la izquierda con
             mucho espacio muerto al lado cuando había pocos resultados. */}
          <div className="border-b border-border pb-3">{paginationBar}</div>
          {view === "cards" ? (
            <div
              ref={cardsGridRef}
              className={styles.cardsGrid}
              // display/gap tambien en linea (no solo en dashboard.module.css): si el CSS de
              // esta ruta todavia no llego cuando se pinta el primer frame despues del login,
              // el contenedor no debe caer a bloque apilado de ancho completo mientras tanto
              // (ver el comentario 2026-09-18 en use-grid-columns.ts).
              style={{ display: "grid", gap: 12, gridTemplateColumns: `repeat(${cardsGridColumns}, minmax(0, 1fr))` }}
            >
              {pageRows.map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  onOpen={() => setDetailId(p.id)}
                  onEdit={() => {
                    setEditing(p);
                    setFormOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <Table>
              <Thead>
                <Th>Proveedor</Th>
                <Th>Categoría</Th>
                <Th>Ubicación</Th>
                <Th>Estado</Th>
                <Th>Contacto</Th>
                <Th className="text-right">Acciones</Th>
              </Thead>
              <tbody>
                {pageRows.map((p) => {
                  const sc = statusColor(PROVIDER_STATUS_COLORS, p.estado);
                  const paisNombre = paises.find((x) => x.id === p.paisId)?.nombre;
                  const regionNombre = regionesPorPais[p.paisId ?? ""]?.find((r) => r.id === p.regionId)?.nombre;
                  const ciudadNombre = ciudadesPorRegion[p.regionId ?? ""]?.find((c) => c.id === p.ciudadId)?.nombre;
                  const categoriaNombre = categoriasProveedor.find((c) => c.id === p.categoriaId)?.nombre;
                  const ubicacion = [ciudadNombre, regionNombre, paisNombre].filter(Boolean).join(" · ");
                  return (
                    <Tr key={p.id} onClick={() => setDetailId(p.id)}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar nombre={p.nombre} size="sm" />
                          <span className="font-medium">{p.nombre}</span>
                        </div>
                      </Td>
                      <Td className="text-text-2">{categoriaNombre || "—"}</Td>
                      <Td className="text-text-2">
                        {ubicacion ? (
                          <span className="flex items-center gap-1.5">
                            <CountryBadge pais={paisNombre} /> {ubicacion}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        <Badge bg={sc.bg} color={sc.c}>
                          {p.estado}
                        </Badge>
                      </Td>
                      <Td className="text-text-2">
                        {p.contacto || "—"}
                        {p.contacto && p.cargoContacto && <Tag className="ml-1.5">{p.cargoContacto}</Tag>}
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1.5">
                          <RowAction
                            label="Editar este proveedor"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(p);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil size={14} strokeWidth={1.8} />
                          </RowAction>
                          <DeleteOrRequestButton
                            compact
                            tipoEntidad="proveedor"
                            entidadId={p.id}
                            nombre={p.nombre}
                            onDelete={() => handleDelete(p.id)}
                          />
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>
      )}

      <ProviderFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setPendingAdjuntos([]);
        }}
        onSave={handleSave}
        onDelete={() => editing && handleDelete(editing.id)}
        editing={editing}
        pendingAdjuntos={pendingAdjuntos}
        onPendingAdjuntosChange={setPendingAdjuntos}
      />

      <ProviderDetail
        provider={detailProvider}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          // Ver el comentario equivalente en clientes/page.tsx: cerrar el detalle
          // al abrir editar evita que los dos drawers queden montados a la vez.
          setDetailId(null);
          setEditing(detailProvider);
          setFormOpen(true);
        }}
      />
    </div>
  );
}
