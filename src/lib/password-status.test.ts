import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * password-status.ts evita el bug de "crear contraseña dos veces": la marca `password_set` viaja
 * en user_metadata de Supabase junto con la contraseña, y /login + /registro la consultan para no
 * volver a pedirla. confirmarContrasenaEnBackend ya no se traga el error en silencio.
 */
const confirmarMock = vi.fn();
vi.mock("@/services/api/auth-service", () => ({ authApi: { confirmarContrasena: () => confirmarMock() } }));

const { PASSWORD_SET_METADATA, tieneContrasenaMarcada, confirmarContrasenaEnBackend } = await import("./password-status");

describe("tieneContrasenaMarcada", () => {
  it("es true solo cuando user_metadata.password_set === true", () => {
    expect(tieneContrasenaMarcada({ user_metadata: { password_set: true } })).toBe(true);
    expect(tieneContrasenaMarcada({ user_metadata: { password_set: "true" } })).toBe(false);
    expect(tieneContrasenaMarcada({ user_metadata: {} })).toBe(false);
    expect(tieneContrasenaMarcada(null)).toBe(false);
    expect(tieneContrasenaMarcada(undefined)).toBe(false);
  });

  it("PASSWORD_SET_METADATA es justo lo que tieneContrasenaMarcada reconoce", () => {
    expect(tieneContrasenaMarcada({ user_metadata: { ...PASSWORD_SET_METADATA } })).toBe(true);
  });
});

describe("confirmarContrasenaEnBackend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    confirmarMock.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("devuelve true a la primera sin reintentar", async () => {
    confirmarMock.mockResolvedValue(undefined);
    await expect(confirmarContrasenaEnBackend()).resolves.toBe(true);
    expect(confirmarMock).toHaveBeenCalledTimes(1);
  });

  it("reintenta una vez si falla y devuelve true si el segundo intento funciona", async () => {
    confirmarMock.mockRejectedValueOnce(new Error("429")).mockResolvedValueOnce(undefined);
    const promesa = confirmarContrasenaEnBackend();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promesa).resolves.toBe(true);
    expect(confirmarMock).toHaveBeenCalledTimes(2);
  });

  it("si falla las dos veces devuelve false, avisa en consola y nunca lanza", async () => {
    confirmarMock.mockRejectedValue(new Error("caído"));
    const promesa = confirmarContrasenaEnBackend();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promesa).resolves.toBe(false);
    expect(confirmarMock).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalled();
  });
});
