"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { ROLES, ROL_DESCRIPCIONES, ROL_LABELS } from "@/lib/constants";
import { configuracionApi } from "@/services/api/configuracion-service";
import type { ListaConfigurable, OpcionConfig, OpcionesConfig, Rol, RolConfig } from "@/types/api";

/**
 * Configuración editable que usan muchas pantallas a la vez: cómo se llama cada rol y las listas
 * de Proyectos (tipo, prioridad, sede, estado de la propuesta, área de seguimiento). Antes todo
 * esto vivía fijo en `constants.ts`; ahora viene del backend (Configuración, 2026-10-05) y los
 * valores de `constants.ts` quedan solo como respaldo mientras carga o si el backend no responde.
 */

/** Valores de respaldo (los mismos que antes estaban fijos) -- así los formularios nunca quedan sin opciones. */
export const OPCIONES_RESPALDO: Record<ListaConfigurable, string[]> = {
  "tipo-proyecto": ["Corporativo", "Evento social"],
  prioridad: ["Alta", "Media", "Baja"],
  "sede-next": ["Bogotá", "Ciudad de México"],
  "estado-propuesta": ["No enviada", "En proceso", "Enviada"],
  "area-seguimiento": ["General", "Creativo", "Comercial", "Administrativo"],
};

interface ConfigState {
  roles: RolConfig[] | null;
  opciones: OpcionesConfig | null;
  loading: boolean;
  fetchConfig: (opts?: { force?: boolean }) => Promise<void>;
  updateRol: (rol: Rol, input: { etiqueta: string; descripcion: string }) => Promise<RolConfig>;
  addOpcion: (lista: ListaConfigurable, valor: string) => Promise<OpcionConfig>;
  updateOpcion: (lista: ListaConfigurable, id: string, valor: string) => Promise<OpcionConfig>;
  removeOpcion: (lista: ListaConfigurable, id: string) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  roles: null,
  opciones: null,
  loading: false,

  fetchConfig: async ({ force = false } = {}) => {
    if (get().loading) return;
    if (!force && get().roles && get().opciones) return;
    set({ loading: true });
    try {
      const [roles, opciones] = await Promise.all([configuracionApi.roles.list(), configuracionApi.opciones.list()]);
      set({ roles, opciones });
    } catch {
      // Silencioso a propósito: las pantallas siguen funcionando con los valores de respaldo.
    } finally {
      set({ loading: false });
    }
  },

  updateRol: async (rol, input) => {
    const saved = await configuracionApi.roles.update(rol, input);
    set((s) => ({ roles: (s.roles ?? []).some((r) => r.rol === rol) ? (s.roles ?? []).map((r) => (r.rol === rol ? saved : r)) : [...(s.roles ?? []), saved] }));
    return saved;
  },

  addOpcion: async (lista, valor) => {
    const creada = await configuracionApi.opciones.create(lista, valor);
    set((s) => (s.opciones ? { opciones: { ...s.opciones, [lista]: [...s.opciones[lista], creada] } } : s));
    return creada;
  },

  updateOpcion: async (lista, id, valor) => {
    const saved = await configuracionApi.opciones.update(lista, id, valor);
    set((s) => (s.opciones ? { opciones: { ...s.opciones, [lista]: s.opciones[lista].map((o) => (o.id === id ? saved : o)) } } : s));
    return saved;
  },

  removeOpcion: async (lista, id) => {
    await configuracionApi.opciones.remove(lista, id);
    set((s) => (s.opciones ? { opciones: { ...s.opciones, [lista]: s.opciones[lista].filter((o) => o.id !== id) } } : s));
  },
}));

/** Nombre visible de cada rol (editable en Configuración) con respaldo al texto fijo de siempre. */
export function useRolLabels(): Record<Rol, string> {
  const roles = useConfigStore((s) => s.roles);
  return useMemo(() => Object.fromEntries(ROLES.map((r) => [r, roles?.find((x) => x.rol === r)?.etiqueta ?? ROL_LABELS[r]])) as Record<Rol, string>, [roles]);
}

/** Descripción de qué puede hacer cada rol (editable en Configuración). */
export function useRolDescripciones(): Record<Rol, string> {
  const roles = useConfigStore((s) => s.roles);
  return useMemo(() => Object.fromEntries(ROLES.map((r) => [r, roles?.find((x) => x.rol === r)?.descripcion || ROL_DESCRIPCIONES[r]])) as Record<Rol, string>, [roles]);
}

/** Opciones vigentes de una lista de Proyectos (como texto), con respaldo si todavía no cargó. */
export function useOpciones(lista: ListaConfigurable): string[] {
  const opciones = useConfigStore((s) => s.opciones);
  return useMemo(() => opciones?.[lista]?.map((o) => o.valor) ?? OPCIONES_RESPALDO[lista], [opciones, lista]);
}
