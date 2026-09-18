"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, LayoutGrid, Pencil, Rows3 } from "lucide-react";
import {
  ActiveFilters,
  Avatar,
  Badge,
  Dropdown,
  EmptyState,
  Pagination,
  StatCard,
  TabButton,
  TabsShell,
  Tag,
  type FilterChip,
} from "@/components/ui/primitives";
import { DeleteOrRequestButton } from "@/components/ui/DeleteAction";
import { Spinner } from "@/components/ui/Spinner";
import { RowAction, Table, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { CLIENTE_ESTADOS, CLIENT_STATUS_COLORS, statusColor } from "@/lib/constants";
import { useAuthStore } from "@/store/auth-store";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useClientesStore } from "@/store/clientes-store";
import { readFilterState, writeFilterState } from "@/lib/use-filter-state";
import type { SearchSuggestion } from "@/store/page-toolbar-store";
import { useGridColumns } from "@/lib/use-grid-columns";
import { useProjectsStore } from "@/store/projects-store";
import { usePageToolbarStore } from "@/store/page-toolbar-store";
import { useUiStore } from "@/store/ui-store";
import { clientesApi } from "@/services/api/clientes-service";
import { clienteAdjuntosApi } from "@/services/api/cliente-adjuntos-service";
import type { PendingAttachment } from "@/components/ui/EntityAttachments";
import type { Cliente, ClienteInput } from "@/types/api";
import { ClienteCard } from "./ClienteCard";
import { ClienteFormModal } from "./ClienteFormModal";
import { ClienteDetail } from "./ClienteDetail";
import styles from "@/styles/dashboard.module.css";

export default function ClientesPage() {
  const { items: clientes, loading, error, fetchAll, refresh, addCliente, updateCliente, removeCliente } = useClientesStore();
  const { items: proyectos, fetchAll: fetchProyectos } = useProjectsStore();
  const { paises, regionesPorPais, ciudadesPorRegion, fetchBase, fetchRegiones, fetchCiudades } = useCatalogosStore();
  const pushToast = useUiStore((s) => s.pushToast);
  const authUser = useAuthStore((s) => s.user);
  const setToolbar = usePageToolbarStore((s) => s.setToolbar);
  const clearToolbar = usePageToolbarStore((s) => s.clearToolbar);
  const esAdmin = authUser?.rol === "admin" || authUser?.rol === "super_admin";

  useEffect(() => {
    fetchAll();
    fetchProyectos();
    fetchBase();
  }, [fetchAll, fetchProyectos, fetchBase]);

  // Precarga región/ciudad para cada país/región presente en la lista, así las tarjetas y la
  // tabla pueden resolver "Ciudad · Departamento · País" sin que cada una pida su propio fetch
  // (fetchRegiones/fetchCiudades cachean por id, así que repetir la llamada no cuesta nada).
  useEffect(() => {
    const paisIds = [...new Set(clientes.map((c) => c.paisId).filter((id): id is string => Boolean(id)))];
    paisIds.forEach((id) => fetchRegiones(id));
  }, [clientes, fetchRegiones]);

  useEffect(() => {
    const regionIds = [...new Set(clientes.map((c) => c.regionId).filter((id): id is string => Boolean(id)))];
    regionIds.forEach((id) => fetchCiudades(id));
  }, [clientes, fetchCiudades]);

  const [search, setSearch] = useState("");
  const [filtSector, setFiltSector] = useState("");
  const [filtEstado, setFiltEstado] = useState("");
  // Filtro por proyecto (Alicia 2026-09-18): un cliente puede tener uno o varios proyectos
  // asociados (Proyecto.clienteId) -- filtra la lista de clientes a los que tienen el
  // proyecto elegido.
  const [filtProyecto, setFiltProyecto] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  // Columnas de la grilla de tarjetas calculadas para llenar el ancho
  // disponible sin franja vacía, con o sin el riel expandido (Alicia
  // 2026-09-08) -- ver use-grid-columns.ts.
  const { ref: cardsGridRef, columns: cardsGridColumns } = useGridColumns();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [pendingAdjuntos, setPendingAdjuntos] = useState<PendingAttachment[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Autoguardado de filtros (Alicia 2026-09-07): restaura lo que había
  // quedado filtrado/buscado la última vez en esta pantalla, en esta misma
  // sesión del navegador (ver src/lib/use-filter-state.ts).
  useEffect(() => {
    const saved = readFilterState<{
      search: string;
      filtSector: string;
      filtEstado: string;
      filtProyecto: string;
      view: "cards" | "table";
    }>("clientes");
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura filtros guardados una sola vez al montar, no es un ciclo de sincronizacion
    if (saved.search !== undefined) setSearch(saved.search);
    if (saved.filtSector !== undefined) setFiltSector(saved.filtSector);
    if (saved.filtEstado !== undefined) setFiltEstado(saved.filtEstado);
    if (saved.filtProyecto !== undefined) setFiltProyecto(saved.filtProyecto);
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
    writeFilterState("clientes", { search, filtSector, filtEstado, filtProyecto, view });
  }, [search, filtSector, filtEstado, filtProyecto, view]);

  useEffect(() => {
    function onGlobalSearch(event: Event) {
      setSearch((event as CustomEvent<string>).detail);
    }
    window.addEventListener("nexit:search", onGlobalSearch);
    return () => window.removeEventListener("nexit:search", onGlobalSearch);
  }, []);

  useEffect(() => {
    setToolbar({
      entidad: "clientes",
      searchPlaceholder: "Buscar cliente, contacto o ciudad…",
      puedeImportar: esAdmin,
      onExport: clientesApi.exportar,
      onImport: clientesApi.importar,
      onImported: refresh,
      addLabel: "Nuevo cliente",
      onAdd: () => {
        setEditing(null);
        setPendingAdjuntos([]);
        setFormOpen(true);
      },
      // Buscador más inteligente (Alicia 2026-09-18): sugerencias apenas se escribe, no solo
      // filtrar la lista de abajo -- el nombre que empieza igual que lo escrito manda primero.
      getSuggestions: (query) => {
        const q = query.toLowerCase();
        return clientes
          .map((c) => {
            const nombre = c.nombre?.toLowerCase() ?? "";
            const rank = nombre.startsWith(q) ? 0 : nombre.includes(q) ? 1 : [c.sector, c.ciudad, c.contacto].some((v) => v?.toLowerCase().includes(q)) ? 2 : -1;
            return { c, rank };
          })
          .filter((x) => x.rank >= 0)
          .sort((a, b) => a.rank - b.rank || a.c.nombre.localeCompare(b.c.nombre))
          .slice(0, 8)
          .map(({ c }): SearchSuggestion => ({
            id: c.id,
            label: c.nombre,
            sublabel: [c.sector, c.ciudad].filter(Boolean).join(" · ") || undefined,
          }));
      },
      onSelectSuggestion: (s) => setDetailId(s.id),
    });
    return clearToolbar;
  }, [clientes, clearToolbar, esAdmin, refresh, setToolbar]);

  const sectores = useMemo(
    () => [...new Set(clientes.map((c) => c.sector).filter((s): s is string => Boolean(s)))].sort(),
    [clientes],
  );

  // Clientes que tienen el proyecto elegido asociado (Proyecto.clienteId) -- un proyecto sin
  // clienteId no cuenta para ningún cliente.
  const clienteIdsPorProyecto = useMemo(() => {
    if (!filtProyecto) return null;
    return new Set(proyectos.filter((p) => p.id === filtProyecto && p.clienteId).map((p) => p.clienteId as string));
  }, [proyectos, filtProyecto]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return clientes.filter((c) => {
      const matchesSearch =
        !s ||
        [c.nombre, c.sector, c.ciudad, c.contacto, ...c.telefonos.map((t) => t.telefono), ...c.emails.map((e) => e.email)].some((v) =>
          v?.toLowerCase().includes(s),
        );
      const matchesSector = !filtSector || c.sector === filtSector;
      const matchesEstado = !filtEstado || c.estado === filtEstado;
      const matchesProyecto = !clienteIdsPorProyecto || clienteIdsPorProyecto.has(c.id);
      return matchesSearch && matchesSector && matchesEstado && matchesProyecto;
    });
  }, [clientes, search, filtSector, filtEstado, clienteIdsPorProyecto]);

  // Vuelve a la página 1 cada vez que cambia el resultado filtrado -- si no, quedarse en la
  // página 3 con un filtro que deja solo 1 resultado mostraría una lista vacía sin explicación.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional al cambiar de filtro/vista, no una sincronización derivable sin efecto
    setPage(1);
  }, [search, filtSector, filtEstado, filtProyecto, view]);

  const per = perPage === 0 ? Math.max(filtered.length, 1) : perPage;
  const totalPages = Math.max(1, Math.ceil(filtered.length / per));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * per, (currentPage - 1) * per + per);

  const stats = useMemo(() => {
    const total = clientes.length;
    const activos = clientes.filter((c) => c.estado === "Activo").length;
    const prospectos = clientes.filter((c) => c.estado === "Prospecto").length;
    const clienteIdsConProyecto = new Set(proyectos.filter((p) => p.clienteId).map((p) => p.clienteId));
    const conProyectoActivo = clientes.filter((c) => clienteIdsConProyecto.has(c.id)).length;
    return { total, activos, prospectos, conProyectoActivo };
  }, [clientes, proyectos]);

  const proyectoSeleccionado = filtProyecto ? proyectos.find((p) => p.id === filtProyecto) : undefined;

  const chips: FilterChip[] = [
    search && { key: "search", label: `“${search}”` },
    filtSector && { key: "sector", label: filtSector },
    filtEstado && { key: "estado", label: filtEstado },
    proyectoSeleccionado && { key: "proyecto", label: proyectoSeleccionado.nombre },
  ].filter(Boolean) as FilterChip[];

  function removeChip(key: string) {
    if (key === "search") setSearch("");
    if (key === "sector") setFiltSector("");
    if (key === "estado") setFiltEstado("");
    if (key === "proyecto") setFiltProyecto("");
  }

  function clearAll() {
    setSearch("");
    setFiltSector("");
    setFiltEstado("");
    setFiltProyecto("");
  }

  async function handleSave(input: ClienteInput) {
    try {
      if (editing) {
        await updateCliente(editing.id, input);
        pushToast("Cliente actualizado", "success");
        setFormOpen(false);
        setEditing(null);
      } else {
        const creado = await addCliente(input);
        // Sube/crea de verdad, uno por uno, los archivos y links que se hayan agregado
        // ANTES de guardar (Alicia 2026-09-10: "apenas abro el formulario, me tenía que haber
        // salido esto" -- ya no hay que esperar a que el cliente exista para empezar a
        // adjuntar). Se hace ANTES de pasar a modo edición para que, cuando EntityAttachments
        // cargue la lista real por primera vez, ya los encuentre ahí y no haya un parpadeo de
        // "sin archivos ni links aún".
        for (const p of pendingAdjuntos) {
          try {
            if (p.tipo === "link" && p.url) await clienteAdjuntosApi.crearLink(creado.id, { tipo: "link", nombre: p.nombre, url: p.url });
            else if (p.file) await clienteAdjuntosApi.subirArchivo(creado.id, p.file);
          } catch (err) {
            pushToast(err instanceof Error ? err.message : `No se pudo subir "${p.nombre}"`, "danger");
          }
        }
        setPendingAdjuntos([]);
        pushToast("Cliente agregado", "success");
        // Se queda abierto, ahora editando al cliente recién creado -- así la sección de
        // archivos/enlaces sigue usable (ahora en vivo) sin un paso extra de volver a abrirlo.
        setEditing(creado);
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo guardar el cliente", "danger");
    }
  }

  // El "¿Eliminar a X?" ya lo confirma el diálogo propio de DeleteOrRequestButton --
  // esto solo se llama después de que un admin confirma ahí, así que no hace falta
  // (ni conviene) otro window.confirm nativo encima.
  async function handleDelete(id: string) {
    try {
      await removeCliente(id);
      setDetailId(null);
      setFormOpen(false);
      setEditing(null);
      pushToast("Cliente eliminado", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo eliminar el cliente", "danger");
    }
  }

  const detailCliente = detailId ? (clientes.find((c) => c.id === detailId) ?? null) : null;

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
          <h1 className={styles.h1}>Gestión de clientes</h1>
          <p className="mb-5 text-[13px] text-text-2">Cada cliente con sus contactos, proyectos asociados y facturación.</p>
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
        <StatCard n={stats.total} label="Total de clientes" />
        <StatCard n={stats.activos} label="Activos" accent="#036B3C" />
        <StatCard n={stats.prospectos} label="Prospectos" accent="#7A4E00" />
        <StatCard n={stats.conProyectoActivo} label="Con proyecto activo" />
      </div>

      <div className={`mb-4 ${styles.filtersPanel}`}>
        <div className={styles.filterControls}>
          <Dropdown
            value={filtEstado}
            onChange={setFiltEstado}
            placeholder="Cualquier estado"
            options={CLIENTE_ESTADOS.map((e) => ({ value: e, label: e }))}
          />
          <Dropdown
            value={filtSector}
            onChange={setFiltSector}
            placeholder="Toda industria"
            options={sectores.map((s) => ({ value: s, label: s }))}
          />
          <Dropdown
            value={filtProyecto}
            onChange={setFiltProyecto}
            placeholder="Cualquier proyecto"
            options={proyectos.map((p) => ({ value: p.id, label: p.nombre }))}
          />
        </div>

        <ActiveFilters chips={chips} onRemove={removeChip} onClearAll={clearAll} variant="panel" />
      </div>

      {loading && clientes.length === 0 ? (
        <div className="flex justify-center py-14 text-text-2">
          <Spinner label="Cargando clientes…" />
        </div>
      ) : error ? (
        <EmptyState icon={AlertTriangle} title={error} tone="danger" action={{ label: "Reintentar", onClick: fetchAll }} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No se encontraron clientes con estos filtros." />
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
              {pageRows.map((c) => (
                <ClienteCard
                  key={c.id}
                  cliente={c}
                  onOpen={() => setDetailId(c.id)}
                  onEdit={() => {
                    setEditing(c);
                    setFormOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <Table>
              <Thead>
                <Th>Cliente</Th>
                <Th>Industria</Th>
                <Th>Ubicación</Th>
                <Th>Estado</Th>
                <Th>Contacto</Th>
                <Th className="text-right">Acciones</Th>
              </Thead>
              <tbody>
                {pageRows.map((c) => {
                  const sc = statusColor(CLIENT_STATUS_COLORS, c.estado);
                  const paisNombre = paises.find((p) => p.id === c.paisId)?.nombre;
                  const regionNombre = regionesPorPais[c.paisId ?? ""]?.find((r) => r.id === c.regionId)?.nombre;
                  const ciudadNombre = ciudadesPorRegion[c.regionId ?? ""]?.find((x) => x.id === c.ciudadId)?.nombre;
                  const ubicacion = [ciudadNombre, regionNombre, paisNombre].filter(Boolean).join(" · ") || c.ciudad;
                  return (
                  <Tr key={c.id} onClick={() => setDetailId(c.id)}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar nombre={c.nombre} size="sm" />
                        <span className="font-medium">{c.nombre}</span>
                      </div>
                    </Td>
                    <Td className="text-text-2">{c.sector || "—"}</Td>
                    <Td className="text-text-2">{ubicacion || "—"}</Td>
                    <Td>
                      <Badge bg={sc.bg} color={sc.c}>
                        {c.estado}
                      </Badge>
                    </Td>
                    <Td className="text-text-2">
                      {c.contacto || "—"}
                      {c.contacto && c.cargoContacto && <Tag className="ml-1.5">{c.cargoContacto}</Tag>}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <RowAction
                          label="Editar este cliente"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(c);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil size={14} strokeWidth={1.8} />
                        </RowAction>
                        <DeleteOrRequestButton
                          compact
                          tipoEntidad="cliente"
                          entidadId={c.id}
                          nombre={c.nombre}
                          onDelete={() => handleDelete(c.id)}
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

      <ClienteFormModal
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

      <ClienteDetail
        cliente={detailCliente}
        proyectos={proyectos}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          // Antes se quedaban el detalle Y el formulario abiertos a la vez (dos
          // drawers montados, ver Drawer.tsx) -- Alicia pidió que "Editar" desde
          // el detalle lleve derecho al formulario, sin tener que cerrar el
          // detalle a mano primero. Cerrarlo aquí logra eso en un solo clic.
          setDetailId(null);
          setEditing(detailCliente);
          setFormOpen(true);
        }}
      />
    </div>
  );
}
