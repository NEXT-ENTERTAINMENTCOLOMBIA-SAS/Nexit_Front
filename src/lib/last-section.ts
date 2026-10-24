"use client";

/**
 * Recuerda la última sección del dashboard que se visitó (Alicia
 * 2026-09-07): antes, tanto al entrar a "/" como justo después de iniciar
 * sesión, la app siempre mandaba a Proveedores sin importar cuál se usa
 * más -- "yo siempre voy primero a Clientes, no a Proveedores". Ahora se
 * guarda la última sección visitada (dashboard/layout.tsx la actualiza en
 * cada cambio de pantalla) y se usa como destino; si todavía no hay
 * ninguna guardada (primera vez), el destino por default es Clientes.
 */

import { NAV } from "@/lib/nav-items";

const KEY = "nexit:lastSection";
const DEFAULT_SECTION = "/clientes";

/**
 * Solo se recuerdan / restauran rutas que existen hoy en la navegación. Antes se devolvía lo que
 * hubiera guardado: quien tenía guardada una sección que después se eliminó (Informes, Calendario)
 * caía en un 404 justo después de iniciar sesión, cada vez, hasta limpiar el almacenamiento.
 */
export function esSeccionValida(pathname: string): boolean {
  return NAV.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
}

export function rememberSection(pathname: string) {
  if (typeof window === "undefined") return;
  if (!esSeccionValida(pathname)) return;
  try {
    window.localStorage.setItem(KEY, pathname);
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) -- no es crítico, se ignora.
  }
}

export function getLastSection(): string {
  if (typeof window === "undefined") return DEFAULT_SECTION;
  try {
    const guardada = window.localStorage.getItem(KEY);
    return guardada && esSeccionValida(guardada) ? guardada : DEFAULT_SECTION;
  } catch {
    return DEFAULT_SECTION;
  }
}
