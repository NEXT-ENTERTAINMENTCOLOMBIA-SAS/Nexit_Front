"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Building2, CalendarCheck2, CornerDownLeft, Search, Truck } from "lucide-react";
import { NAV } from "@/lib/nav-items";
import { proyectosApi } from "@/services/api/proyectos-service";
import { useClientesStore } from "@/store/clientes-store";
import { useProvidersStore } from "@/store/providers-store";

interface Resultado {
  clave: string;
  grupo: "Ir a" | "Proyectos" | "Clientes" | "Proveedores";
  titulo: string;
  detalle?: string;
  href: string;
}

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ICONOS = { Proyectos: CalendarCheck2, Clientes: Building2, Proveedores: Truck } as const;

/**
 * Buscador global (Ctrl+K / ⌘K, 2026-10-05): una sola caja para saltar a cualquier proyecto, cliente,
 * proveedor o sección, sin importar en qué pantalla se esté. Proyectos se buscan en el servidor
 * (no hace falta tenerlos cargados); clientes y proveedores usan las listas que ya cargó la app.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [proyectos, setProyectos] = useState<Resultado[]>([]);
  const [activo, setActivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const clientes = useClientesStore((s) => s.items);
  const fetchClientes = useClientesStore((s) => s.fetchAll);
  const proveedores = useProvidersStore((s) => s.items);
  const fetchProveedores = useProvidersStore((s) => s.fetchAll);

  useEffect(() => {
    if (!open) return;
    void fetchClientes();
    void fetchProveedores();
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, fetchClientes, fetchProveedores]);

  // Proyectos: búsqueda en el servidor con un pequeño retraso para no pedir en cada tecla.
  useEffect(() => {
    const texto = q.trim();
    if (!open || texto.length < 2) return;
    let vivo = true;
    const id = window.setTimeout(() => {
      proyectosApi
        .pagina({ q: texto, pageSize: 6 })
        .then((r) => {
          if (!vivo) return;
          setProyectos(
            r.items.map((p) => ({
              clave: `p-${p.id}`,
              grupo: "Proyectos" as const,
              titulo: p.nombre,
              detalle: p.fechaEvento?.slice(0, 10),
              href: `/proyectos?open=${p.id}`,
            })),
          );
        })
        .catch(() => vivo && setProyectos([]));
    }, 220);
    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [q, open]);

  const resultados = useMemo<Resultado[]>(() => {
    const t = norm(q.trim());
    if (!t) return NAV.map((n) => ({ clave: `n-${n.href}`, grupo: "Ir a" as const, titulo: n.label, href: n.href }));
    const secciones = NAV.filter((n) => norm(n.label).includes(t)).map((n) => ({ clave: `n-${n.href}`, grupo: "Ir a" as const, titulo: n.label, href: n.href }));
    const cl = clientes
      .filter((c) => norm(c.nombre).includes(t) || norm(c.contacto ?? "").includes(t))
      .slice(0, 6)
      .map((c) => ({ clave: `c-${c.id}`, grupo: "Clientes" as const, titulo: c.nombre, detalle: c.contacto ?? undefined, href: `/clientes?open=${c.id}` }));
    const pr = proveedores
      .filter((p) => norm(p.nombre).includes(t) || norm(p.contacto ?? "").includes(t))
      .slice(0, 6)
      .map((p) => ({ clave: `v-${p.id}`, grupo: "Proveedores" as const, titulo: p.nombre, detalle: p.contacto ?? undefined, href: `/proveedores?open=${p.id}` }));
    return [...secciones, ...(q.trim().length >= 2 ? proyectos : []), ...cl, ...pr];
  }, [q, clientes, proveedores, proyectos]);

  function cerrar() {
    setQ("");
    setProyectos([]);
    setActivo(0);
    onClose();
  }

  function ir(r: Resultado) {
    cerrar();
    router.push(r.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return cerrar();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((a) => Math.min(a + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && resultados[activo]) {
      e.preventDefault();
      ir(resultados[activo]);
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onMouseDown={cerrar}>
      <div
        role="dialog"
        aria-label="Buscador global"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-[560px] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[0_24px_70px_rgba(12,12,12,0.28)]"
      >
        <label className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search size={16} strokeWidth={1.8} className="text-text-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActivo(0);
            }}
            placeholder="Buscar proyecto, cliente, proveedor o sección…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-3"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-3">Esc</kbd>
        </label>
        <div className="max-h-[52vh] overflow-y-auto py-1">
          {resultados.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-text-3">Sin resultados para “{q.trim()}”.</div>}
          {resultados.map((r, i) => {
            const cabecera = i === 0 || resultados[i - 1].grupo !== r.grupo;
            const Icono = r.grupo === "Ir a" ? null : ICONOS[r.grupo];
            return (
              <div key={r.clave}>
                {cabecera && <div className="px-4 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-widest text-text-3">{r.grupo}</div>}
                <button
                  type="button"
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => ir(r)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left ${i === activo ? "bg-hover-bg" : ""}`}
                >
                  {Icono && <Icono size={14} strokeWidth={1.8} className="flex-shrink-0 text-text-3" />}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{r.titulo}</span>
                  {r.detalle && <span className="truncate text-[11.5px] text-text-3">{r.detalle}</span>}
                  {i === activo && <CornerDownLeft size={12} className="flex-shrink-0 text-text-3" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
