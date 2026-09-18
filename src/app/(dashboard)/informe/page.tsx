"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Bookmark, Building2, Download, FileWarning, Folders, Truck } from "lucide-react";
import { Button, StatCard, TabButton, TabsShell } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/form";
import { BRIEF_STATUS_COLORS, PROJECT_STATUS_COLORS, statusColor } from "@/lib/constants";
import { downloadBlob } from "@/lib/download-file";
import { periodKey, previousPeriodDate, type InformeMode } from "@/lib/informe";
import { ApiError } from "@/lib/api-client";
import { informesApi } from "@/services/api/informes-service";
import { useAuthStore } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";
import type { InformeResumen } from "@/types/api";
import styles from "@/styles/dashboard.module.css";

/** Paleta fija del dona -- ported del mockup aprobado (donutColors): a diferencia de las
 * barras de abajo (que usan el color semántico real de cada estado), el centro rota estos 6
 * tonos en el orden en que aparecen los estados con datos, sin relación con su significado. */
const DONUT_COLORS = ["#0C0C0C", "#00A85A", "#7A4E00", "#8A2525", "#4A4845", "#036B3C"];

interface SavedReport {
  key: string;
  tipo: string;
  periodoKey: string;
  label: string;
  createdAt: string;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InformePage() {
  const user = useAuthStore((s) => s.user);
  const pushToast = useUiStore((s) => s.pushToast);
  const puedeVer = user?.rol === "admin" || user?.rol === "super_admin";

  const [mode, setMode] = useState<InformeMode>("semanal");
  const [current, setCurrent] = useState<InformeResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [reportLabel, setReportLabel] = useState("");
  // Sesión only -- el backend no tiene un "listar snapshots", solo crear uno y pedir uno
  // puntual por tipo+periodo (ver informesApi.snapshot). El mockup aprobado hace lo mismo:
  // "Informes guardados" ahí tampoco sobrevive a un refresh, solo crece durante la sesión.
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  const loadResumen = useCallback(async () => {
    setLoading(true);
    try {
      const resumen = await informesApi.resumen();
      setCurrent(resumen);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo cargar el informe", "danger");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    if (!puedeVer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial resumen load on mount/mode change
    loadResumen();
  }, [puedeVer, loadResumen]);

  // Si ya existe un snapshot guardado del período actual (de una sesión anterior), lo
  // precarga en la galería -- así no siempre arranca vacía cuando sí hay algo real guardado.
  useEffect(() => {
    if (!puedeVer) return;
    let cancelled = false;
    const key = periodKey(mode, previousPeriodDate(mode));
    informesApi
      .snapshot(mode, key)
      .then((snap) => {
        if (cancelled) return;
        setSavedReports((prev) =>
          prev.some((r) => r.tipo === snap.tipo && r.periodoKey === snap.periodoKey)
            ? prev
            : [{ key: `${snap.tipo}-${snap.periodoKey}`, tipo: snap.tipo, periodoKey: snap.periodoKey, label: snap.periodoKey, createdAt: snap.createdAt }, ...prev],
        );
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.statusCode === 404)) {
          // silencioso: esto solo precarga la galería, no bloquea la vista principal
        }
      });
    return () => {
      cancelled = true;
    };
  }, [puedeVer, mode]);

  async function handleSaveSnapshot() {
    setSaving(true);
    try {
      const key = periodKey(mode);
      const snap = await informesApi.crearSnapshot({ tipo: mode, periodoKey: key });
      const label = reportLabel.trim() || (mode === "mensual" ? `Mensual · ${key}` : `Semanal · ${key}`);
      setSavedReports((prev) => [
        { key: `${snap.tipo}-${snap.periodoKey}`, tipo: snap.tipo, periodoKey: snap.periodoKey, label, createdAt: snap.createdAt },
        ...prev.filter((r) => !(r.tipo === snap.tipo && r.periodoKey === snap.periodoKey)),
      ]);
      setReportLabel("");
      pushToast("Informe guardado", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo guardar el informe", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function exportarExcel() {
    setExporting(true);
    try {
      const { blob, fileName } = await informesApi.exportarResumen();
      downloadBlob(blob, fileName);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo exportar el informe", "danger");
    } finally {
      setExporting(false);
    }
  }

  async function exportarReporte(r: SavedReport) {
    setDownloadingKey(r.key);
    try {
      const { blob, fileName } = await informesApi.exportarSnapshot(r.tipo, r.periodoKey);
      downloadBlob(blob, fileName);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo exportar este informe", "danger");
    } finally {
      setDownloadingKey(null);
    }
  }

  if (!puedeVer) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center text-text-2">
        <BarChart3 size={28} strokeWidth={1.5} className="text-text-3" />
        <div className="text-[13px]">Los informes están disponibles solo para administradores.</div>
      </div>
    );
  }

  // Orden fijo (el de PROJECT_STATUS_COLORS/BRIEF_STATUS_COLORS, igual que Object.keys(PROJ_STATUS_COLORS)
  // en el mockup aprobado) en vez del orden que traiga el objeto del backend -- así la lista sale
  // siempre en el mismo orden y muestra también los estados en 0, no solo los que tienen datos.
  // Los estados/briefs reales que el backend traiga y no estén en este mapa fijo (los catálogos
  // son dinámicos, así que puede pasar) se agregan al final -- nunca se pierden datos reales.
  const orderedKeys = (fixedOrder: string[], real: Record<string, number>) => [
    ...fixedOrder,
    ...Object.keys(real).filter((k) => !fixedOrder.includes(k)),
  ];
  const estadoRows = current
    ? orderedKeys(Object.keys(PROJECT_STATUS_COLORS), current.porEstado).map((label) => ({
        label,
        count: current.porEstado[label] ?? 0,
        ...statusColor(PROJECT_STATUS_COLORS, label),
      }))
    : [];
  const briefRows = current
    ? orderedKeys(Object.keys(BRIEF_STATUS_COLORS), current.porBrief).map((label) => ({
        label,
        count: current.porBrief[label] ?? 0,
        ...statusColor(BRIEF_STATUS_COLORS, label),
      }))
    : [];
  const donutTotal = Math.max(1, estadoRows.reduce((a, r) => a + r.count, 0));
  let donutAcc = 0;
  const donutSegs = estadoRows
    .filter((r) => r.count > 0)
    .map((r, i) => {
      const start = (donutAcc / donutTotal) * 360;
      donutAcc += r.count;
      const end = (donutAcc / donutTotal) * 360;
      return { color: DONUT_COLORS[i % DONUT_COLORS.length], start, end, label: r.label, count: r.count };
    });
  const donutGradient = donutSegs.length
    ? `conic-gradient(${donutSegs.map((g) => `${g.color} ${g.start}deg ${g.end}deg`).join(",")})`
    : "#EFEDE7";
  const estadoMax = Math.max(1, ...estadoRows.map((r) => r.count), 1);
  const briefMax = Math.max(1, ...briefRows.map((r) => r.count), 1);

  return (
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-text-3">Analítica</div>
      <h1 className={styles.h1}>Informes</h1>
      <p className="mb-5 text-[13px] text-text-2">El resumen en vivo, listo para guardar y exportar a Excel.</p>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface px-4.5 py-4">
        <TabsShell>
          <TabButton active={mode === "semanal"} onClick={() => setMode("semanal")}>
            Semanal
          </TabButton>
          <TabButton active={mode === "mensual"} onClick={() => setMode("mensual")}>
            Mensual
          </TabButton>
        </TabsShell>
        <span className="text-[13px] text-text-2">
          {mode === "mensual" ? "Resumen del mes en curso" : "Resumen de la semana en curso"}
        </span>
        {/* El ancho va en este div envolvente, no como className del Input: Input ya trae
            "w-full" en su clase base, y una segunda clase de width por fuera compite con esa
            en la misma propiedad -- quién gana depende del orden en la hoja generada por
            Tailwind, no del orden en el string (mismo defecto ya visto en TabButton/DropdownItem),
            así que antes el input se estiraba a todo el ancho y tiraba los botones a otra fila. */}
        <div className="ml-auto w-[220px]">
          <Input
            value={reportLabel}
            onChange={(e) => setReportLabel(e.target.value)}
            placeholder={mode === "mensual" ? "Ej. Agosto 2026" : "Ej. Semana 34 - 2026"}
          />
        </div>
        <Button variant="primary" icon={Bookmark} onClick={handleSaveSnapshot} disabled={saving}>
          {saving ? "Guardando…" : "Guardar informe"}
        </Button>
        <Button icon={exporting ? undefined : Download} onClick={exportarExcel} disabled={exporting}>
          {exporting ? <Spinner label="Exportando…" /> : "Exportar a Excel"}
        </Button>
      </div>

      {loading || !current ? (
        <div className="flex justify-center py-14 text-text-2">
          <Spinner label="Cargando informe…" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className={styles.kpis}>
            <StatCard n={current.totalProveedores} label="Proveedores" icon={Truck} />
            <StatCard n={current.totalClientes} label="Clientes" icon={Building2} />
            <StatCard n={current.totalProyectos} label="Proyectos" icon={Folders} />
            <StatCard
              n={current.proyectosSinProveedor}
              label="Sin proveedor"
              icon={FileWarning}
              accent={current.proyectosSinProveedor > 0 ? "#8A2525" : undefined}
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 min-[1001px]:grid-cols-[1.1fr_1fr_1fr]">
            <div className="flex flex-col items-center gap-3.5 rounded-[var(--radius-lg)] border border-border bg-surface p-4.5 transition-shadow hover:shadow-[0_1px_6px_rgba(12,12,12,.05)]">
              <div className="self-start text-sm font-semibold">Distribución de proyectos por estado</div>
              <div className="relative flex h-[160px] w-[160px] items-center justify-center rounded-full" style={{ background: donutGradient }}>
                <div className="flex h-[108px] w-[108px] flex-col items-center justify-center rounded-full bg-surface shadow-[inset_0_0_0_1px_rgba(12,12,12,.05)]">
                  <span className="text-[24px] font-semibold leading-none tracking-[-0.02em]">{donutTotal}</span>
                  <span className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.06em] text-text-3">proyectos</span>
                </div>
              </div>
              <div className="flex w-full flex-col gap-1">
                {donutSegs.map((g) => (
                  <div key={g.label} className="flex items-center gap-2 rounded-[var(--radius-md)] px-1.5 py-1 text-xs transition-colors hover:bg-bg">
                    <span className="h-[9px] w-[9px] flex-shrink-0 rounded-full" style={{ background: g.color }} />
                    <span className="min-w-0 flex-1 truncate text-text-2">{g.label}</span>
                    <span className="flex-shrink-0 rounded-[20px] bg-gray-light px-1.5 py-[1px] font-mono text-[11px] font-semibold text-text">{g.count}</span>
                  </div>
                ))}
                {donutSegs.length === 0 && <span className="text-xs text-text-3">Sin proyectos todavía.</span>}
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4.5 transition-shadow hover:shadow-[0_1px_6px_rgba(12,12,12,.05)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold">Por estado del proyecto</div>
                <span className="font-mono text-[11px] text-text-3">{current.totalProyectos} total</span>
              </div>
              {estadoRows.length === 0 && <p className="text-sm text-text-3">Sin datos todavía.</p>}
              {estadoRows.map((r) => (
                <div key={r.label} className="mb-3 last:mb-0">
                  <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                    <span className="text-text-2">{r.label}</span>
                    <span className="font-semibold">{r.count}</span>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-[20px] bg-[#EFEDE7]">
                    <div
                      className="h-full rounded-[20px] transition-[width] duration-300"
                      style={{ width: `${Math.round((r.count / estadoMax) * 100)}%`, background: r.c }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4.5 transition-shadow hover:shadow-[0_1px_6px_rgba(12,12,12,.05)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold">Por estado del brief</div>
                <span className="font-mono text-[11px] text-text-3">{briefRows.reduce((a, r) => a + r.count, 0)} total</span>
              </div>
              {briefRows.length === 0 && <p className="text-sm text-text-3">Sin datos todavía.</p>}
              {briefRows.map((r) => (
                <div key={r.label} className="mb-3 last:mb-0">
                  <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                    <span className="text-text-2">{r.label}</span>
                    <span className="font-semibold">{r.count}</span>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-[20px] bg-[#EFEDE7]">
                    <div
                      className="h-full rounded-[20px] transition-[width] duration-300"
                      style={{ width: `${Math.round((r.count / briefMax) * 100)}%`, background: r.c }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {savedReports.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">Informes guardados</div>
                <span className="font-mono text-[11px] text-text-3">{savedReports.length} {savedReports.length === 1 ? "informe" : "informes"}</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {savedReports.map((r) => (
                  <div
                    key={r.key}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3.5 transition-shadow hover:shadow-[0_1px_6px_rgba(12,12,12,.05)]"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-gray-light text-text-2">
                      <BarChart3 size={17} strokeWidth={1.7} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{r.label}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-text-3">
                        <span className="rounded-[20px] bg-gray-light px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-wide">{r.tipo}</span>
                        {fmtFecha(r.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Descargar"
                      disabled={downloadingKey === r.key}
                      onClick={() => exportarReporte(r)}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-transparent text-text-2 transition-colors hover:border-text hover:bg-text hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {downloadingKey === r.key ? <Spinner /> : <Download size={14} strokeWidth={1.8} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
