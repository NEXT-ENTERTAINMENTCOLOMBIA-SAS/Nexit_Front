"use client";

import { useEffect, useState } from "react";
import { ExternalLink, MessageCircle, Pencil, Plus } from "lucide-react";
import { Avatar, Badge, Dropdown, Stars } from "@/components/ui/primitives";
import {
  DetailBox,
  DetailRow,
  Drawer,
  DrawerCloseButton,
  DrawerExpandButton,
  DrawerFooter,
  DrawerHeader,
  DrawerIconButton,
} from "@/components/ui/Drawer";
import { EntityAttachments } from "@/components/ui/EntityAttachments";
import { HistorialTimeline } from "@/components/ui/HistorialTimeline";
import { Textarea } from "@/components/ui/form";
import { AREA_SEGUIMIENTO_COLORS, BRIEF_STATUS_COLORS, PROJECT_STATUS_COLORS, PROVIDER_STATUS_COLORS, statusColor } from "@/lib/constants";
import { fmtDateLong } from "@/lib/format";
import { historialApi } from "@/services/api/historial-service";
import { proyectoAdjuntosApi } from "@/services/api/proyecto-adjuntos-service";
import { proyectosApi } from "@/services/api/proyectos-service";
import { usuariosApi } from "@/services/api/usuarios-service";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useClientesStore } from "@/store/clientes-store";
import { useUiStore } from "@/store/ui-store";
import type { HistorialCambio, Proveedor, Proyecto, SeguimientoProyecto } from "@/types/api";

// Debe calzar EXACTO con `Areas` en Nexit_Back/.../Validators/Proyectos/ProyectoValidators.cs
// (CrearSeguimientoProyectoValidator) -- si no coincide, agregar la entrada a la bitácora
// falla en el backend con "El área de seguimiento no es válida.".
const AREAS_SEGUIMIENTO = ["General", "Creativo", "Comercial", "Administrativo"];

/**
 * Sin botón de eliminar: aquí solo se mira y se puede editar. Eliminar (o
 * pedirlo) vive dentro del formulario de edición -- ver ProjectFormModal.
 */
export function ProjectDetail({
  project,
  providers,
  onClose,
  onEdit,
}: {
  project: Proyecto | null;
  providers: Proveedor[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const { estadosProyecto, categoriasProveedor, fetchBase } = useCatalogosStore();
  const { items: clientes, fetchAll: fetchClientes } = useClientesStore();
  const [historial, setHistorial] = useState<HistorialCambio[]>([]);
  const [historialCargando, setHistorialCargando] = useState(false);
  // Alicia 2026-09-08: "que lo pueda agrandar un poquito" -- el panel de
  // detalle empieza angosto (520px) y se puede agrandar con un clic.
  const [wide, setWide] = useState(false);
  // Alicia 2026-09-08: "que aparezca toda la información... hay mucha
  // información cuando lo editamos, pero nunca la vemos directamente" --
  // el gerente responsable se podía asignar en el formulario pero nunca
  // se mostraba acá. `getById` (a diferencia de `list`) lo puede pedir
  // cualquier usuario autenticado, no solo admin/super_admin -- ver
  // usuarios-service.ts.
  const [gerenteNombre, setGerenteNombre] = useState<string | null>(null);

  useEffect(() => {
    fetchBase();
    fetchClientes();
  }, [fetchBase, fetchClientes]);

  useEffect(() => {
    if (!project?.gerenteId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el gerente del proyecto anterior al cerrar el drawer o si no tiene uno asignado
      setGerenteNombre(null);
      return;
    }
    let cancelado = false;
    usuariosApi
      .getById(project.gerenteId)
      .then((u) => {
        if (!cancelado) setGerenteNombre(`${u.nombre} ${u.apellido}`.trim());
      })
      .catch(() => {
        if (!cancelado) setGerenteNombre(null);
      });
    return () => {
      cancelado = true;
    };
  }, [project?.gerenteId]);

  // Historial de cambios (docs/19/20) -- mismo patrón que ClienteDetail, la pantalla
  // que lo estrenó; a Proveedores y Proyectos nunca les había llegado esta sección
  // aunque el backend ya registra los cambios de las 3 entidades por igual.
  useEffect(() => {
    if (!project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el historial del proyecto anterior al cerrar el drawer
      setHistorial([]);
      return;
    }
    let cancelado = false;
    setHistorialCargando(true);
    historialApi
      .porEntidad("proyecto", project.id)
      .then((rows) => {
        if (!cancelado) setHistorial(rows);
      })
      .catch(() => {
        if (!cancelado) setHistorial([]);
      })
      .finally(() => {
        if (!cancelado) setHistorialCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [project]);

  if (!project) return <Drawer open={false} onClose={onClose} size="detail"><></></Drawer>;

  const estadoNombre = estadosProyecto.find((e) => e.id === project.estadoId)?.nombre ?? "—";
  const cliente = clientes.find((c) => c.id === project.clienteId) ?? null;
  const st = statusColor(PROJECT_STATUS_COLORS, estadoNombre);
  const bst = statusColor(BRIEF_STATUS_COLORS, project.estadoBrief);
  const assigned = project.proveedorIds.map((id) => providers.find((p) => p.id === id)).filter((p): p is Proveedor => Boolean(p));
  const primerTelefono = cliente?.telefonos[0]?.telefono;
  const whatsappHref = primerTelefono ? `https://wa.me/${primerTelefono.replace(/[^\d]/g, "")}` : null;
  const primerEmail = cliente?.emails[0]?.email;
  const correoHref = primerEmail ? `mailto:${primerEmail}` : null;
  const fechaEventoLabel = fmtDateLong(project.fechaEvento?.slice(0, 10)) || "Sin fecha";
  const fechaSolicitudLabel = fmtDateLong(project.fechaSolicitud?.slice(0, 10)) || "Sin fecha";
  const facturaLabel = project.pagado
    ? `${project.numeroFactura || "Sin número"} · Pagada`
    : project.numeroFactura
      ? `${project.numeroFactura} · Sin pagar`
      : "Sin facturar";

  return (
    <Drawer open={Boolean(project)} onClose={onClose} size="detail" wide={wide}>
      <DrawerHeader>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold leading-tight tracking-[-0.025em]">{project.nombre || "(Sin nombre)"}</div>
          <div className="mt-[3px] text-[13px] text-text-3">{cliente?.nombre || "Sin cliente"}</div>
        </div>
        <div className="flex flex-shrink-0 gap-1.5">
          <DrawerExpandButton wide={wide} onToggle={() => setWide((w) => !w)} />
          <DrawerIconButton label="Editar proyecto" onClick={onEdit}>
            <Pencil size={15} strokeWidth={1.8} />
          </DrawerIconButton>
          <DrawerCloseButton onClose={onClose} />
        </div>
      </DrawerHeader>

      <div className="flex flex-1 flex-col gap-[18px] p-[22px]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge bg={st.bg} color={st.c}>
            {estadoNombre}
          </Badge>
          <Badge bg={bst.bg} color={bst.c}>
            Brief: {project.estadoBrief}
          </Badge>
          <Badge bg="#F1EFE8" color="#0C0C0C">
            {fechaEventoLabel}
          </Badge>
          {(project.tipoProyecto || project.prioridad) && (
            <Badge bg="#F1EFE8" color="#0C0C0C">
              {[project.tipoProyecto, project.prioridad].filter(Boolean).join(" · ")}
            </Badge>
          )}
        </div>

        {/* Alicia 2026-09-18: "quita la línea de avance, no nos interesa" -- fuera la barra de
            porcentaje; el resto de estos datos se reparte en dos cajas más claras en vez de una
            sola "Avance" que ya no tenía mucho que ver con lo que quedaba adentro. */}
        <DetailBox title="Fechas y ubicación">
          <DetailRow k="Solicitud" v={fechaSolicitudLabel} />
          <DetailRow k="Evento" v={fechaEventoLabel} />
          <DetailRow k="Ciudad" v={project.ciudad || "—"} />
          <DetailRow k="Sede Next" v={project.sedeNext || "—"} />
        </DetailBox>

        <DetailBox title="Propuesta y facturación">
          <DetailRow k="Propuesta" v={project.propuestaEstado || "—"} />
          <DetailRow k="Factura" v={facturaLabel} />
          {project.fechaPago && <DetailRow k="Fecha de pago" v={fmtDateLong(project.fechaPago.slice(0, 10))} />}
        </DetailBox>

        <DetailBox title="Equipo">
          <DetailRow k="Líder de equipo" v={gerenteNombre || "—"} />
          <DetailRow k="Persona de contacto" v={project.contactoProyecto || "—"} />
          {project.equipo.length === 0 ? (
            <DetailRow k="Miembros" v="—" />
          ) : (
            project.equipo.map((m, i) => <DetailRow key={m.id ?? i} k={m.rol || "Miembro"} v={m.nombre} />)
          )}
        </DetailBox>

        <DetailBox title="Proveedores asignados">
          {assigned.length === 0 ? (
            <p className="text-sm text-text-3">Sin proveedores asignados todavía.</p>
          ) : (
            <div className="flex flex-col">
              {assigned.map((p) => {
                const sc = statusColor(PROVIDER_STATUS_COLORS, p.estado);
                const catNombre = categoriasProveedor.find((c) => c.id === p.categoriaId)?.nombre;
                return (
                  <div key={p.id} className="flex items-center gap-2.5 border-b border-[#EFEDE7] py-2.5 last:border-b-0">
                    <Avatar nombre={p.nombre} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{p.nombre}</div>
                      <div className="truncate text-[11px] text-text-3">{catNombre}</div>
                    </div>
                    {typeof p.score === "number" && <Stars n={p.score} />}
                    <Badge bg={sc.bg} color={sc.c} className="ml-1">
                      {p.estado}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </DetailBox>

        {project.notas && (
          <DetailBox title="Notas internas">
            <p className="border-l-2 border-green pl-3 text-sm leading-relaxed text-text-2">{project.notas}</p>
          </DetailBox>
        )}

        <DetailBox title="Archivos y enlaces" tone="plain">
          <EntityAttachments entityId={project.id} api={proyectoAdjuntosApi} />
        </DetailBox>

        <DetailBox title="Bitácora de seguimiento" tone="plain">
          <Bitacora proyectoId={project.id} />
        </DetailBox>

        <DetailBox title="Historial de cambios" tone="plain">
          <HistorialTimeline cargando={historialCargando} historial={historial} />
        </DetailBox>
      </div>

      <DrawerFooter>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-[130px] flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-teal-mid px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green hover:text-text"
          >
            <MessageCircle size={15} strokeWidth={1.8} />
            Escribir al cliente
          </a>
        )}
        {correoHref && (
          <a
            href={correoHref}
            className="inline-flex min-w-[130px] flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-transparent px-3.5 py-2.5 text-sm font-medium text-text transition-colors hover:border-text hover:bg-bg"
          >
            <ExternalLink size={15} strokeWidth={1.8} />
            Correo
          </a>
        )}
      </DrawerFooter>
    </Drawer>
  );
}

function Bitacora({ proyectoId }: { proyectoId: string }) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [entradas, setEntradas] = useState<SeguimientoProyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState(AREAS_SEGUIMIENTO[0]);
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial bitacora load on mount/proyectoId change
    setLoading(true);
    proyectosApi
      .listarSeguimiento(proyectoId)
      .then((items) => {
        if (!cancelled) setEntradas(items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [proyectoId]);

  async function agregar() {
    if (!nota.trim()) return;
    setSaving(true);
    try {
      const creada = await proyectosApi.agregarSeguimiento(proyectoId, { area, nota: nota.trim() });
      setEntradas((prev) => [creada, ...prev]);
      setNota("");
      pushToast("Entrada agregada a la bitácora", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo agregar la entrada", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-bg p-3">
        <Dropdown value={area} onChange={(v) => setArea(v || AREAS_SEGUIMIENTO[0])} placeholder="Área" options={AREAS_SEGUIMIENTO.map((a) => ({ value: a, label: a }))} />
        <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nueva nota para la bitácora…" className="!bg-surface" />
        <button
          type="button"
          disabled={saving || !nota.trim()}
          onClick={agregar}
          className="flex h-9 w-fit cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] bg-teal-mid px-3 text-[13px] font-medium text-white transition-colors hover:bg-green hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={14} strokeWidth={2} />
          {saving ? "Guardando…" : "Agregar entrada"}
        </button>
      </div>

      {loading ? (
        <div className="py-1 text-sm text-text-3">Cargando bitácora…</div>
      ) : entradas.length === 0 ? (
        <div className="py-1 text-sm text-text-3">Todavía no hay notas de seguimiento.</div>
      ) : (
        // Alicia 2026-09-18: "hazla más útil... y más bonita" -- cada entrada en su propia
        // tarjetita con el área como badge de color (en vez de texto plano), así se distingue de
        // un vistazo sin tener que leer cada una; la más reciente primero (ya viene así del
        // backend, ver ConsultarSeguimientoProyectoUseCase).
        <div className="flex flex-col gap-2">
          {entradas.map((e) => {
            const ac = statusColor(AREA_SEGUIMIENTO_COLORS, e.area);
            return (
              <div key={e.id} className="rounded-[var(--radius-md)] border border-[#EFEDE7] bg-bg px-3 py-2.5 text-[13px]">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge bg={ac.bg} color={ac.c}>
                    {e.area}
                  </Badge>
                  <span className="ml-auto font-mono text-[10.5px] text-text-3">{fmtDateLong(e.fecha?.slice(0, 10))}</span>
                </div>
                <div className="leading-relaxed text-text-2">{e.nota}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
