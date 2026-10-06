"use client";

import { create } from "zustand";
import { proveedoresApi } from "@/services/api/proveedores-service";
import type { Proveedor, ProveedorInput } from "@/types/api";

/** Store de Proveedores, contra proveedoresApi (Nexit_Back real). */
interface ProvidersState {
  items: Proveedor[];
  loading: boolean;
  loaded: boolean;
  /** Mensaje del último fetchAll que falló, o null. La pantalla lo usa para mostrar un estado de error con botón "Reintentar" en vez de una lista vacía engañosa. */
  error: string | null;
  fetchAll: () => Promise<void>;
  /** Fuerza un fetchAll nuevo aunque ya esté `loaded` -- para después de una importación masiva (docs/31), que crea filas por fuera de add/update/remove. */
  refresh: () => Promise<void>;
  addProvider: (input: ProveedorInput) => Promise<Proveedor>;
  updateProvider: (id: string, input: ProveedorInput) => Promise<Proveedor>;
  removeProvider: (id: string) => Promise<void>;
  marcarColaborador: (id: string) => Promise<void>;
  quitarColaborador: (id: string) => Promise<void>;
}

export const useProvidersStore = create<ProvidersState>((set, get) => ({
  items: [],
  loading: false,
  loaded: false,
  error: null,
  fetchAll: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const items = await proveedoresApi.list();
      set({ items, loading: false, loaded: true });
    } catch (err) {
      // `loaded` se queda en false a propósito: sin esto, un fetchAll que
      // falla deja loading en true para siempre y la guarda de arriba nunca
      // vuelve a intentar.
      // Si ya hay datos en pantalla (p. ej. falló una actualización automática en segundo plano), se conservan
      // y no se muestra la pantalla de error: esa solo aparece cuando no hay nada que mostrar.
      set((state) => ({ loading: false, error: state.items.length > 0 ? null : err instanceof Error ? err.message : "No se pudieron cargar los proveedores." }));
    }
  },
  refresh: async () => {
    set({ loaded: false });
    await get().fetchAll();
  },
  addProvider: async (input) => {
    const created = await proveedoresApi.create(input);
    set((state) => ({ items: [...state.items, created] }));
    return created;
  },
  updateProvider: async (id, input) => {
    const updated = await proveedoresApi.update(id, input);
    set((state) => ({ items: state.items.map((p) => (p.id === id ? updated : p)) }));
    return updated;
  },
  removeProvider: async (id) => {
    await proveedoresApi.remove(id);
    set((state) => ({ items: state.items.filter((p) => p.id !== id) }));
  },
  marcarColaborador: async (id) => {
    await proveedoresApi.marcarColaborador(id);
    const fresh = await proveedoresApi.getById(id);
    set((state) => ({ items: state.items.map((p) => (p.id === id ? fresh : p)) }));
  },
  quitarColaborador: async (id) => {
    await proveedoresApi.quitarColaborador(id);
    const fresh = await proveedoresApi.getById(id);
    set((state) => ({ items: state.items.map((p) => (p.id === id ? fresh : p)) }));
  },
}));
