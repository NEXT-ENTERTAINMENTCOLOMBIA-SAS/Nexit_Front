"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Folders,
  Search,
  Truck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Avatar, Badge, EmptyState, StatCard, TabButton, TabsShell } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/Spinner";
import { PROJECT_STATUS_COLORS, statusColor } from "@/lib/constants";
import { normalizarBusqueda } from "@/components/ui/primitives";
import { panelApi } from "@/services/api/panel-service";
import { useAuthStore } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";
import type { PanelPm, PanelPmProjectManager } from "@/types/api";
import styles from "@/styles/dashboard.module.css";

type Orden = "carga" | "nombre";
type Detalle = "proyectos" | "personas" | "clientes" | "proveedores";

const DETALLES: { id: Detalle; label: string }[] = [
  { id: "proyectos", label: "Proyectos" },
  { id: "personas", label: "Personas" },
  { id: "clientes", label: "Clientes" },
  { id: "proveedores", label: "Proveedores" },
];

function fmtFecha(iso?: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

/** Una cifra con su etiqueta -- la unidad con la que se compara a un Project Manager de un vistazo. */
function Metrica({ n, label, icon: Icon }: { n: number; label: string; icon: typeof Folders }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2.5">
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-3">
        <Icon size={11} strokeWidth={1.8} />
        {label}
      </span>
      <span className="text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{n}</span>
    </div>
  );
}

/** Lista de nombres con cuántos proyectos los involucran -- clientes, proveedores y personas comparten el formato. */
function ListaConConteo({ items, vacio }: { items: { nombre: string; sub?: string; proyectos: number }[]; vacio: string }) {
  if (items.length === 0) return <p className="px-1 py-3 text-[13px] text-text-3">{vacio}</p>;
  return (
    <ul className="flex flex-col">
      {items.map((it) => (
        <li key={it.nombre} className="flex items-center gap-3 border-t border-[#EFEDE7] py-2 text-[13px] first:border-t-0">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{it.nombre}</span>
            {it.sub && <span className="block truncate text-[11.5px] text-text-3">{it.sub}</span>}
          </span>
          <span className="flex-shrink-0 rounded-[20px] bg-gray-light px-2 py-[1px] font-mono text-[11px] text-text-2">
            {it.proyectos} {it.proyectos === 1 ? "proyecto" : "proyectos"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TarjetaProjectManager({ pm, sinAsignar = false, maxCarga }: { pm: PanelPmProjectManager; sinAsignar?: boolean; maxCarga: number }) {
  const [abierta, setAbierta] = useState(false);
  const [detalle, setDetalle] = useState<Detalle>("proyectos");
  const sinProyectos = pm.totalProyectos === 0;
  const carga = maxCarga > 0 ? Math.round((pm.totalProyectos / maxCarga) * 100) : 0;
  const panelId = `pm-${pm.id ?? "sin"}-detalle`;

  return (
    <article
      className={clsx(
        "flex flex-col overflow-hidden rounded-[var(--radius-lg)] border bg-surface shadow-[0_1px_3px_rgba(12,12,12,.04)] transition-shadow hover:shadow-[0_2px_10px_rgba(12,12,12,.07)]",
        sinAsignar ? "border-[#E8D3A4]" : "border-border",
      )}
      style={sinAsignar ? { borderTop: "3px solid var(--amber)" } : undefined}
    >
      <header className="flex items-center gap-3 px-4 pb-3 pt-4">
        {sinAsignar ? (
          <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[3px] bg-amber-light text-amber">
            <AlertTriangle size={17} strokeWidth={1.8} />
          </span>
        ) : (
          <Avatar nombre={pm.nombre} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{pm.nombre}</h3>
            {!sinAsignar && !pm.activo && <Badge bg="var(--gray-light)" color="var(--text-2)">Cuenta desactivada</Badge>}
            {!sinAsignar && pm.activo && sinProyectos && <Badge bg="var(--gray-light)" color="var(--text-2)">Sin proyectos</Badge>}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-text-3">
            {sinAsignar ? "Proyectos sin Project Manager asignado" : (pm.email ?? "")}
          </div>
        </div>
      </header>

      {/* Barra de carga relativa: cuánto pesa este Project Manager frente al que más proyectos tiene. */}
      <div className="px-4 pb-3" aria-hidden>
        <div className="h-[5px] overflow-hidden rounded-full bg-[#EFEDE7]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.max(carga, pm.totalProyectos > 0 ? 4 : 0)}%`, background: sinAsignar ? "var(--amber)" : "var(--text)" }}
          />
        </div>
      </div>

      <div className="mx-4 grid grid-cols-4 divide-x divide-[#EFEDE7] rounded-[var(--radius-md)] border border-[#EFEDE7] bg-bg/60">
        <Metrica n={pm.totalProyectos} label="Proy." icon={Folders} />
        <Metrica n={pm.totalPersonas} label="Gente" icon={UsersRound} />
        <Metrica n={pm.totalClientes} label="Clientes" icon={Building2} />
        <Metrica n={pm.totalProveedores} label="Prov." icon={Truck} />
      </div>

      {pm.clientes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
          <span className="mr-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-3">Clientes</span>
          {pm.clientes.slice(0, 4).map((c) => (
            <span key={c.id ?? c.nombre} className="max-w-[160px] truncate rounded-[20px] bg-gray-light px-2.5 py-[3px] text-[11.5px] text-text-2">
              {c.nombre}
            </span>
          ))}
          {pm.clientes.length > 4 && <span className="text-[11.5px] text-text-3">+{pm.clientes.length - 4} más</span>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        aria-controls={panelId}
        disabled={sinProyectos}
        className="mt-3 flex cursor-pointer items-center justify-between border-t border-[#EFEDE7] px-4 py-2.5 text-left text-[13px] font-medium text-text-2 transition-colors hover:bg-bg hover:text-text disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
      >
        {abierta ? "Ocultar detalle" : "Ver detalle"}
        <ChevronDown size={15} strokeWidth={1.8} className={clsx("transition-transform", abierta && "rotate-180")} />
      </button>

      {abierta && (
        <div id={panelId} className="border-t border-[#EFEDE7] bg-surface px-4 pb-4 pt-3">
          <TabsShell className="mb-2 self-start">
            {DETALLES.map((d) => (
              <TabButton key={d.id} active={detalle === d.id} onClick={() => setDetalle(d.id)}>
                {d.label}
              </TabButton>
            ))}
          </TabsShell>

          {detalle === "proyectos" && (
            <ul className="flex flex-col">
              {pm.proyectos.map((p) => {
                const color = statusColor(PROJECT_STATUS_COLORS, p.estado);
                const fecha = fmtFecha(p.fechaEvento);
                return (
                  <li key={p.id} className="border-t border-[#EFEDE7] py-2.5 first:border-t-0">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/proyectos?open=${p.id}`}
                          className="group inline-flex max-w-full items-center gap-1 text-[13px] font-medium hover:underline"
                        >
                          <span className="truncate">{p.nombre}</span>
                          <ExternalLink size={11} strokeWidth={1.8} className="flex-shrink-0 text-text-3 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                        <div className="mt-0.5 truncate text-[11.5px] text-text-3">
                          {p.cliente || "Sin cliente"}
                          {p.proveedores.length > 0 && ` · ${p.proveedores.length} ${p.proveedores.length === 1 ? "proveedor" : "proveedores"}`}
                          {p.personas > 0 && ` · ${p.personas} ${p.personas === 1 ? "persona" : "personas"}`}
                        </div>
                      </div>
                      <Badge bg={color.bg} color={color.c} className="flex-shrink-0">{p.estado}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2.5">
                      <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-[#EFEDE7]" aria-label={`Avance ${p.porcentajeAvance}%`}>
                        <div className="h-full rounded-full bg-text" style={{ width: `${p.porcentajeAvance}%` }} />
                      </div>
                      <span className="w-8 flex-shrink-0 text-right font-mono text-[10.5px] text-text-3">{p.porcentajeAvance}%</span>
                      {fecha && (
                        <span className="flex flex-shrink-0 items-center gap-1 font-mono text-[10.5px] text-text-3">
                          <CalendarDays size={11} strokeWidth={1.7} />
                          {fecha}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {detalle === "personas" && (
            <ListaConConteo
              items={pm.personas.map((p) => ({ nombre: p.nombre, sub: p.cargo || undefined, proyectos: p.proyectos }))}
              vacio="Todavía no hay personas asignadas a sus proyectos."
            />
          )}
          {detalle === "clientes" && <ListaConConteo items={pm.clientes} vacio="Sus proyectos todavía no tienen cliente." />}
          {detalle === "proveedores" && <ListaConConteo items={pm.proveedores} vacio="Sus proyectos todavía no tienen proveedores." />}
        </div>
      )}
    </article>
  );
}

export default function ProjectManagersPage() {
  const user = useAuthStore((s) => s.user);
  const pushToast = useUiStore((s) => s.pushToast);
  const puedeVer = user?.rol === "admin" || user?.rol === "super_admin";

  const [panel, setPanel] = useState<PanelPm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [orden, setOrden] = useState<Orden>("carga");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setPanel(await panelApi.projectManagers());
    } catch (err) {
      setError(true);
      pushToast(err instanceof Error ? err.message : "No se pudo cargar el panel", "danger");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    if (!puedeVer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del panel
    cargar();
  }, [puedeVer, cargar]);

  const visibles = useMemo(() => {
    if (!panel) return [];
    const q = normalizarBusqueda(busqueda.trim());
    const filtrados = panel.projectManagers.filter((pm) => !q || normalizarBusqueda(`${pm.nombre} ${pm.email ?? ""}`).includes(q));
    return [...filtrados].sort((a, b) =>
      orden === "nombre" ? a.nombre.localeCompare(b.nombre, "es") : b.totalProyectos - a.totalProyectos || a.nombre.localeCompare(b.nombre, "es"),
    );
  }, [panel, orden, busqueda]);

  const maxCarga = useMemo(() => Math.max(0, ...(panel?.projectManagers.map((p) => p.totalProyectos) ?? []), panel?.sinProjectManager?.totalProyectos ?? 0), [panel]);

  if (!puedeVer) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center text-text-2">
        <UserRound size={28} strokeWidth={1.5} className="text-text-3" />
        <div className="text-[13px]">Este panel está disponible solo para administradores.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-text-3">Equipo</div>
      <h1 className={styles.h1}>Project Managers</h1>
      <p className="mb-5 max-w-[640px] text-[13px] text-text-2">
        Quién lidera cada proyecto, con cuántas personas trabaja y con qué clientes y proveedores. Se calcula en vivo con los proyectos actuales.
      </p>

      {loading && !panel ? (
        <div className="flex justify-center py-14 text-text-2">
          <Spinner label="Cargando panel…" />
        </div>
      ) : error && !panel ? (
        <EmptyState icon={UserRound} tone="danger" title="No se pudo cargar el panel de Project Managers." action={{ label: "Reintentar", onClick: cargar }} />
      ) : panel ? (
        <div className="flex flex-col gap-5">
          <div className={styles.kpis5}>
            <StatCard n={panel.resumen.projectManagersConProyectos} label="Project Managers" icon={UserRound} accent="#0C0C0C" />
            <StatCard n={panel.resumen.totalProyectos} label="Proyectos" icon={Folders} accent="#0C0C0C" />
            <StatCard n={panel.resumen.personasEnProyectos} label="Personas" icon={UsersRound} accent="#1E5AA8" />
            <StatCard n={panel.resumen.clientesActivos} label="Clientes" icon={Building2} accent="#036B3C" />
            <StatCard n={panel.resumen.proveedoresActivos} label="Proveedores" icon={Truck} accent="#7A4E00" />
          </div>

          {panel.resumen.proyectosSinProjectManager > 0 && (
            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[#E8D3A4] bg-amber-light px-4 py-3 text-[13px] text-amber">
              <AlertTriangle size={16} strokeWidth={1.8} className="mt-[1px] flex-shrink-0" />
              <span>
                <strong className="font-semibold">
                  {panel.resumen.proyectosSinProjectManager} {panel.resumen.proyectosSinProjectManager === 1 ? "proyecto no tiene" : "proyectos no tienen"} Project Manager.
                </strong>{" "}
                Asígnalo desde el formulario del proyecto para que cuente en su carga.
              </span>
            </div>
          )}

          {/* Vista general: la carga de todos en una sola mirada, antes de entrar al detalle de cada uno. */}
          {panel.projectManagers.some((p) => p.totalProyectos > 0) && (
            <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(12,12,12,.04)]">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Carga por Project Manager</h2>
                  <p className="mt-0.5 text-[11.5px] text-text-3">Proyectos a cargo de cada uno, de mayor a menor.</p>
                </div>
                <span className="font-mono text-[11px] text-text-3">{panel.resumen.totalProyectos} proyectos</span>
              </div>
              <ol className="flex flex-col gap-2.5">
                {[...panel.projectManagers].filter((p) => p.totalProyectos > 0).sort((a, b) => b.totalProyectos - a.totalProyectos).map((pm) => (
                  <li key={pm.id} className="grid grid-cols-[minmax(90px,170px)_1fr_auto] items-center gap-3 text-[12.5px]">
                    <span className="truncate text-text-2">{pm.nombre}</span>
                    <div className="h-[8px] overflow-hidden rounded-full bg-[#EFEDE7]">
                      <div className="h-full rounded-full bg-text transition-[width] duration-500" style={{ width: `${(pm.totalProyectos / maxCarga) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right font-mono text-[12px] font-semibold tabular-nums">{pm.totalProyectos}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] max-w-[340px] flex-1">
              <Search size={14} strokeWidth={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar Project Manager…"
                aria-label="Buscar Project Manager"
                className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface pl-9 pr-3 text-[13px] text-text outline-none placeholder:text-text-3 focus:border-text"
              />
            </div>
            <TabsShell>
              <TabButton active={orden === "carga"} onClick={() => setOrden("carga")}>Más carga</TabButton>
              <TabButton active={orden === "nombre"} onClick={() => setOrden("nombre")}>A – Z</TabButton>
            </TabsShell>
            <span className="ml-auto font-mono text-[11px] text-text-3">
              {visibles.length} {visibles.length === 1 ? "Project Manager" : "Project Managers"}
            </span>
          </div>

          {visibles.length === 0 && !panel.sinProjectManager ? (
            <EmptyState icon={UserRound} title={busqueda ? "Ningún Project Manager coincide con la búsqueda." : "Todavía no hay Project Managers con proyectos."} />
          ) : (
            <div className="grid grid-cols-1 items-start gap-3.5 min-[1100px]:grid-cols-2">
              {visibles.map((pm) => (
                <TarjetaProjectManager key={pm.id} pm={pm} maxCarga={maxCarga} />
              ))}
              {panel.sinProjectManager && !busqueda && <TarjetaProjectManager pm={panel.sinProjectManager} sinAsignar maxCarga={maxCarga} />}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
