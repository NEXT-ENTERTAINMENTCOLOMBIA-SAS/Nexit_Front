import { apiClient } from "@/lib/api-client";
import type { FiltrosPaginaProyectos, ImportarResultado, Proyecto, ProyectosPagina, ProyectoInput, ProyectoPrioridad, SeguimientoProyecto, SeguimientoProyectoInput } from "@/types/api";

/**
 * Conecta contra ProyectosController real (Nexit_Back). DELETE requiere
 * admin/super_admin. `gerenteId` solo lo puede fijar explícito un
 * admin/super_admin -- si un gerente crea/edita sin mandarlo, el backend
 * lo autoasigna a sí mismo.
 *
 * `listarSeguimiento` trae la bitácora completa (más reciente primero);
 * `agregarSeguimiento` solo agrega una entrada nueva y devuelve esa entrada.
 */
export const proyectosApi = {
  list: () => apiClient.get<Proyecto[]>("/api/proyectos"),
  /** Una página ya filtrada en el servidor + conteos globales (2026-10-05): no baja todos los proyectos. */
  pagina: (f: FiltrosPaginaProyectos) => {
    const p = new URLSearchParams();
    if (f.q?.trim()) p.set("q", f.q.trim());
    if (f.estadoId) p.set("estadoId", f.estadoId);
    if (f.clienteId) p.set("clienteId", f.clienteId);
    if (f.tipo) p.set("tipo", f.tipo);
    if (f.gerenteId) p.set("gerenteId", f.gerenteId);
    if (f.alerta) p.set("alerta", f.alerta);
    p.set("page", String(f.page ?? 1));
    p.set("pageSize", String(f.pageSize ?? 12));
    return apiClient.get<ProyectosPagina>(`/api/proyectos/pagina?${p.toString()}`);
  },
  getById: (id: string) => apiClient.get<Proyecto>(`/api/proyectos/${id}`),
  /** "A qué proyecto atender primero" (docs/21, docs/22). */
  prioridad: () => apiClient.get<ProyectoPrioridad[]>("/api/proyectos/prioridad"),
  create: (input: ProyectoInput) => apiClient.post<Proyecto>("/api/proyectos", input),
  update: (id: string, input: ProyectoInput) => apiClient.put<Proyecto>(`/api/proyectos/${id}`, { ...input, id }),
  remove: (id: string) => apiClient.delete<void>(`/api/proyectos/${id}`),
  agregarSeguimiento: (proyectoId: string, input: SeguimientoProyectoInput) =>
    apiClient.post<SeguimientoProyecto>(`/api/proyectos/${proyectoId}/seguimiento`, input),
  /** Bitácora completa del proyecto, más reciente primero (agregado 2026-08-26). */
  listarSeguimiento: (proyectoId: string) =>
    apiClient.get<SeguimientoProyecto[]>(`/api/proyectos/${proyectoId}/seguimiento`),
  /** Descarga todos los proyectos como .xlsx (docs/31) -- úsalo con downloadBlob(). No incluye equipo/proveedores/gerente (se completan luego en la pantalla de edición). */
  exportar: () => apiClient.getFile("/api/proyectos/exportar", "proyectos.xlsx"),
  /** Carga masiva desde .xlsx (docs/31, requiere admin/super_admin) -- Cliente/Estado se resuelven por nombre. */
  importar: (archivo: File) => {
    const form = new FormData();
    form.append("archivo", archivo);
    return apiClient.postForm<ImportarResultado>("/api/proyectos/importar", form);
  },
};
