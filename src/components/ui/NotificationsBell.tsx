"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Bell, BellOff, CheckCheck, ShieldQuestion, UserPlus, UserX, X } from "lucide-react";
import { haceCuanto } from "@/lib/format";
import { fmtFechaHora } from "@/lib/historial";
import { notificacionesApi } from "@/services/api/notificaciones-service";
import type { Notificacion } from "@/types/api";

/** A qué pantalla manda cada tipo de entidad -- "proyectos" ya sabe abrir el detalle directo
 * vía ?open=id (ver proyectos/page.tsx); clientes y proveedores todavía no leen ese query
 * param, así que ahí el clic solo lleva a la lista (mejor que no ir a ningún lado). */
const RUTA_POR_ENTIDAD: Record<string, string> = {
  cliente: "/clientes",
  proveedor: "/proveedores",
  proyecto: "/proyectos",
};

/**
 * Ícono y color por tipo de notificación. De un vistazo se distingue "alguien quiere borrar algo"
 * de "alguien entró al equipo", sin tener que leer el título entero -- que es de lo que sirve un
 * panel de notificaciones frente a una lista de textos.
 */
const ESTILO_POR_TIPO: Record<string, { icon: typeof Bell; bg: string; c: string }> = {
  solicitud_eliminacion_creada: { icon: ShieldQuestion, bg: "#FBF0DC", c: "#7A4E00" },
  solicitud_eliminacion_endosada: { icon: ShieldQuestion, bg: "#E6F1FB", c: "#0C447C" },
  solicitud_eliminacion_decidida: { icon: ShieldQuestion, bg: "#F1EFE8", c: "#444441" },
  invitacion_aceptada: { icon: UserPlus, bg: "#E4F9EE", c: "#036B3C" },
  invitacion_rechazada: { icon: UserX, bg: "#FCEBEB", c: "#791F1F" },
};
const ESTILO_POR_DEFECTO = { icon: Bell, bg: "var(--gray-light)", c: "var(--text-2)" };

/**
 * Campana de notificaciones del topbar. La bandeja es la del backend real
 * (`NotificacionesController`, bandeja propia genérica de tipo/título/mensaje).
 *
 * Rediseñado 2026-09-08 sobre el panel original del mockup, que era una lista plana de
 * título+mensaje: ahora cada fila trae su ícono por tipo y cuánto hace que llegó, las no leídas se
 * separan de las anteriores en dos grupos, y hay "marcar todas" -- lo que uno espera de un panel de
 * notificaciones y lo que hace la diferencia entre revisarlo y ignorarlo. Marcar todas se hace fila
 * por fila contra `marcar-leida` porque el backend no tiene un endpoint para el lote; con el volumen
 * real de la bandeja (decenas, no miles) no se nota.
 */
export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    notificacionesApi
      .misNotificaciones()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const noLeidas = items.filter((n) => !n.leida);
  const leidas = items.filter((n) => n.leida);

  async function markRead(n: Notificacion) {
    if (!n.leida) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      try {
        await notificacionesApi.marcarLeida(n.id);
      } catch {
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: false } : x)));
      }
    }
    setOpen(false);
    const ruta = n.tipoEntidad ? RUTA_POR_ENTIDAD[n.tipoEntidad] : undefined;
    if (ruta) router.push(n.tipoEntidad === "proyecto" && n.entidadId ? `${ruta}?open=${n.entidadId}` : ruta);
  }

  async function markAllRead() {
    const pendientes = items.filter((n) => !n.leida);
    if (pendientes.length === 0) return;
    setItems((prev) => prev.map((x) => ({ ...x, leida: true })));
    // Si alguna falla, se recarga la bandeja de verdad en vez de adivinar cuáles quedaron.
    const resultados = await Promise.allSettled(pendientes.map((n) => notificacionesApi.marcarLeida(n.id)));
    if (resultados.some((r) => r.status === "rejected")) {
      notificacionesApi.misNotificaciones().then(setItems).catch(() => {});
    }
  }

  // Ícono de X por fila: descarta (borra de verdad) una notificación ya vista -- no navega ni la
  // marca leída, así que el clic en la X no dispara markRead (ver stopPropagation abajo).
  async function dismiss(n: Notificacion, e: ReactMouseEvent) {
    e.stopPropagation();
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    try {
      await notificacionesApi.descartar(n.id);
    } catch {
      // Si falla, se recarga la bandeja real en vez de dejarla desincronizada.
      notificacionesApi.misNotificaciones().then(setItems).catch(() => {});
    }
  }

  function fila(n: Notificacion) {
    const estilo = ESTILO_POR_TIPO[n.tipo] ?? ESTILO_POR_DEFECTO;
    const Icon = estilo.icon;
    return (
      <div
        key={n.id}
        role="menuitem"
        className={clsx(
          "group flex w-full items-start gap-3 border-b border-[#EFEDE7] px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-[#F4F3EF]",
          !n.leida && "bg-[#FBFAF7]",
        )}
      >
        <button type="button" onClick={() => markRead(n)} className="flex min-w-0 flex-1 gap-3 text-left">
          <span
            aria-hidden
            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: estilo.bg, color: estilo.c }}
          >
            <Icon size={15} strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-1.5">
              <span className={clsx("flex-1 text-[13px] leading-snug", n.leida ? "font-medium text-text-2" : "font-semibold text-text")}>
                {n.titulo}
              </span>
              {!n.leida && <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green" />}
            </span>
            <span className="mt-0.5 block text-[12px] leading-snug text-text-2">{n.mensaje}</span>
            <span className="mt-1 block font-mono text-[10.5px] text-text-3" title={fmtFechaHora(n.fechaCreacion)}>
              {haceCuanto(n.fechaCreacion)}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label="Descartar esta notificación"
          onClick={(e) => dismiss(n, e)}
          className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-text-3 opacity-0 transition-opacity hover:bg-gray-light hover:text-text group-hover:opacity-100"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={noLeidas.length > 0 ? `Notificaciones, ${noLeidas.length} sin leer` : "Notificaciones"}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-transparent text-text transition-colors hover:bg-gray-light"
      >
        <Bell size={17} strokeWidth={1.8} />
        {noLeidas.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red px-1 text-[10px] font-semibold leading-none text-white">
            {noLeidas.length > 9 ? "9+" : noLeidas.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1.5 flex max-h-[70vh] w-[380px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-text bg-surface shadow-[0_16px_44px_rgba(12,12,12,0.18)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold">Notificaciones</span>
              {noLeidas.length > 0 && (
                <span className="rounded-[20px] bg-text px-[7px] py-[2px] font-mono text-[10px] font-medium text-green">
                  {noLeidas.length}
                </span>
              )}
            </div>
            {noLeidas.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-text-2 transition-colors hover:text-text"
              >
                <CheckCheck size={13} strokeWidth={2} />
                Marcar todas
              </button>
            )}
          </div>

          <div className="overflow-y-auto">
            {loading ? (
              <div className="px-3.5 py-8 text-center text-[13px] text-text-3">Cargando…</div>
            ) : items.length === 0 ? (
              <div className="px-3.5 py-10 text-center">
                <BellOff size={24} strokeWidth={1.5} className="mx-auto mb-2 text-text-3" />
                <div className="text-[13px] text-text-2">No hay nada pendiente por ahora.</div>
                <div className="mt-1 px-4 text-[12px] leading-snug text-text-3">
                  Aquí llegan las solicitudes de eliminación y las respuestas a tus invitaciones.
                </div>
              </div>
            ) : (
              <>
                {noLeidas.length > 0 && (
                  <>
                    <div className="bg-bg px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
                      Nuevas
                    </div>
                    {noLeidas.map(fila)}
                  </>
                )}
                {leidas.length > 0 && (
                  <>
                    <div className="bg-bg px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-3">
                      Anteriores
                    </div>
                    {leidas.map(fila)}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
