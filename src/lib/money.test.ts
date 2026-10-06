import { describe, expect, it } from "vitest";
import { formatMoney, limpiarMonto, montoANumero, mostrarMonto, numeroAMonto } from "./money";

describe("money", () => {
  it("limpia lo que escribe la persona", () => {
    expect(limpiarMonto("1.500.000")).toBe("1500000");
    expect(limpiarMonto("$ 2.500,75")).toBe("2500.75");
    expect(limpiarMonto("abc")).toBe("");
    expect(limpiarMonto("0012")).toBe("12");
    expect(limpiarMonto("10,999")).toBe("10.99");
  });
  it("muestra con separador de miles", () => {
    expect(mostrarMonto("1500000")).toBe("1.500.000");
    expect(mostrarMonto("2500.75")).toBe("2.500,75");
    expect(mostrarMonto("")).toBe("");
  });
  it("convierte de ida y vuelta", () => {
    expect(montoANumero("1500000")).toBe(1500000);
    expect(montoANumero("")).toBeNull();
    expect(numeroAMonto(1200.5)).toBe("1200.5");
    expect(numeroAMonto(null)).toBe("");
  });
  it("formatea moneda", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(1500000, "COP")).toMatch(/1\.500\.000/);
    expect(formatMoney(1200, "USD")).toMatch(/1\.200/);
  });
});
