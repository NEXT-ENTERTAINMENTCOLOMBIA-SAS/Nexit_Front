// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { esSeccionValida, getLastSection, rememberSection } from "./last-section";

/**
 * La última sección guardada solo se restaura si todavía existe en la navegación -- antes, quien
 * tenía guardada una sección eliminada (Informes, Calendario) caía en un 404 al iniciar sesión.
 */
describe("last-section", () => {
  beforeEach(() => window.localStorage.clear());

  it("esSeccionValida acepta las secciones de la navegación y sus subrutas", () => {
    expect(esSeccionValida("/clientes")).toBe(true);
    expect(esSeccionValida("/proyectos/123")).toBe(true);
    expect(esSeccionValida("/project-managers")).toBe(true);
  });

  it("esSeccionValida rechaza rutas eliminadas, desconocidas o que solo se parecen", () => {
    expect(esSeccionValida("/informe")).toBe(false);
    expect(esSeccionValida("/calendario")).toBe(false);
    expect(esSeccionValida("/clientesfalso")).toBe(false);
    expect(esSeccionValida("/login")).toBe(false);
    expect(esSeccionValida("https://evil.example")).toBe(false);
  });

  it("getLastSection devuelve Clientes si lo guardado ya no existe", () => {
    window.localStorage.setItem("nexit:lastSection", "/informe");
    expect(getLastSection()).toBe("/clientes");
  });

  it("getLastSection devuelve lo guardado si sigue siendo válido", () => {
    window.localStorage.setItem("nexit:lastSection", "/proveedores");
    expect(getLastSection()).toBe("/proveedores");
  });

  it("rememberSection no guarda rutas que no son del dashboard", () => {
    rememberSection("/registro");
    expect(window.localStorage.getItem("nexit:lastSection")).toBeNull();
    rememberSection("/proyectos");
    expect(window.localStorage.getItem("nexit:lastSection")).toBe("/proyectos");
  });
});
