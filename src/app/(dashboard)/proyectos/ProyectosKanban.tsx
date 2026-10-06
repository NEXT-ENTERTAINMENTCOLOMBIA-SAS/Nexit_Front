"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { PROJECT_STATUS_COLORS, statusColor } from "@/lib/constants";
import { fmtDateShort } from "@/lib/format";
import type { EstadoProyecto, Proyecto } from "@/types/api";

/**
 * Tablero por estado (2026-10-05): una columna por estado del proyecto. Arrastrar una tarjeta a otra
 * columna cambia su estado. Muestra los proyectos de la consulta actual (hasta 200), así que los
 * filtros de arriba también acotan el tablero.
 */
export function ProyectosKanban({
  proyectos,
  estados,
  clienteNombre,
  pmNombre,
  onOpen,
  onMover,
}: {
  proyectos: Proyecto[];
  estados: EstadoProyecto[];
  clienteNombre: (id?: string | null) => string | undefined;
  pmNombre: (id?: string | null) => string | undefined;
  onOpen: (p: Proyecto) => void;
  onMover: (p: Proyecto, estadoId: string) => void;
}) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3" role="list" aria-label="Tablero de proyectos por estado">
      {estados.map((estado) => {
        const items = proyectos.filter((p) => p.estadoId === estado.id);
        const st = statusColor(PROJECT_STATUS_COLORS, estado.nombre);
        return (
          <section
            key={estado.id}
            role="listitem"
            onDragOver={(e) => {
              e.preventDefault();
              setEncima(estado.id);
            }}
            onDragLeave={() => setEncima((v) => (v === estado.id ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              setEncima(null);
              const p = proyectos.find((x) => x.id === e.dataTransfer.getData("text/plain"));
              if (p && p.estadoId !== estado.id) onMover(p, estado.id);
            }}
            className={`flex w-[270px] flex-shrink-0 flex-col rounded-[var(--radius-lg)] border bg-soft ${encima === estado.id ? "border-text" : "border-border"}`}
          >
            <header className="flex items-center gap-2 border-b border-divider px-3 py-2.5">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: st.c }} aria-hidden />
              <h3 className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{estado.nombre}</h3>
              <span className="font-mono text-[11px] text-text-3">{items.length}</span>
            </header>
            <div className="flex max-h-[62vh] min-h-[72px] flex-col gap-2 overflow-y-auto p-2">
              {items.length === 0 && <div className="px-1 py-3 text-center text-[12px] text-text-3">Sin proyectos</div>}
              {items.map((p) => (
                <article
                  key={p.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", p.id);
                    e.dataTransfer.effectAllowed = "move";
                    setArrastrando(p.id);
                  }}
                  onDragEnd={() => setArrastrando(null)}
                  onClick={() => onOpen(p)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onOpen(p)}
                  className={`cursor-grab rounded-[var(--radius-md)] border border-border bg-surface p-2.5 transition-shadow hover:shadow-[0_2px_10px_rgba(12,12,12,.08)] active:cursor-grabbing ${arrastrando === p.id ? "opacity-40" : ""}`}
                >
                  <div className="truncate text-[13px] font-medium">{p.nombre || "(Sin nombre)"}</div>
                  <div className="mt-0.5 truncate text-[11.5px] text-text-3">{clienteNombre(p.clienteId) || "Sin cliente"}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-text-2">
                    <Calendar size={12} strokeWidth={1.8} className="flex-shrink-0 text-text-3" />
                    <span className="truncate">{fmtDateShort(p.fechaEvento?.slice(0, 10)) || "Sin fecha"}</span>
                    <span className="ml-auto truncate text-text-3">{pmNombre(p.gerenteId) ?? "Sin PM"}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
