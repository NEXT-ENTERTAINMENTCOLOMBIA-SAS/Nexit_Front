"use client";

import { create } from "zustand";
import { catalogosApi } from "@/services/api/catalogos-service";
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
 * Catálogos compartidos (países, categorías de proveedor, servicios) --
 * construido 2026-08-28 junto con el rediseño de Proveedores/Proyectos, que
 * son los primeros módulos en usar los catálogos reales de Nexit_Back en vez
 * de la tabla estática GEO/PROVIDER_CATEGORIES de la maqueta. Regiones y
 * ciudades se piden bajo demanda (dependen de país/región) y se cachean acá
 * mismo para no repetir la llamada cada vez que se abre un formulario.
 */
interface CatalogosState {
  paises: Pais[];
  categoriasProveedor: ItemCatalogo[];
  servicios: ItemCatalogo[];
  estadosProveedor: ItemCatalogo[];
  estadosProyecto: EstadoProyecto[];
  fasesProyecto: FaseProyecto[];
  etapasCliente: EtapaCliente[];
  regionesPorPais: Record<string, Region[]>;
  ciudadesPorRegion: Record<string, Ciudad[]>;
  loaded: boolean;
  loading: boolean;
  /** Mensaje del último fetchBase que falló, o null. */
  error: string | null;
  fetchBase: () => Promise<void>;
  fetchRegiones: (paisId: string) => Promise<Region[]>;
  fetchCiudades: (regionId: string) => Promise<Ciudad[]>;
  /** Crea un servicio nuevo en el catálogo y lo agrega al estado en caliente
   * (Alicia 2026-09-08): en el formulario de Proveedor, "Servicios que
   * presta" antes solo dejaba prender/apagar los que ya existían en el
   * catálogo -- si el que necesitaba no estaba en la lista (datos
   * importados incompletos), no había forma de agregarlo sin salir del
   * formulario. */
  addServicio: (nombre: string) => Promise<ItemCatalogo>;

  // --- CRUD de catálogos para la pantalla de Configuración (2026-09-09, admin/super_admin) ---
  // Cada acción hace la llamada real y actualiza el estado en caliente, para que cualquier
  // formulario que ya tenga el store abierto (Dropdown de país, de categoría, etc.) vea el cambio
  // sin recargar la página -- mismo patrón que `addServicio` de arriba.
  addPais: (input: PaisInput) => Promise<Pais>;
  updatePais: (id: string, input: PaisInput) => Promise<Pais>;
  addRegion: (input: RegionInput) => Promise<Region>;
  updateRegion: (id: string, input: RegionInput) => Promise<Region>;
  addCiudad: (input: CiudadInput) => Promise<Ciudad>;
  updateCiudad: (id: string, input: CiudadInput) => Promise<Ciudad>;
  addCategoria: (nombre: string) => Promise<ItemCatalogo>;
  updateCategoria: (id: string, nombre: string) => Promise<ItemCatalogo>;
  updateServicio: (id: string, nombre: string) => Promise<ItemCatalogo>;
  addEstadoProveedor: (nombre: string) => Promise<ItemCatalogo>;
  updateEstadoProveedor: (id: string, nombre: string) => Promise<ItemCatalogo>;
  updateFase: (fase: number, nombre: string) => Promise<FaseProyecto>;
  addEstadoProyecto: (input: EstadoProyectoInput) => Promise<EstadoProyecto>;
  updateEstadoProyecto: (id: string, input: EstadoProyectoInput) => Promise<EstadoProyecto>;
  addEtapaCliente: (input: EtapaClienteInput) => Promise<EtapaCliente>;
  updateEtapaCliente: (id: string, input: EtapaClienteInput) => Promise<EtapaCliente>;
  /** DELETE genérico -- quita del estado el catálogo correcto según `tipo`. */
  removeCatalogo: (tipo: CatalogoTipo, id: string) => Promise<void>;
}

export const useCatalogosStore = create<CatalogosState>((set, get) => ({
  paises: [],
  categoriasProveedor: [],
  servicios: [],
  estadosProveedor: [],
  estadosProyecto: [],
  fasesProyecto: [],
  etapasCliente: [],
  regionesPorPais: {},
  ciudadesPorRegion: {},
  loaded: false,
  loading: false,
  error: null,
  fetchBase: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const [paises, categoriasProveedor, servicios, estadosProveedor, estadosProyecto, fasesProyecto, etapasCliente] = await Promise.all([
        catalogosApi.paises.list(),
        catalogosApi.categoriasProveedor.list(),
        catalogosApi.servicios.list(),
        catalogosApi.estadosProveedor.list(),
        catalogosApi.estadosProyecto.list(),
        catalogosApi.fasesProyecto.list(),
        catalogosApi.etapasCliente.list(),
      ]);
      set({ paises, categoriasProveedor, servicios, estadosProveedor, estadosProyecto, fasesProyecto, etapasCliente, loading: false, loaded: true });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "No se pudieron cargar los catálogos." });
    }
  },
  fetchRegiones: async (paisId) => {
    const cached = get().regionesPorPais[paisId];
    if (cached) return cached;
    const regiones = await catalogosApi.regiones.list(paisId);
    set((state) => ({ regionesPorPais: { ...state.regionesPorPais, [paisId]: regiones } }));
    return regiones;
  },
  fetchCiudades: async (regionId) => {
    const cached = get().ciudadesPorRegion[regionId];
    if (cached) return cached;
    const ciudades = await catalogosApi.ciudades.list(regionId);
    set((state) => ({ ciudadesPorRegion: { ...state.ciudadesPorRegion, [regionId]: ciudades } }));
    return ciudades;
  },
  addServicio: async (nombre) => {
    const creado = await catalogosApi.servicios.create(nombre);
    set((state) => ({ servicios: [...state.servicios, creado] }));
    return creado;
  },

  addPais: async (input) => {
    const creado = await catalogosApi.paises.create(input);
    set((state) => ({ paises: [...state.paises, creado] }));
    return creado;
  },
  updatePais: async (id, input) => {
    const actualizado = await catalogosApi.paises.update(id, input);
    set((state) => ({ paises: state.paises.map((p) => (p.id === id ? actualizado : p)) }));
    return actualizado;
  },
  addRegion: async (input) => {
    const creada = await catalogosApi.regiones.create(input);
    set((state) => ({
      regionesPorPais: { ...state.regionesPorPais, [input.paisId]: [...(state.regionesPorPais[input.paisId] ?? []), creada] },
    }));
    return creada;
  },
  updateRegion: async (id, input) => {
    const actualizada = await catalogosApi.regiones.update(id, input);
    set((state) => ({
      regionesPorPais: {
        ...state.regionesPorPais,
        [input.paisId]: (state.regionesPorPais[input.paisId] ?? []).map((r) => (r.id === id ? actualizada : r)),
      },
    }));
    return actualizada;
  },
  addCiudad: async (input) => {
    const creada = await catalogosApi.ciudades.create(input);
    set((state) => ({
      ciudadesPorRegion: { ...state.ciudadesPorRegion, [input.regionId]: [...(state.ciudadesPorRegion[input.regionId] ?? []), creada] },
    }));
    return creada;
  },
  updateCiudad: async (id, input) => {
    const actualizada = await catalogosApi.ciudades.update(id, input);
    set((state) => ({
      ciudadesPorRegion: {
        ...state.ciudadesPorRegion,
        [input.regionId]: (state.ciudadesPorRegion[input.regionId] ?? []).map((c) => (c.id === id ? actualizada : c)),
      },
    }));
    return actualizada;
  },
  addCategoria: async (nombre) => {
    const creada = await catalogosApi.categoriasProveedor.create(nombre);
    set((state) => ({ categoriasProveedor: [...state.categoriasProveedor, creada] }));
    return creada;
  },
  updateCategoria: async (id, nombre) => {
    const actualizada = await catalogosApi.categoriasProveedor.update(id, nombre);
    set((state) => ({ categoriasProveedor: state.categoriasProveedor.map((c) => (c.id === id ? actualizada : c)) }));
    return actualizada;
  },
  updateServicio: async (id, nombre) => {
    const actualizado = await catalogosApi.servicios.update(id, nombre);
    set((state) => ({ servicios: state.servicios.map((s) => (s.id === id ? actualizado : s)) }));
    return actualizado;
  },
  addEstadoProveedor: async (nombre) => {
    const creado = await catalogosApi.estadosProveedor.create(nombre);
    set((state) => ({ estadosProveedor: [...state.estadosProveedor, creado] }));
    return creado;
  },
  updateEstadoProveedor: async (id, nombre) => {
    const actualizado = await catalogosApi.estadosProveedor.update(id, nombre);
    set((state) => ({ estadosProveedor: state.estadosProveedor.map((e) => (e.id === id ? actualizado : e)) }));
    return actualizado;
  },
  updateFase: async (fase, nombre) => {
    const actualizada = await catalogosApi.fasesProyecto.update(fase, nombre);
    set((state) => ({ fasesProyecto: state.fasesProyecto.map((f) => (f.fase === fase ? actualizada : f)) }));
    return actualizada;
  },
  addEstadoProyecto: async (input) => {
    const creado = await catalogosApi.estadosProyecto.create(input);
    set((state) => ({ estadosProyecto: [...state.estadosProyecto, creado] }));
    return creado;
  },
  updateEstadoProyecto: async (id, input) => {
    const actualizado = await catalogosApi.estadosProyecto.update(id, input);
    set((state) => ({ estadosProyecto: state.estadosProyecto.map((e) => (e.id === id ? actualizado : e)) }));
    return actualizado;
  },
  addEtapaCliente: async (input) => {
    const creada = await catalogosApi.etapasCliente.create(input);
    set((state) => ({ etapasCliente: [...state.etapasCliente, creada] }));
    return creada;
  },
  updateEtapaCliente: async (id, input) => {
    const actualizada = await catalogosApi.etapasCliente.update(id, input);
    set((state) => ({ etapasCliente: state.etapasCliente.map((e) => (e.id === id ? actualizada : e)) }));
    return actualizada;
  },
  removeCatalogo: async (tipo, id) => {
    await catalogosApi.remove(tipo, id);
    set((state) => {
      switch (tipo) {
        case "paises":
          return { paises: state.paises.filter((p) => p.id !== id) };
        case "regiones": {
          const next = { ...state.regionesPorPais };
          for (const paisId of Object.keys(next)) next[paisId] = next[paisId].filter((r) => r.id !== id);
          return { regionesPorPais: next };
        }
        case "ciudades": {
          const next = { ...state.ciudadesPorRegion };
          for (const regionId of Object.keys(next)) next[regionId] = next[regionId].filter((c) => c.id !== id);
          return { ciudadesPorRegion: next };
        }
        case "categorias-proveedor":
          return { categoriasProveedor: state.categoriasProveedor.filter((c) => c.id !== id) };
        case "servicios":
          return { servicios: state.servicios.filter((s) => s.id !== id) };
        case "estados-proveedor":
          return { estadosProveedor: state.estadosProveedor.filter((e) => e.id !== id) };
        case "estados-proyecto":
          return { estadosProyecto: state.estadosProyecto.filter((e) => e.id !== id) };
        case "etapas-cliente":
          return { etapasCliente: state.etapasCliente.filter((e) => e.id !== id) };
        default:
          return {};
      }
    });
  },
}));
