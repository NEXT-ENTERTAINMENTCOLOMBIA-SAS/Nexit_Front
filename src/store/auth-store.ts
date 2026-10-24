"use client";

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";
import { decodeJwtRole } from "@/lib/jwt";
import { usuariosApi } from "@/services/api/usuarios-service";
import { ApiError } from "@/lib/api-client";
import type { Rol } from "@/types/api";

/**
 * Perfil de sesión ya resuelto para el resto de la app (no es un DTO del
 * backend -- para eso está src/types/api.ts -- sino la forma que arma este
 * store combinando el JWT de Supabase con GET /api/usuarios/me, ver
 * buildUserFromSession/refreshProfile más abajo). Solo se usa acá, por eso
 * vive junto al store en vez de en un archivo de tipos aparte.
 */
export interface AuthUser {
  /** UUID real de Supabase Auth (session.user.id). */
  id: string;
  email: string;
  displayName: string;
  initials: string;
  /**
   * Rol de negocio. Viene de GET /api/usuarios/me apenas carga esa respuesta;
   * mientras tanto, y si esa cuenta todavía no tiene fila de negocio (recién
   * invitada, o el super_admin sembrado a mano), se usa el claim `user_role`
   * del JWT (Auth Hook de Supabase -- ver
   * Nexit_Back/docs/schema/03_auth_hook_custom_claims.sql) y
   * `displayName`/`initials` se derivan del correo como aproximación.
   */
  rol: Rol;
}

/**
 * Si la cuenta autenticada en Supabase Auth tiene o no un perfil de negocio en `usuarios`.
 * Es una pregunta distinta de "¿hay sesión?": alguien recién invitado tiene sesión válida y
 * ningún perfil, y hasta que lo cree no puede usar el sistema (Nexit_Back lo bloquea de verdad
 * con PerfilRequeridoFilter -- esto es lo que permite mandarlo a /registro en vez de dejarlo
 * chocar contra 403 en cada pantalla).
 *
 *  - "cargando": todavía no se sabe (no bloquea nada, pero tampoco deja entrar).
 *  - "completo": tiene perfil y está activa -- uso normal.
 *  - "sin-perfil": autenticada pero sin fila en `usuarios` -- va a /registro.
 *  - "inactivo": tiene perfil pero fue desactivada -- se le cierra la sesión.
 *  - "indeterminado": no se pudo averiguar (backend caído, sin red). NO se le cierra la puerta
 *    por esto: se le deja pasar y que fallen las llamadas de datos con su propio error visible,
 *    en vez de mandar a todo el equipo a /registro por una caída del backend.
 */
export type EstadoPerfil = "cargando" | "completo" | "sin-perfil" | "inactivo" | "indeterminado";

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  estadoPerfil: EstadoPerfil;
  /** scope "local" (recomendado, docs/10 sección 2.3): solo cierra esta sesión/dispositivo. */
  logout: () => Promise<void>;
  /**
   * Vuelve a pedir GET /api/usuarios/me. La usa /registro justo después de aceptar la
   * invitación, cuando el perfil acaba de existir pero este store todavía cree que no.
   */
  recargarPerfil: () => Promise<void>;
}

function buildDisplayName(email: string): { displayName: string; initials: string } {
  const namePart = email.split("@")[0]?.replace(/[._]/g, " ") ?? "Usuario";
  const displayName =
    namePart
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ") || "Usuario";
  const initials =
    displayName
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "U";
  return { displayName, initials };
}

/** Aproximación desde el correo -- se usa hasta que llegue (o si nunca llega) el perfil real de /api/usuarios/me. */
function buildUserFromSession(session: Session | null): AuthUser | null {
  const email = session?.user?.email;
  if (!session || !email) return null;
  const { displayName, initials } = buildDisplayName(email);
  const rol = (decodeJwtRole(session.access_token) ?? "miembro") as Rol;
  return { id: session.user.id, email, displayName, initials, rol };
}

/**
 * Se incrementa en cada cambio de sesión (login, logout, cambio de cuenta) para que la
 * respuesta de /api/usuarios/me de una sesión vieja no pise el estado de una más nueva si
 * llega tarde (ej. el usuario cierra sesión mientras ese fetch seguía en vuelo).
 */
let profileRequestId = 0;

/**
 * Completa el perfil aproximado (buildUserFromSession) con el nombre/apellido/iniciales/rol
 * reales de GET /api/usuarios/me (agregado 2026-08-26 -- antes UsuariosController era
 * exclusivo de super_admin y no había forma de que nadie más supiera su propio perfil).
 * Si la cuenta todavía no tiene fila de negocio (recién invitada, o el super_admin sembrado
 * a mano en Supabase) el backend responde 404 -- no es un error fatal, nos quedamos con la
 * aproximación del correo.
 */
async function refreshProfile(set: (partial: Partial<AuthState>) => void) {
  const requestId = profileRequestId;
  try {
    const perfil = await usuariosApi.me();
    if (requestId !== profileRequestId) return; // una sesión más nueva ya tomó su lugar
    const nombreCompleto = `${perfil.nombre} ${perfil.apellido}`.trim();
    const initials =
      (perfil.iniciales && perfil.iniciales.trim()) ||
      `${perfil.nombre[0] ?? ""}${perfil.apellido[0] ?? ""}`.toUpperCase() ||
      "U";
    set({
      user: {
        id: perfil.id,
        email: perfil.email,
        displayName: nombreCompleto || perfil.email,
        initials,
        rol: perfil.rol,
      },
      estadoPerfil: perfil.activo ? "completo" : "inactivo",
    });
  } catch (error) {
    if (requestId !== profileRequestId) return;
    // 404 = la cuenta existe en Supabase Auth pero todavía no tiene perfil en Nexit: no es un
    // error, es exactamente el caso de alguien recién invitado que aún no se ha registrado.
    if (error instanceof ApiError && error.statusCode === 404) {
      set({ estadoPerfil: "sin-perfil" });
      return;
    }
    if (!(error instanceof ApiError)) {
      console.error("No se pudo cargar /api/usuarios/me", error);
    }
    // Cualquier otra cosa (backend caído, sin red, 500): no se sabe, y se deja pasar --
    // ver el comentario de EstadoPerfil sobre por qué no se cierra la puerta acá.
    set({ estadoPerfil: "indeterminado" });
  }
}

/**
 * Sesión real de Supabase Auth (docs/10). El login en sí (OTP, contraseña, crear
 * contraseña) vive en src/app/login/page.tsx, hablando directo con `supabase` --
 * este store solo refleja el estado de la sesión, no la crea.
 */
export const useAuthStore = create<AuthState>((set) => {
  // Qué cuenta (Supabase Auth id) está autenticada ahora mismo, para distinguir un cambio de
  // sesión real de un simple refresco de token.
  let userIdActual: string | null = null;

  /**
   * Supabase renueva el access token solo (y dispara TOKEN_REFRESHED) cada vez que la pestaña
   * vuelve a tener foco o el token está por vencer -- para la MISMA cuenta ya autenticada, varias
   * veces por hora. Antes, cada uno de esos eventos volvía a poner estadoPerfil en "cargando", lo
   * que apagaba el dashboard entero (ver el guard de abajo) y disparaba de nuevo GET /api/usuarios/me
   * y todas las cargas de cada pantalla -- por fuera se sentía como que "la plataforma se recarga
   * sola" cada rato. Ahora solo se trata como sesión nueva (y se vuelve a pedir el perfil) cuando la
   * cuenta autenticada de verdad cambió: inició sesión, cerró sesión, o cambió de cuenta.
   */
  const handleSession = (session: Session | null) => {
    const userIdNuevo = session?.user?.id ?? null;
    if (userIdNuevo === userIdActual) {
      // Mismo usuario, token renovado: solo se actualiza el rol (por si cambió), sin tocar
      // estadoPerfil ni volver a pedir el perfil -- nada de esto debe verse en la interfaz.
      // Ojo: NO se reemplaza `user` por la aproximación del correo (buildUserFromSession). Antes sí,
      // y cada refresco de token (varias veces por hora, o al volver a la pestaña) pisaba el nombre
      // y las iniciales reales de /api/usuarios/me por los derivados del correo.
      if (session) {
        set((state) => {
          if (state.estadoPerfil !== "completo" || !state.user) return { user: buildUserFromSession(session) };
          const rolDelToken = decodeJwtRole(session.access_token);
          return rolDelToken ? { user: { ...state.user, rol: rolDelToken as Rol } } : {};
        });
      }
      return;
    }
    userIdActual = userIdNuevo;
    profileRequestId++;
    set({
      user: buildUserFromSession(session),
      hydrated: true,
      estadoPerfil: session ? "cargando" : "indeterminado",
    });
    if (session) void refreshProfile(set);
  };

  supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));
  supabase.auth.onAuthStateChange((_event, session) => handleSession(session));

  return {
    user: null,
    hydrated: false,
    estadoPerfil: "cargando",
    logout: async () => {
      profileRequestId++; // invalida cualquier /me en vuelo antes de que termine de cerrar sesión
      await supabase.auth.signOut({ scope: "local" });
      set({ user: null, estadoPerfil: "indeterminado" });
    },
    recargarPerfil: async () => {
      profileRequestId++;
      set({ estadoPerfil: "cargando" });
      await refreshProfile(set);
    },
  };
});
