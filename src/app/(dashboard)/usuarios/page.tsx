"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, UserPlus, Users } from "lucide-react";
import {
  ActiveFilters,
  Badge,
  Dropdown,
  EmptyState,
  StatCard,
  Tag,
  type FilterChip,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RowAction, Table, Td, Th, Thead, Tr } from "@/components/ui/Table";
import {
  CUENTA_ACTIVA_COLOR,
  CUENTA_INACTIVA_COLOR,
  ROLES,
  ROL_COLORS,
  } from "@/lib/constants";
import { inicialesPersona } from "@/lib/format";
import { invitacionesApi } from "@/services/api/invitaciones-service";
import { presenciaApi } from "@/services/api/presencia-service";
import { solicitudesEliminacionApi } from "@/services/api/solicitudes-eliminacion-service";
import { usuariosApi } from "@/services/api/usuarios-service";
import { useAuthStore } from "@/store/auth-store";
import { useClientesStore } from "@/store/clientes-store";
import { usePageToolbarStore, type SearchSuggestion } from "@/store/page-toolbar-store";
import { useProjectsStore } from "@/store/projects-store";
import { useProvidersStore } from "@/store/providers-store";
import { useUiStore } from "@/store/ui-store";
import type {
  Invitacion,
  PresenciaUsuario,
  Rol,
  SolicitudEliminacion,
  Usuario,
  UsuarioUpdateInput,
} from "@/types/api";
import { InvitarUsuarioModal } from "./InvitarUsuarioModal";
import { RegistrarUsuarioModal } from "./RegistrarUsuarioModal";
import { UsuarioDetail } from "./UsuarioDetail";
import { UsuarioFormModal } from "./UsuarioFormModal";
import { InvitacionesSection } from "./InvitacionesSection";
import { SolicitudesSection } from "./SolicitudesSection";
import styles from "@/styles/dashboard.module.css";
import { useRolLabels } from "@/store/config-store";

// Las mismas dos palabras que la columna "Estado de la cuenta" de la tabla -- si el filtro las
// dijera de otra forma ("con acceso" / "sin acceso"), habría que traducir mentalmente entre lo que
// se filtra y lo que se ve.
const ESTADOS_CUENTA = [
  { value: "activa", label: "Activa" },
  { value: "desactivada", label: "Desactivada" },
];

const CONEXION = [
  { value: "en-linea", label: "En línea ahora" },
  { value: "desconectados", label: "Fuera de línea" },
];

/** Confirmaciones abiertas -- una sola a la vez, para no montar cuatro diálogos distintos. */
type Confirmacion =
  | { tipo: "solicitarEliminacionUsuario"; usuario: Usuario }
  | { tipo: "cancelarInvitacion"; invitacion: Invitacion }
  | { tipo: "aprobarSolicitud"; solicitud: SolicitudEliminacion; nombre: string }
  | { tipo: "rechazarSolicitud"; solicitud: SolicitudEliminacion; nombre: string };

export default function UsuariosPage() {
  const rolLabels = useRolLabels();
  const authUser = useAuthStore((s) => s.user);
  const pushToast = useUiStore((s) => s.pushToast);
  const setToolbar = usePageToolbarStore((s) => s.setToolbar);
  const clearToolbar = usePageToolbarStore((s) => s.clearToolbar);
  const { items: clientes, fetchAll: fetchClientes } = useClientesStore();
  const { items: providers, fetchAll: fetchProviders } = useProvidersStore();
  const { items: projects, fetchAll: fetchProjects } = useProjectsStore();

  const esAdmin = authUser?.rol === "admin" || authUser?.rol === "super_admin";

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [presencia, setPresencia] = useState<PresenciaUsuario[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudEliminacion[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filtRol, setFiltRol] = useState("");
  const [filtEstado, setFiltEstado] = useState("");
  const [filtConexion, setFiltConexion] = useState("");
  const [verInvitacionesRespondidas, setVerInvitacionesRespondidas] = useState(false);

  // Dos modales distintos a propósito, no dos pestañas de uno solo: invitar es pedirle a alguien
  // que se sume, registrar es darlo por hecho. Piden datos distintos y tienen consecuencias
  // distintas (docs/38).
  const [invitarOpen, setInvitarOpen] = useState(false);
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detalle, setDetalle] = useState<Usuario | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const load = useCallback(async () => {
    if (!esAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [usuariosRes, presenciaRes] = await Promise.all([usuariosApi.list(), presenciaApi.directorio()]);
      setUsuarios(usuariosRes);
      setPresencia(presenciaRes);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo cargar el equipo", "danger");
    }
    try {
      setSolicitudes(await solicitudesEliminacionApi.list());
    } catch {
      setSolicitudes([]);
    }
    if (esAdmin) {
      try {
        setInvitaciones(await invitacionesApi.list());
      } catch {
        setInvitaciones([]);
      }
    }
    setLoading(false);
  }, [esAdmin, pushToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial (equipo/presencia/solicitudes/invitaciones)
    load();
    fetchClientes();
    fetchProviders();
    fetchProjects();
  }, [load, fetchClientes, fetchProviders, fetchProjects]);

  /**
   * Quien responde una invitación (o pide eliminar su cuenta) lo hace en su propia sesión, no en
   * la de quien administra -- por eso esta pantalla no se entera sola. Mismo patrón que el
   * heartbeat de presencia (layout.tsx): al volver a esta pestaña se refresca, así una invitación
   * ya respondida no se queda viéndose como pendiente más de lo necesario.
   */
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  // Buscador compartido de la barra superior -- mismo patrón que Clientes/Proveedores/Proyectos.
  useEffect(() => {
    function onGlobalSearch(event: Event) {
      setSearch((event as CustomEvent<string>).detail);
    }
    window.addEventListener("nexit:search", onGlobalSearch);
    return () => window.removeEventListener("nexit:search", onGlobalSearch);
  }, []);

  /**
   * Barra superior de esta pantalla: buscador, Excel y "Nuevo usuario" -- el mismo sitio donde
   * las otras secciones tienen su "Nuevo cliente" / "Nuevo proyecto". Importar acá NO crea
   * usuarios: invita a los correos del archivo (Nexit_Back/docs/36), por eso los textos propios.
   */
  useEffect(() => {
    setToolbar({
      entidad: "usuarios",
      searchPlaceholder: "Buscar por nombre, correo o rol…",
      puedeImportar: esAdmin,
      onExport: usuariosApi.exportar,
      onImport: invitacionesApi.importar,
      onImported: load,
      textos: {
        menuImportar: "Importar usuarios",
        menuExportar: "Exportar usuarios",
        sinActualizados: true,
        etiquetaCreados: (n) => (n === 1 ? "invitación enviada" : "invitaciones enviadas"),
        toastExito: (r) => (r.creados === 1 ? "1 invitación enviada" : `${r.creados} invitaciones enviadas`),
      },
      // Mismo lugar que "Nuevo proyecto" o "Nuevo cliente" en las otras pantallas. Admin/super_admin
      // pueden dar de alta a alguien (docs/06, ampliado 2026-09-09: ya no exclusivo de super_admin).
      ...(esAdmin ? { addLabel: "Nuevo usuario", addIcon: UserPlus, onAdd: () => setRegistrarOpen(true) } : {}),
      // Buscador inteligente (2026-09-18, Alicia: "todos los buscadores... tienen que ser súper
      // inteligentes") -- mismo patrón de sugerencias con ranking que Clientes/Proveedores/Proyectos.
      getSuggestions: (query) => {
        const q = query.toLowerCase();
        return usuarios
          .map((u) => {
            const nombreCompleto = `${u.nombre} ${u.apellido}`.trim().toLowerCase();
            const rolLabel = (rolLabels[u.rol] ?? u.rol).toLowerCase();
            const rank = nombreCompleto.startsWith(q)
              ? 0
              : nombreCompleto.includes(q)
                ? 1
                : [u.email, rolLabel].some((v) => v?.toLowerCase().includes(q))
                  ? 2
                  : -1;
            return { u, rank };
          })
          .filter((x) => x.rank >= 0)
          .sort((a, b) => a.rank - b.rank || a.u.nombre.localeCompare(b.u.nombre))
          .slice(0, 8)
          .map(({ u }): SearchSuggestion => ({
            id: u.id,
            label: `${u.nombre} ${u.apellido}`.trim(),
            sublabel: [rolLabels[u.rol] ?? u.rol, u.email].filter(Boolean).join(" · ") || undefined,
          }));
      },
      onSelectSuggestion: (s) => {
        const u = usuarios.find((x) => x.id === s.id);
        if (u) setDetalle(u);
      },
    });
    return clearToolbar;
  }, [setToolbar, clearToolbar, esAdmin, load, usuarios, rolLabels]);

  const presenciaPorId = useMemo(() => new Map(presencia.map((p) => [p.id, p])), [presencia]);

  const invitacionesPendientes = useMemo(() => invitaciones.filter((i) => i.estado === "Pendiente"), [invitaciones]);
  const invitacionesVisibles = verInvitacionesRespondidas ? invitaciones : invitacionesPendientes;
  const solicitudesPorDecidir = useMemo(() => solicitudes.filter((s) => s.estado === "pendiente_admin"), [solicitudes]);
  // Una vez resuelta (aprobada o rechazada), la solicitud se queda visible en la bandeja -- con su
  // motivo y qué se decidió -- durante una semana, para que quede registro de qué se eliminó y por
  // qué; pasado ese plazo ya no aporta y estorba (Alicia 2026-09-18). Las que siguen pendientes
  // (esperando gerente o admin) se quedan siempre, sin importar cuándo se pidieron.
  // `Date.now()` es una llamada impura -- no puede ejecutarse directamente en el cuerpo del
  // componente ni dentro de un useMemo (react-hooks/purity). El inicializador perezoso de
  // useState sí está pensado para esto: corre una sola vez, al montar, y de ahí en adelante
  // "ahora" queda fijo para esta sesión de la pantalla -- suficiente para la ventana de una
  // semana, que no necesita recalcularse en cada render.
  const [ahora] = useState(() => Date.now());
  const solicitudesVisibles = useMemo(() => {
    const UNA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
    return solicitudes.filter((s) => {
      if (s.estado !== "aprobada" && s.estado !== "rechazada") return true;
      const resueltaEn = s.revisadoEn ?? s.createdAt;
      return ahora - new Date(resueltaEn).getTime() < UNA_SEMANA_MS;
    });
  }, [solicitudes, ahora]);

  const stats = useMemo(
    () => ({
      total: usuarios.length,
      conectados: presencia.filter((p) => p.enLinea).length,
      pendientes: invitacionesPendientes.length,
    }),
    [usuarios, presencia, invitacionesPendientes],
  );

  const usuariosVisibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (filtRol && u.rol !== filtRol) return false;
      if (filtEstado === "activa" && !u.activo) return false;
      if (filtEstado === "desactivada" && u.activo) return false;
      const enLinea = presenciaPorId.get(u.id)?.enLinea ?? false;
      if (filtConexion === "en-linea" && !enLinea) return false;
      if (filtConexion === "desconectados" && enLinea) return false;
      if (!q) return true;
      return (
        `${u.nombre} ${u.apellido}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (rolLabels[u.rol] ?? u.rol).toLowerCase().includes(q)
      );
    });
  }, [usuarios, filtRol, filtEstado, filtConexion, search, presenciaPorId, rolLabels]);

  const chips: FilterChip[] = [
    search && { key: "search", label: `“${search}”` },
    filtRol && { key: "rol", label: rolLabels[filtRol as Rol] },
    filtEstado && { key: "estado", label: ESTADOS_CUENTA.find((e) => e.value === filtEstado)?.label ?? filtEstado },
    filtConexion && { key: "conexion", label: CONEXION.find((c) => c.value === filtConexion)?.label ?? filtConexion },
  ].filter(Boolean) as FilterChip[];

  function removeChip(key: string) {
    if (key === "search") setSearch("");
    if (key === "rol") setFiltRol("");
    if (key === "estado") setFiltEstado("");
    if (key === "conexion") setFiltConexion("");
  }

  function clearAll() {
    setSearch("");
    setFiltRol("");
    setFiltEstado("");
    setFiltConexion("");
  }

  /**
   * El nombre de lo que se pidió eliminar. Desde el 2026-09-09 el backend lo guarda como fotografía
   * en la propia solicitud (SolicitudEliminacion.entidadNombre) -- por eso sigue disponible aunque la
   * entidad ya se haya borrado. Las dos búsquedas en listas en memoria son solo el respaldo para
   * solicitudes creadas antes de que existiera ese campo.
   */
  function entidadNombre(s: SolicitudEliminacion): string {
    if (s.entidadNombre) return s.entidadNombre;
    if (s.tipoEntidad === "cliente") return clientes.find((c) => c.id === s.entidadId)?.nombre ?? "—";
    if (s.tipoEntidad === "proveedor") return providers.find((p) => p.id === s.entidadId)?.nombre ?? "—";
    if (s.tipoEntidad === "usuario") return usuarioNombre(s.entidadId, "—");
    return projects.find((p) => p.id === s.entidadId)?.nombre ?? "—";
  }

  // `solicitadoPorId` puede venir en null: si esa cuenta se eliminó después, la solicitud se conserva
  // sin dueño (Nexit_Back/docs/40) en vez de desaparecer del historial.
  function usuarioNombre(id: string | null | undefined, siNoEsta = "—"): string {
    if (!id) return "Usuario eliminado";
    const u = usuarios.find((x) => x.id === id);
    return u ? `${u.nombre} ${u.apellido}`.trim() : siNoEsta;
  }

  /**
   * Por qué NO se puede pedir la eliminación de esta cuenta, o null si sí se puede. Las dos razones
   * las rechaza igual el backend con 403 -- acá salen antes, apagando el botón, para que nadie haga
   * clic solo para recibir un error.
   */
  function motivoNoEliminable(u: Usuario): string | null {
    if (u.id === authUser?.id) return "No puedes pedir que eliminen tu propia cuenta";
    if (u.rol === "super_admin") return "La cuenta del super administrador no se puede eliminar";
    return null;
  }

  async function handleSaveUsuario(id: string, input: UsuarioUpdateInput) {
    try {
      const updated = await usuariosApi.update(id, input);
      setUsuarios((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setDetalle((prev) => (prev?.id === id ? updated : prev));
      pushToast("Usuario actualizado", "success");
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo actualizar el usuario", "danger");
    }
  }

  /** Una sola función para las cuatro confirmaciones -- ver el tipo Confirmacion. */
  async function ejecutarConfirmacion(comentario: string) {
    if (!confirmacion) return;
    setConfirmando(true);
    try {
      if (confirmacion.tipo === "solicitarEliminacionUsuario") {
        // Nunca se borra en el acto (Alicia, 2026-09-08): se crea la solicitud, le llega la
        // notificación a los administradores y al super administrador, y aparece abajo esperando
        // decisión. La persona sigue en la tabla, con acceso, hasta que alguien apruebe.
        const creada = await solicitudesEliminacionApi.create({
          tipoEntidad: "usuario",
          entidadId: confirmacion.usuario.id,
          motivo: comentario || null,
        });
        setSolicitudes((prev) => [creada, ...prev]);
        setDetalle(null);
        pushToast("Solicitud enviada a los administradores", "success");
      } else if (confirmacion.tipo === "cancelarInvitacion") {
        await invitacionesApi.cancelar(confirmacion.invitacion.id);
        setInvitaciones((prev) => prev.filter((x) => x.id !== confirmacion.invitacion.id));
        pushToast("Invitación cancelada", "success");
      } else if (confirmacion.tipo === "aprobarSolicitud") {
        const updated = await solicitudesEliminacionApi.aprobarComoAdmin(confirmacion.solicitud.id, { comentario: comentario || null });
        setSolicitudes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        pushToast("Solicitud aprobada, el registro se eliminó", "success");
        // Si lo aprobado era una cuenta, la persona ya no está en el directorio.
        if (confirmacion.solicitud.tipoEntidad === "usuario") {
          setUsuarios((prev) => prev.filter((x) => x.id !== confirmacion.solicitud.entidadId));
        }
        fetchClientes();
        fetchProviders();
        fetchProjects();
      } else {
        const updated = await solicitudesEliminacionApi.rechazarComoAdmin(confirmacion.solicitud.id, { comentario: comentario || null });
        setSolicitudes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        pushToast("Solicitud rechazada", "success");
      }
      setConfirmacion(null);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "No se pudo completar la acción", "danger");
    } finally {
      setConfirmando(false);
    }
  }

  if (!esAdmin) {
    return <EmptyState icon={Users} title="El directorio del equipo está disponible solo para administradores." />;
  }

  return (
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-text-3">Equipo</div>
      <h1 className={styles.h1}>Gestión de usuarios</h1>
      <p className="mb-5 text-[13px] text-text-2">
        Registra, actualiza y da de baja las cuentas del equipo, y resuelve sus solicitudes.
      </p>

      <div className={`mb-4 ${styles.kpis3}`}>
        <StatCard n={stats.total} label="Todos los usuarios" />
        <StatCard n={stats.conectados} label="Conectados ahora" accent="#036B3C" />
        <StatCard n={stats.pendientes} label="Invitaciones pendientes" accent={stats.pendientes > 0 ? "#7A4E00" : undefined} />
      </div>

      <div className={`mb-4 ${styles.filtersPanel}`}>
        <div className={styles.filterControls}>
          <Dropdown
            value={filtRol}
            onChange={setFiltRol}
            placeholder="Todos los roles"
            options={ROLES.map((r) => ({ value: r, label: rolLabels[r] }))}
          />
          <Dropdown value={filtEstado} onChange={setFiltEstado} placeholder="Todos los estados" options={ESTADOS_CUENTA} />
          <Dropdown value={filtConexion} onChange={setFiltConexion} placeholder="Toda la actividad" options={CONEXION} />
        </div>
        <ActiveFilters chips={chips} onRemove={removeChip} onClearAll={clearAll} variant="panel" />
      </div>

      {loading ? (
        <div className="py-14 text-center text-[13px] text-text-3">Cargando…</div>
      ) : usuariosVisibles.length === 0 ? (
        <EmptyState
          icon={Users}
          title={usuarios.length === 0 ? "Todavía no hay nadie en el equipo." : "Nadie coincide con estos filtros."}
          action={chips.length > 0 ? { label: "Limpiar filtros", onClick: clearAll } : undefined}
        />
      ) : (
        <div className="mb-9">
          <Table
            footer={
              <span className="text-[12px] text-text-3">
                {usuariosVisibles.length === usuarios.length
                  ? `${usuarios.length} ${usuarios.length === 1 ? "persona" : "personas"} en el equipo`
                  : `${usuariosVisibles.length} de ${usuarios.length}`}
              </span>
            }
          >
            <Thead>
              <Th>Usuario</Th>
              <Th className="text-center">Correo</Th>
              <Th className="text-center">Rol</Th>
              <Th className="text-center">Estado de la cuenta</Th>
              <Th className="text-center">Acciones</Th>
            </Thead>
            <tbody>
              {usuariosVisibles.map((u) => {
                const nombreCompleto = `${u.nombre} ${u.apellido}`.trim();
                const enLinea = presenciaPorId.get(u.id)?.enLinea ?? false;
                const esYo = u.id === authUser?.id;
                const rolColor = ROL_COLORS[u.rol];
                const cuentaColor = u.activo ? CUENTA_ACTIVA_COLOR : CUENTA_INACTIVA_COLOR;
                const eliminaEl = u.fechaDesactivacion
                  ? new Date(new Date(u.fechaDesactivacion).getTime() + 30 * 24 * 60 * 60 * 1000)
                  : null;
                return (
                  <Tr key={u.id} onClick={() => setDetalle(u)}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-ink text-[11px] font-semibold text-green">
                            {inicialesPersona(u.nombre, u.apellido)}
                          </div>
                          {enLinea && (
                            <span
                              aria-hidden
                              title="Conectado ahora"
                              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{nombreCompleto || "Sin nombre"}</span>
                            {esYo && <Tag>Tú</Tag>}
                          </div>
                          <div className="text-[11px] text-text-3">{enLinea ? "Conectado ahora" : "Desconectado"}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-center text-text-2">{u.email}</Td>
                    <Td className="text-center">
                      <Badge bg={rolColor.bg} color={rolColor.c}>
                        {rolLabels[u.rol]}
                      </Badge>
                    </Td>
                    <Td className="text-center">
                      <Badge bg={cuentaColor.bg} color={cuentaColor.c}>
                        {u.activo ? "Activa" : "Desactivada"}
                      </Badge>
                      {!u.activo && eliminaEl && (
                        // docs/17: a los 30 días de desactivada, el sistema la elimina sola.
                        <div className="mt-1 text-[11px] text-text-3">
                          se elimina el {eliminaEl.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="flex justify-center gap-1.5">
                        {/* Editar es admin/super_admin desde 2026-09-09 (antes exclusivo de
                            super_admin); pedir una eliminación es de cualquiera -- un administrador
                            también puede, y de hecho es el caso normal: él la pide, y la decide
                            quien la reciba (Nexit_Back/docs/40). */}
                        {esAdmin && (
                          <RowAction
                            label={esYo ? "Editar mi perfil" : `Editar a ${u.nombre}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(u);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil size={13} strokeWidth={2} />
                          </RowAction>
                        )}
                        <span title={motivoNoEliminable(u) ?? `Pedir que se elimine a ${u.nombre}`}>
                          <RowAction
                            label={motivoNoEliminable(u) ?? `Pedir que se elimine a ${u.nombre}`}
                            tone="danger"
                            disabled={motivoNoEliminable(u) !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmacion({ tipo: "solicitarEliminacionUsuario", usuario: u });
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </RowAction>
                        </span>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {esAdmin && (
        <InvitacionesSection
          invitaciones={invitaciones}
          pendientes={invitacionesPendientes}
          visibles={invitacionesVisibles}
          verRespondidas={verInvitacionesRespondidas}
          onToggleRespondidas={() => setVerInvitacionesRespondidas((v) => !v)}
          rolLabels={rolLabels}
          onInvitar={() => setInvitarOpen(true)}
          onCancelar={(i) => setConfirmacion({ tipo: "cancelarInvitacion", invitacion: i })}
        />
      )}

      <SolicitudesSection
        solicitudes={solicitudesVisibles}
        porDecidir={solicitudesPorDecidir.length}
        entidadNombre={entidadNombre}
        usuarioNombre={usuarioNombre}
        onAprobar={(solicitud, nombre) => setConfirmacion({ tipo: "aprobarSolicitud", solicitud, nombre })}
        onRechazar={(solicitud, nombre) => setConfirmacion({ tipo: "rechazarSolicitud", solicitud, nombre })}
      />

      <InvitarUsuarioModal open={invitarOpen} onClose={() => setInvitarOpen(false)} onInvitado={load} />
      <RegistrarUsuarioModal open={registrarOpen} onClose={() => setRegistrarOpen(false)} onRegistrado={load} />
      <UsuarioFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={handleSaveUsuario}
        editing={editing}
        esMiPropiaCuenta={editing?.id === authUser?.id}
        enLinea={editing ? (presenciaPorId.get(editing.id)?.enLinea ?? false) : false}
      />
      <UsuarioDetail
        usuario={detalle}
        presencia={detalle ? presenciaPorId.get(detalle.id) : undefined}
        puedeEditar={esAdmin}
        esMiPropiaCuenta={detalle?.id === authUser?.id}
        motivoNoEliminable={detalle ? motivoNoEliminable(detalle) : null}
        onClose={() => setDetalle(null)}
        onEdit={() => {
          setEditing(detalle);
          setFormOpen(true);
        }}
        onDelete={() => detalle && setConfirmacion({ tipo: "solicitarEliminacionUsuario", usuario: detalle })}
      />

      <ConfirmDialog
        open={confirmacion !== null}
        loading={confirmando}
        onClose={() => setConfirmacion(null)}
        onConfirm={ejecutarConfirmacion}
        title={
          confirmacion?.tipo === "solicitarEliminacionUsuario"
            ? "Pedir que se elimine esta cuenta"
            : confirmacion?.tipo === "cancelarInvitacion"
              ? "Cancelar la invitación"
              : confirmacion?.tipo === "aprobarSolicitud"
                ? "Aprobar y eliminar"
                : "Rechazar la solicitud"
        }
        confirmLabel={
          confirmacion?.tipo === "solicitarEliminacionUsuario"
            ? "Enviar solicitud"
            : confirmacion?.tipo === "cancelarInvitacion"
              ? "Sí, cancelar"
              : confirmacion?.tipo === "aprobarSolicitud"
                ? "Sí, eliminar"
                : "Sí, rechazar"
        }
        tone={confirmacion?.tipo === "rechazarSolicitud" || confirmacion?.tipo === "solicitarEliminacionUsuario" ? "neutral" : "danger"}
        comentario={
          confirmacion?.tipo === "solicitarEliminacionUsuario"
            ? "Motivo"
            : confirmacion?.tipo === "aprobarSolicitud" || confirmacion?.tipo === "rechazarSolicitud"
              ? "Comentario para quien la solicitó (opcional)"
              : undefined
        }
        comentarioRequerido={confirmacion?.tipo === "solicitarEliminacionUsuario"}
      >
        {confirmacion?.tipo === "solicitarEliminacionUsuario" && (
          <>
            Un administrador revisa la solicitud y decide si la cuenta de{" "}
            <strong className="text-text">{`${confirmacion.usuario.nombre} ${confirmacion.usuario.apellido}`.trim()}</strong>{" "}
            se elimina o no. Te llega una notificación con la respuesta.
            <div className="mt-2 text-text-3">
              Para quitarle el acceso ya mismo sin esperar, edítala y desmarca “Cuenta activa”.
            </div>
          </>
        )}
        {confirmacion?.tipo === "cancelarInvitacion" && (
          <>
            La invitación a <strong className="text-text">{confirmacion.invitacion.email}</strong> deja de existir. Si ya recibió
            el correo y hace clic en el enlace, entrará sin perfil y el sistema le dirá que no tiene acceso.
            <div className="mt-2 text-text-3">Después de cancelarla puedes volver a invitar ese mismo correo.</div>
          </>
        )}
        {confirmacion?.tipo === "aprobarSolicitud" && (
          <>
            Se elimina a <strong className="text-text">{confirmacion.nombre}</strong> del sistema. Es la decisión final: no se puede deshacer.
            {confirmacion.solicitud.tipoEntidad === "usuario" && (
              <div className="mt-2 text-text-3">
                Pierde el acceso de inmediato. Queda un respaldo interno de quién era, por si hace falta consultarlo después.
              </div>
            )}
          </>
        )}
        {confirmacion?.tipo === "rechazarSolicitud" && (
          <>
            <strong className="text-text">{confirmacion.nombre}</strong> no se elimina y la solicitud queda cerrada. Quien la
            pidió tendrá que volver a solicitarlo si hace falta.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
