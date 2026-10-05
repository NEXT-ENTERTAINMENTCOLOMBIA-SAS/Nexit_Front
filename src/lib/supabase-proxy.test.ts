import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Pruebas de la decisión de acceso más importante del frontend: quién entra
 * a qué ruta (docs/31, respuesta a "no quiero que nadie se pueda meter a
 * esta página"). No usa un backend real de Supabase -- se simula
 * `createServerClient().auth.getClaims()` para poder probar los tres casos
 * (sin sesión, con sesión válida, con sesión inválida/falsificada) sin red.
 */
const getClaimsMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims: getClaimsMock },
  }),
}));

// updateSession se importa después del mock de arriba (hoisted por vitest).
const { updateSession } = await import("./supabase-proxy");

function makeRequest(path: string, cookie?: string) {
  const headers = cookie ? { cookie } : undefined;
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-de-prueba");
  getClaimsMock.mockReset();
});

describe("updateSession -- sin sesión (anónimo)", () => {
  beforeEach(() => {
    getClaimsMock.mockResolvedValue({ data: null });
  });

  it("redirige /proveedores a /login", async () => {
    const res = await updateSession(makeRequest("/proveedores"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirige la raíz / a /login", async () => {
    const res = await updateSession(makeRequest("/"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirige una ruta desconocida a /login (seguro por defecto)", async () => {
    const res = await updateSession(makeRequest("/esto-no-existe"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("deja pasar /login sin redirigir", async () => {
    const res = await updateSession(makeRequest("/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("no bloquea todas las rutas protegidas conocidas (clientes, project managers, proyectos, usuarios)", async () => {
    for (const path of ["/clientes", "/project-managers", "/proyectos", "/usuarios"]) {
      const res = await updateSession(makeRequest(path));
      expect(new URL(res.headers.get("location")!).pathname, `path ${path}`).toBe("/login");
    }
  });
});

describe("updateSession -- sesión válida", () => {
  beforeEach(() => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-123" } } });
  });

  it("deja pasar una ruta protegida", async () => {
    const res = await updateSession(makeRequest("/proveedores"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("saca de /login hacia el dashboard (no tiene sentido mostrar el login otra vez)", async () => {
    const res = await updateSession(makeRequest("/login"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/proveedores");
  });

  it("saca de la raíz / hacia el dashboard", async () => {
    const res = await updateSession(makeRequest("/"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/proveedores");
  });
});

describe("updateSession -- cookie de sesión falsificada/inválida", () => {
  beforeEach(() => {
    // getClaims() real rechaza un JWT con firma inválida devolviendo error, no claims.
    getClaimsMock.mockResolvedValue({ data: null, error: new Error("invalid JWT signature") });
  });

  it("no deja pasar con una cookie falsificada -- se trata igual que anónimo", async () => {
    const res = await updateSession(makeRequest("/proveedores", "sb-access-token=esto.no.es.un.jwt.valido"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});

describe("updateSession -- entorno mal configurado", () => {
  it("no bloquea a todo el mundo si faltan las variables de Supabase (evita un despliegue roto = app inaccesible)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const res = await updateSession(makeRequest("/proveedores"));
    expect(res.headers.get("location")).toBeNull();
    expect(getClaimsMock).not.toHaveBeenCalled();
  });
});
