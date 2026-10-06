"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Building2, ChevronDown, ExternalLink, Folders, Truck, UserRound } from "lucide-react";
import { Avatar, Badge, EmptyState, StatCard, TabButton, TabsShell } from "@/components/ui/primitives";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { PROJECT_STATUS_COLORS, statusColor } from "@/lib/constants";
import { panelApi } from "@/services/api/panel-service";
import { useAuthStore } from "@/store/auth-store";
import { useProvidersStore } from "@/store/providers-store";
import { useUiStore } from "@/store/ui-store";
import type { PanelPm, PanelPmProjectManager } from "@/types/api";
import styles from "@/styles/dashboard.module.css";

type Detalle = "proyectos" | "clientes" | "proveedores" | "personas";

/** Cuántos proyectos se listan al abrir un Project Manager (el resto se ve en Proyectos). */
const MAX_PROYECTOS = 40;

const GRID = "grid grid-cols-[minmax(0,1fr)_72px_72px_72px_28px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_110px_110px_110px_28px]";

function Cifra({ n }: { n: number }) {
  return <span className={clsx("text-center text-[15px] font-semibold tabular-nums", n === 0 && "font-normal text-text-3")}>{n}</span>;
}

function Lista({ items, vacio }: { items: { nombre: string; proyectos: number }[]; vacio: string }) {
  if (items.length === 0) return <p className="py-2 text-[13px] text-text-3">{vacio}</p>;
  return (
    <ul className="grid max-h-[300px] grid-cols-1 gap-x-8 overflow-y-auto sm:grid-cols-2 min-[1200px]:grid-cols-3">
      {items.map((it) => (
        <li key={it.nombre} className="flex items-center justify-between gap-3 border-b border-divider py-2 text-[13px]">
          <span className="truncate">{it.nombre}</span>
          <span className="flex-shrink-0 font-mono text-[11px] text-text-3">{it.proyectos}</span>
        </li>
      ))}
    </ul>
  );
}

function FilaProjectManager({ pm, sinAsignar = false }: { pm: PanelPmProjectManager; sinAsignar?: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const [detalle, setDetalle] = useState<Detalle>("proyectos");
  const vacia = pm.totalProyectos === 0;
  const tabs: { id: Detalle; label: string }[] = [
    { id: "proyectos", label: "Proyectos" },
    { id: "clientes", label: "Clientes" },
    { id: "proveedores", label: "Proveedores" },
    ...(pm.totalPersonas > 0 ? [{ id: "personas" as Detalle, label: "Personas" }] : []),
  ];

  return (
    <div className="border-b border-divider last:border-b-0">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        disabled={vacia}
        aria-expanded={abierta}
        className={clsx(GRID, "w-full cursor-pointer px-5 py-3.5 text-left transition-colors hover:bg-bg disabled:cursor-default disabled:hover:bg-transparent")}
      >
        <span className="flex min-w-0 items-center gap-3">
          {sinAsignar ? (
            <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[3px] bg-amber-light text-amber">
              <AlertTriangle size={16} strokeWidth={1.8} />
            </span>
          ) : (
            <Avatar nombre={pm.nombre} />
          )}
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold">{sinAsignar ? "Sin Project Manager" : pm.nombre}</span>
            <span className="block truncate text-[12px] text-text-3">
              {sinAsignar ? "Proyectos que todavía no tienen responsable" : !pm.activo ? "Cuenta desactivada" : pm.email}
            </span>
          </span>
        </span>
        <Cifra n={pm.totalProyectos} />
        <Cifra n={pm.totalClientes} />
        <Cifra n={pm.totalProveedores} />
        <ChevronDown size={16} strokeWidth={1.8} className={clsx("text-text-3 transition-transform", abierta && "rotate-180", vacia && "opacity-0")} />
      </button>

      {abierta && (
        <div className="bg-bg/60 px-5 pb-5 pt-3">
          <TabsShell className="mb-3 self-start">
            {tabs.map((t) => (
              <TabButton key={t.id} active={detalle === t.id} onClick={() => setDetalle(t.id)}>
                {t.label}
              </TabButton>
            ))}
          </TabsShell>

          {detalle === "proyectos" && (
            <>
              <ul className="grid grid-cols-1 gap-x-8 min-[1100px]:grid-cols-2">
                {pm.proyectos.slice(0, MAX_PROYECTOS).map((p) => {
                  const color = statusColor(PROJECT_STATUS_COLORS, p.estado);
                  return (
                    <li key={p.id} className="flex items-center gap-3 border-b border-divider py-2 text-[13px]">
                      <Link href={`/proyectos?open=${p.id}`} className="group flex min-w-0 flex-1 items-center gap-1.5 hover:underline">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.nombre}</span>
                          <span className="block truncate text-[11.5px] text-text-3">{p.cliente || "Sin cliente"}</span>
                        </span>
                        <ExternalLink size={11} strokeWidth={1.8} className="flex-shrink-0 text-text-3 opacity-0 group-hover:opacity-100" />
                      </Link>
                      <Badge bg={color.bg} color={color.c} className="flex-shrink-0">{p.estado}</Badge>
                    </li>
                  );
                })}
              </ul>
              {pm.proyectos.length > MAX_PROYECTOS && (
                <p className="pt-3 text-[12px] text-text-3">
                  Mostrando {MAX_PROYECTOS} de {pm.proyectos.length}. El resto está en <Link href="/proyectos" className="underline">Proyectos</Link>.
                </p>
              )}
            </>
          )}
          {detalle === "clientes" && <Lista items={pm.clientes} vacio="Sin clientes." />}
          {detalle === "proveedores" && <Lista items={pm.proveedores} vacio="Sin proveedores en sus proyectos." />}
          {detalle === "personas" && <Lista items={pm.personas} vacio="Sin personas." />}
        </div>
      )}
    </div>
  );
}

export default function ProjectManagersPage() {
  const user = useAuthStore((s) => s.user);
  const pushToast = useUiStore((s) => s.pushToast);
  const proveedores = useProvidersStore((s) => s.items);
  const fetchProveedores = useProvidersStore((s) => s.fetchAll);
  // Lo ve cualquier usuario (2026-10-05): admin/super_admin ven a todos los Project Managers; el resto,
  // solo los proyectos que tiene a su cargo (el backend ya filtra).
  const esAdmin = user?.rol === "admin" || user?.rol === "super_admin";
  const puedeVer = Boolean(user);

  const [panel, setPanel] = useState<PanelPm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
    fetchProveedores();
  }, [puedeVer, cargar, fetchProveedores]);

  if (!puedeVer) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center text-text-2">
        <UserRound size={28} strokeWidth={1.5} className="text-text-3" />
        <div className="text-[13px]">Inicia sesión para ver este panel.</div>
      </div>
    );
  }

  const pms = panel ? [...panel.projectManagers].sort((a, b) => b.totalProyectos - a.totalProyectos || a.nombre.localeCompare(b.nombre, "es")) : [];

  return (
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-text-3">Equipo</div>
      <h1 className={styles.h1}>{esAdmin ? "Project Managers" : "Mis proyectos"}</h1>

      {loading && !panel ? (
        <SkeletonCards columns={3} />
      ) : error && !panel ? (
        <EmptyState icon={UserRound} tone="danger" title="No se pudo cargar el panel de Project Managers." action={{ label: "Reintentar", onClick: cargar }} />
      ) : panel ? (
        <div className="mt-5 flex flex-col gap-5">
          <div className={styles.kpis}>
            {esAdmin ? (
              <StatCard n={panel.resumen.projectManagersConProyectos} label="Project Managers" icon={UserRound} accent="#0C0C0C" />
            ) : (
              <StatCard n={panel.resumen.totalProyectos} label="Mis proyectos" icon={Folders} accent="#0C0C0C" />
            )}
            {esAdmin && <StatCard n={panel.resumen.totalProyectos} label="Proyectos" icon={Folders} accent="#0C0C0C" />}
            <StatCard n={panel.resumen.clientesActivos} label="Clientes" icon={Building2} accent="#036B3C" />
            <StatCard n={esAdmin ? proveedores.length : panel.resumen.proveedoresActivos} label="Proveedores" icon={Truck} accent="#7A4E00" />
          </div>

          <section className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[0_1px_3px_rgba(12,12,12,.04)]">
            <div className={clsx(GRID, "border-b border-border bg-bg/60 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-3")}>
              <span>Project Manager</span>
              <span className="text-center">Proyectos</span>
              <span className="text-center">Clientes</span>
              <span className="text-center">Proveed.</span>
              <span />
            </div>
            {pms.map((pm) => (
              <Fragment key={pm.id}>
                <FilaProjectManager pm={pm} />
              </Fragment>
            ))}
            {panel.sinProjectManager && <FilaProjectManager pm={panel.sinProjectManager} sinAsignar />}
            {pms.length === 0 && !panel.sinProjectManager && <div className="px-5 py-8 text-center text-[13px] text-text-3">Todavía no hay proyectos.</div>}
          </section>
        </div>
      ) : null}
    </div>
  );
}
