"use client";

import { create } from "zustand";
import { clientesApi } from "@/services/api/clientes-service";
import type { Cliente, ClienteInput } from "@/types/api";

/**
 * Store de Clientes -- construido 2026-08-28 junto con la pantalla (antes no
 * existía ni la página ni el store; el servicio de API ya estaba listo desde
 * la tarea #11). Conecta directo contra clientesApi (Nexit_Back real), sin
 * capa de mocks intermedia.
 */
interface ClientesState {
  items: Cliente[];
  loading: boolean;
  loaded: boolean;
  /** Mensaje del último fetchAll que falló, o null. La pantalla lo usa para mostrar un estado de error con botón "Reintentar" en vez de una lista vacía engañosa. */
  error: string | null;
  fetchAll: () => Promise<void>;
  /** Fuerza un fetchAll nuevo aunque ya esté `loaded` -- para después de una importación masiva (docs/31), que crea filas por fuera de add/update/remove. */
  refresh: () => Promise<void>;
  addCliente: (input: ClienteInput) => Promise<Cliente>;
  updateCliente: (id: string, input: ClienteInput) => Promise<Cliente>;
  removeCliente: (id: string) => Promise<void>;
}

export const useClientesStore = create<ClientesState>((set, get) => ({
  items: [],
  loading: false,
  loaded: false,
  error: null,
  fetchAll: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const items = await clientesApi.list();
      set({ items, loading: false, loaded: true });
    } catch (err) {
      // Si ya hay datos en pantalla (p. ej. falló una actualización automática en segundo plano), se conservan
      // y no se muestra la pantalla de error: esa solo aparece cuando no hay nada que mostrar.
      set((state) => ({ loading: false, error: state.items.length > 0 ? null : err instanceof Error ? err.message : "No se pudieron cargar los clientes." }));
    }
  },
  refresh: async () => {
    set({ loaded: false });
    await get().fetchAll();
  },
  addCliente: async (input) => {
    const created = await clientesApi.create(input);
    set((state) => ({ items: [...state.items, created] }));
    return created;
  },
  updateCliente: async (id, input) => {
    const updated = await clientesApi.update(id, input);
    set((state) => ({ items: state.items.map((c) => (c.id === id ? updated : c)) }));
    return updated;
  },
  removeCliente: async (id) => {
    await clientesApi.remove(id);
    set((state) => ({ items: state.items.filter((c) => c.id !== id) }));
  },
}));
