/** Dinero (2026-10-05): antes los valores eran texto libre; ahora son número + moneda. */

export const MONEDAS = ["COP", "USD", "EUR", "MXN"] as const;
export type Moneda = (typeof MONEDAS)[number];

/** Formatea un monto para mostrarlo: "$ 1.500.000" (COP) o "US$ 1.200,50". Devuelve "—" si no hay monto. */
export function formatMoney(monto?: number | null, moneda: string = "COP"): string {
  if (monto == null || Number.isNaN(monto)) return "—";
  const codigo = (MONEDAS as readonly string[]).includes(moneda) ? moneda : "COP";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: codigo,
    maximumFractionDigits: codigo === "COP" ? 0 : 2,
  }).format(monto);
}

/**
 * Convierte lo que escribe la persona a un texto numérico limpio con punto decimal ("1500000.5").
 * Acepta solo dígitos y UNA coma como decimal (formato es-CO: el punto es separador de miles y se ignora).
 * Máximo 2 decimales.
 */
export function limpiarMonto(entrada: string): string {
  const soloValidos = entrada.replace(/[^\d,]/g, "");
  const [entero, ...resto] = soloValidos.split(",");
  const enteroLimpio = entero.replace(/^0+(?=\d)/, "");
  if (resto.length === 0) return enteroLimpio;
  return `${enteroLimpio || "0"}.${resto.join("").slice(0, 2)}`;
}

/** Texto limpio ("1500000.5") → lo que se ve en el campo ("1.500.000,5"). */
export function mostrarMonto(limpio: string): string {
  if (!limpio) return "";
  const [entero, decimal] = limpio.split(".");
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal !== undefined ? `${conPuntos},${decimal}` : conPuntos;
}

/** Texto limpio → número para enviar a la API (null si está vacío). */
export function montoANumero(limpio: string): number | null {
  if (!limpio.trim()) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Número de la API → texto limpio para el formulario. */
export function numeroAMonto(valor?: number | null): string {
  return valor == null ? "" : String(valor);
}
