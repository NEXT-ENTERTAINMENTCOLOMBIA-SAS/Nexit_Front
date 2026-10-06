"use client";

import { MONEDAS, limpiarMonto, mostrarMonto } from "@/lib/money";

/**
 * Campo de dinero: monto con separador de miles mientras se escribe + selector de moneda.
 * `valor` es el texto limpio ("1500000.5", ver lib/money.ts); `moneda` es COP/USD/EUR/MXN.
 */
export function MoneyInput({
  valor,
  moneda,
  onChange,
  placeholder = "0",
  invalid,
}: {
  valor: string;
  moneda: string;
  onChange: (valor: string, moneda: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const borde = invalid ? "border-red focus-within:border-red" : "border-border focus-within:border-teal-mid";
  return (
    <div className={`flex w-full overflow-hidden rounded-[var(--radius-md)] border bg-surface transition-colors ${borde}`}>
      <select
        aria-label="Moneda"
        value={moneda}
        onChange={(e) => onChange(valor, e.target.value)}
        className="border-r border-border bg-gray-light px-2 py-2 font-mono text-[12px] text-text-2 outline-none"
      >
        {MONEDAS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <input
        inputMode="decimal"
        aria-label="Monto"
        value={mostrarMonto(valor)}
        onChange={(e) => onChange(limpiarMonto(e.target.value), moneda)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[13px] text-text outline-none"
      />
    </div>
  );
}
