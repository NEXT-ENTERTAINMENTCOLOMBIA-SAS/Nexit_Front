import { apiClient } from "@/lib/api-client";
import type {
  CatalogoTipo,
  Ciudad,
  CiudadInput,
  EstadoProyecto,
  EstadoProyectoInput,
  EtapaCliente,
  EtapaClienteInput,
  FaseProyecto,
  ItemCatalogo,
  Pais,
  PaisInput,
  Region,
  RegionInput,
} from "@/types/api";

/**
 * Conecta contra CatalogosController real (Nexit_Back). Leer (`GET`) no requiere rol especial;
 * crear/editar/eliminar requiere admin/super_admin. NOTA: los dominios de correo permitidos (docs/09)
 * NO se administran por esta API -- viven directo en la base de datos.
 */
export const catalogosApi = {
  paises: {
    list: () => apiClient.get<Pais[]>("/api/catalogos/paises"),
    create: (input: PaisInput) => apiClient.post<Pais>("/api/catalogos/paises", input),
    update: (id: string, input: PaisInput) => apiClient.put<Pais>(`/api/catalogos/paises/${id}`, input),
  },
  regiones: {
    list: (paisId: string) => apiClient.get<Region[]>(`/api/catalogos/regiones?paisId=${paisId}`),
    create: (input: RegionInput) => apiClient.post<Region>("/api/catalogos/regiones", input),
    update: (id: string, input: RegionInput) => apiClient.put<Region>(`/api/catalogos/regiones/${id}`, input),
  },
  ciudades: {
    list: (regionId: string) => apiClient.get<Ciudad[]>(`/api/catalogos/ciudades?regionId=${regionId}`),
    create: (input: CiudadInput) => apiClient.post<Ciudad>("/api/catalogos/ciudades", input),
    update: (id: string, input: CiudadInput) => apiClient.put<Ciudad>(`/api/catalogos/ciudades/${id}`, input),
  },
  categoriasProveedor: {
    list: () => apiClient.get<ItemCatalogo[]>("/api/catalogos/categorias-proveedor"),
    create: (nombre: string) => apiClient.post<ItemCatalogo>("/api/catalogos/categorias-proveedor", { nombre }),
    update: (id: string, nombre: string) => apiClient.put<ItemCatalogo>(`/api/catalogos/categorias-proveedor/${id}`, { nombre }),
  },
  servicios: {
    list: () => apiClient.get<ItemCatalogo[]>("/api/catalogos/servicios"),
    create: (nombre: string) => apiClient.post<ItemCatalogo>("/api/catalogos/servicios", { nombre }),
    update: (id: string, nombre: string) => apiClient.put<ItemCatalogo>(`/api/catalogos/servicios/${id}`, { nombre }),
  },
  /** "Estados de gestión de proveedores" (Activo/En evaluación/Pausado/Bloqueado, editables desde 2026-09-10). */
  estadosProveedor: {
    list: () => apiClient.get<ItemCatalogo[]>("/api/catalogos/estados-proveedor"),
    create: (nombre: string) => apiClient.post<ItemCatalogo>("/api/catalogos/estados-proveedor", { nombre }),
    update: (id: string, nombre: string) => apiClient.put<ItemCatalogo>(`/api/catalogos/estados-proveedor/${id}`, { nombre }),
  },
  fasesProyecto: {
    list: () => apiClient.get<FaseProyecto[]>("/api/catalogos/fases-proyecto"),
    update: (fase: number, nombre: string) => apiClient.put<FaseProyecto>(`/api/catalogos/fases-proyecto/${fase}`, { nombre }),
  },
  estadosProyecto: {
    /** `fase` opcional filtra solo los estados de esa fase (1, 2 o 3). */
    list: (fase?: number) => apiClient.get<EstadoProyecto[]>(`/api/catalogos/estados-proyecto${fase !== undefined ? `?fase=${fase}` : ""}`),
    create: (input: EstadoProyectoInput) => apiClient.post<EstadoProyecto>("/api/catalogos/estados-proyecto", input),
    update: (id: string, input: EstadoProyectoInput) => apiClient.put<EstadoProyecto>(`/api/catalogos/estados-proyecto/${id}`, input),
  },
  /** Etapa comercial del cliente (E1-E6, docs/33) -- distinta de estadosProyecto: vive en Cliente, no en Proyecto. */
  etapasCliente: {
    list: () => apiClient.get<EtapaCliente[]>("/api/catalogos/etapas-cliente"),
    create: (input: EtapaClienteInput) => apiClient.post<EtapaCliente>("/api/catalogos/etapas-cliente", input),
    update: (id: string, input: EtapaClienteInput) => apiClient.put<EtapaCliente>(`/api/catalogos/etapas-cliente/${id}`, input),
  },
  /** DELETE genérico -- `tipo` es el segmento de ruta usado para crear ese catálogo (ej. "paises", "estados-proyecto"). */
  remove: (tipo: CatalogoTipo, id: string) => apiClient.delete<void>(`/api/catalogos/${tipo}/${id}`),
};
