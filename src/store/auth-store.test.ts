import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Dos cosas puntuales de este store, ambas mencionadas como fortalezas de
 * arquitectura -- acá se prueba que de verdad se comportan así, no solo que
 * el código "se ve bien":
 *
 * 1. El nombre/iniciales que se derivan del correo mientras se espera el
 *    perfil real de /api/usuarios/me.
 * 2. La guarda contra condición de carrera (profileRequestId): si la
 *    respuesta de /me de una sesión vieja llega DESPUÉS que la de una sesión
 *    más nueva, no debe pisar el estado -- si esto no funcionara, cambiar de
 *    cuenta rápido (o cerrar sesión justo cuando esa petición está en vuelo)
 *    podría dejar a alguien viendo el nombre/rol de otra cuenta.
 */
type OnAuthStateChangeCallback = (event: string, session: unknown) => void;
let authStateCallback: OnAuthStateChangeCallback | undefined;

const getSessionMock = vi.fn();
const meMock = vi.fn();

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: (cb: OnAuthStateChangeCallback) => {
        authStateCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock("@/lib/jwt", () => ({ decodeJwtRole: () => "miembro" }));

vi.mock("@/services/api/usuarios-service", () => ({ usuariosApi: { me: meMock } }));

function session(email: string, id: string) {
  return { user: { id, email }, access_token: "token-de-prueba" };
}

/** Promesa que se resuelve manualmente desde el test, para controlar el orden de llegada. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetModules();
  authStateCallback = undefined;
  getSessionMock.mockReset().mockResolvedValue({ data: { session: null } });
  meMock.mockReset();
});

describe("useAuthStore -- nombre/iniciales derivados del correo", () => {
  it.each([
    ["juan.perez@empresa.com", "Juan Perez", "JP"],
    ["ana_maria@empresa.com", "Ana Maria", "AM"],
    ["admin@empresa.com", "Admin", "A"],
  ])("%s -> displayName=%s, initials=%s", async (email, displayName, initials) => {
    meMock.mockReturnValue(new Promise(() => {})); // /me nunca resuelve en esta prueba: solo interesa la aproximación inicial
    const { useAuthStore } = await import("./auth-store");
    authStateCallback!("SIGNED_IN", session(email, "u1"));
    const user = useAuthStore.getState().user;
    expect(user?.displayName).toBe(displayName);
    expect(user?.initials).toBe(initials);
  });
});

describe("useAuthStore -- un refresco de token de la MISMA cuenta no reinicia el perfil", () => {
  it("TOKEN_REFRESHED no vuelve a poner estadoPerfil en \"cargando\" ni repite GET /api/usuarios/me", async () => {
    // Esto es justo lo que Supabase dispara cada vez que la pestaña recupera el foco -- si esto
    // reiniciara estadoPerfil, el layout entero desaparece (ver el guard en (dashboard)/layout.tsx)
    // y toda la pantalla vuelve a cargar de cero: el bug de "la plataforma se recarga sola".
    meMock.mockResolvedValue({ id: "user-1", nombre: "Juliana", apellido: "Navarro", iniciales: "", email: "usuario@empresa.com", rol: "admin", activo: true });
    const { useAuthStore } = await import("./auth-store");

    authStateCallback!("SIGNED_IN", session("usuario@empresa.com", "user-1"));
    await Promise.resolve();
    await Promise.resolve();
    expect(useAuthStore.getState().estadoPerfil).toBe("completo");
    expect(meMock).toHaveBeenCalledTimes(1);

    authStateCallback!("TOKEN_REFRESHED", session("usuario@empresa.com", "user-1"));
    expect(useAuthStore.getState().estadoPerfil).toBe("completo");
    expect(meMock).toHaveBeenCalledTimes(1);
  });

  it("TOKEN_REFRESHED conserva el nombre y las iniciales reales (antes los pisaba con los del correo)", async () => {
    meMock.mockResolvedValue({ id: "user-1", nombre: "Juliana", apellido: "Navarro", iniciales: "", email: "usuario@empresa.com", rol: "admin", activo: true });
    const { useAuthStore } = await import("./auth-store");

    authStateCallback!("SIGNED_IN", session("usuario@empresa.com", "user-1"));
    await Promise.resolve();
    await Promise.resolve();
    expect(useAuthStore.getState().user?.displayName).toBe("Juliana Navarro");
    expect(useAuthStore.getState().user?.initials).toBe("JN");

    authStateCallback!("TOKEN_REFRESHED", session("usuario@empresa.com", "user-1"));
    expect(useAuthStore.getState().user?.displayName).toBe("Juliana Navarro");
    expect(useAuthStore.getState().user?.initials).toBe("JN");
  });
});

describe("useAuthStore -- guarda contra condición de carrera al cambiar de sesión", () => {
  it("una respuesta de /me de una sesión vieja que llega tarde NO pisa a la sesión nueva", async () => {
    const { useAuthStore } = await import("./auth-store");

    const meA = deferred<{ id: string; nombre: string; apellido: string; iniciales: string; email: string; rol: string }>();
    const meB = deferred<{ id: string; nombre: string; apellido: string; iniciales: string; email: string; rol: string }>();
    meMock.mockReturnValueOnce(meA.promise).mockReturnValueOnce(meB.promise);

    // Sesión A entra primero -- dispara su fetch a /me (todavía sin resolver).
    authStateCallback!("SIGNED_IN", session("usuarioA@empresa.com", "user-A"));
    // Antes de que /me de A responda, la cuenta cambia a B -- dispara su propio fetch a /me.
    authStateCallback!("SIGNED_IN", session("usuarioB@empresa.com", "user-B"));

    // Llega primero la respuesta de la sesión NUEVA (B).
    meB.resolve({ id: "user-B", nombre: "Beatriz", apellido: "Bravo", iniciales: "", email: "usuarioB@empresa.com", rol: "miembro" });
    await Promise.resolve();
    await Promise.resolve();
    expect(useAuthStore.getState().user?.displayName).toBe("Beatriz Bravo");

    // Llega tarde la respuesta de la sesión VIEJA (A) -- no debe pisar a B.
    meA.resolve({ id: "user-A", nombre: "Andrés", apellido: "Amaya", iniciales: "", email: "usuarioA@empresa.com", rol: "miembro" });
    await Promise.resolve();
    await Promise.resolve();

    expect(useAuthStore.getState().user?.displayName).toBe("Beatriz Bravo");
    expect(useAuthStore.getState().user?.id).toBe("user-B");
  });

  it("cerrar sesión mientras /me sigue en vuelo tampoco resucita ese perfil viejo", async () => {
    const { useAuthStore } = await import("./auth-store");

    const me = deferred<{ id: string; nombre: string; apellido: string; iniciales: string; email: string; rol: string }>();
    meMock.mockReturnValueOnce(me.promise);

    authStateCallback!("SIGNED_IN", session("usuario@empresa.com", "user-1"));
    await useAuthStore.getState().logout(); // profileRequestId++ antes de que /me responda

    me.resolve({ id: "user-1", nombre: "Nombre", apellido: "Viejo", iniciales: "", email: "usuario@empresa.com", rol: "miembro" });
    await Promise.resolve();
    await Promise.resolve();

    expect(useAuthStore.getState().user).toBeNull();
  });
});
