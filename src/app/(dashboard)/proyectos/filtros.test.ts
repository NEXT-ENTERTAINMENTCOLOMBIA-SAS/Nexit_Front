import { describe, expect, it } from "vitest";
import { FILTROS_VACIOS, filtrosAUrl, filtrosDesdeUrl } from "./filtros";

describe("filtros de proyectos en el enlace", () => {
  it("ida y vuelta", () => {
    const f = { ...FILTROS_VACIOS, search: "feria", estadoId: "abc", alerta: "sinPm" as const, vista: "board" as const };
    const url = filtrosAUrl(f);
    expect(filtrosDesdeUrl(new URLSearchParams(url))).toEqual({ search: "feria", estadoId: "abc", alerta: "sinPm", vista: "board" });
  });
  it("sin filtros no escribe nada", () => {
    expect(filtrosAUrl(FILTROS_VACIOS)).toBe("");
    expect(filtrosDesdeUrl(new URLSearchParams(""))).toBeNull();
  });
  it("ignora valores desconocidos", () => {
    expect(filtrosDesdeUrl(new URLSearchParams("alerta=hack&vista=otra"))).toBeNull();
  });
});
