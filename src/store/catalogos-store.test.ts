import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * fetchBase pide 7 catálogos en paralelo (Promise.all) -- si cualquiera
 * falla, antes se quedaba con loading:true para siempre igual que los demás
 * stores. Ver projects-store.test.ts para el detalle del arreglo.
 *
 * OJO al agregar un catálogo nuevo a fetchBase: hay que agregarlo también a
 * este mock y a resetAllToResolved. Si falta, el store revienta con "Cannot
 * read properties of undefined (reading 'list')" y las 3 pruebas fallan por
 * un motivo que no tiene nada que ver con lo que están probando (fue lo que
 * pasó al sumar `etapasCliente`, docs/33, y de nuevo al sumar
 * `estadosProveedor`, 2026-09-10).
 */
vi.mock("@/services/api/catalogos-service", () => ({
  catalogosApi: {
    paises: { list: vi.fn() },
    categoriasProveedor: { list: vi.fn() },
    servicios: { list: vi.fn() },
    estadosProveedor: { list: vi.fn() },
    estadosProyecto: { list: vi.fn() },
    fasesProyecto: { list: vi.fn() },
    etapasCliente: { list: vi.fn() },
    regiones: { list: vi.fn() },
    ciudades: { list: vi.fn() },
  },
}));

const { catalogosApi } = await import("@/services/api/catalogos-service");
const { useCatalogosStore } = await import("./catalogos-store");

function resetAllToResolved() {
  vi.mocked(catalogosApi.paises.list).mockResolvedValue([]);
  vi.mocked(catalogosApi.categoriasProveedor.list).mockResolvedValue([]);
  vi.mocked(catalogosApi.servicios.list).mockResolvedValue([]);
  vi.mocked(catalogosApi.estadosProveedor.list).mockResolvedValue([]);
  vi.mocked(catalogosApi.estadosProyecto.list).mockResolvedValue([]);
  vi.mocked(catalogosApi.fasesProyecto.list).mockResolvedValue([]);
  vi.mocked(catalogosApi.etapasCliente.list).mockResolvedValue([]);
}

beforeEach(() => {
  useCatalogosStore.setState({
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
  });
  vi.clearAllMocks();
  resetAllToResolved();
});

describe("useCatalogosStore.fetchBase", () => {
  it("en éxito: marca loaded y no deja error", async () => {
    await useCatalogosStore.getState().fetchBase();
    const state = useCatalogosStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("si UNO de los 7 catálogos falla, todo el Promise.all falla -- no deja loading pegado ni marca loaded", async () => {
    vi.mocked(catalogosApi.estadosProyecto.list).mockRejectedValue(new Error("caído"));
    await useCatalogosStore.getState().fetchBase();
    const state = useCatalogosStore.getState();
    expect(state.loading).toBe(false);
    expect(state.loaded).toBe(false);
    expect(state.error).toBe("caído");
  });

  it("reintentar después de un fallo vuelve a pedir los 7 catálogos", async () => {
    vi.mocked(catalogosApi.estadosProyecto.list).mockRejectedValueOnce(new Error("caído"));
    await useCatalogosStore.getState().fetchBase();
    expect(useCatalogosStore.getState().error).toBe("caído");

    await useCatalogosStore.getState().fetchBase();
    const state = useCatalogosStore.getState();
    expect(state.error).toBeNull();
    expect(state.loaded).toBe(true);
    expect(catalogosApi.estadosProyecto.list).toHaveBeenCalledTimes(2);
  });
});
