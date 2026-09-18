/**
 * Tipos que reflejan EXACTAMENTE los DTOs reales del backend (Nexit_Back),
 * módulo por módulo -- a diferencia de src/types/domain.ts (que modela los
 * datos de la maqueta/diseño con mocks, campos en español simplificados e
 * `id: number`). Estos usan `id: string` (Guid real) y los mismos nombres
 * de campo que expone la API (camelCase, generado por ASP.NET Core a partir
 * de las propiedades PascalCase de cada DTO en C#).
 *
 * Se mantienen separados a propósito: mientras el diseño visual (Lovable)
 * sigue evolucionando sobre los mocks, esta capa ya puede conectarse de
 * verdad al backend sin arriesgar romper ninguna pantalla existente. Cuando
 * una pantalla esté lista para usar datos reales, se mapea desde acá.
 */

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export interface ClienteTelefono {
  id?: string;
  telefono: string;
  etiqueta?: string | null;
}

/** Lista simple de correos, sin "principal" (2026-09-06) -- mismo patrón que ClienteTelefono: un cliente puede tener más de uno. */
export interface ClienteEmail {
  id?: string;
  email: string;
  etiqueta?: string | null;
}

export interface ClienteInput {
  nombre: string;
  sector?: string | null;
  paisId?: string | null;
  regionId?: string | null;
  ciudadId?: string | null;
  estado: string; // "Activo" | "Prospecto" | "Inactivo"
  /** Etapa del proceso comercial (catálogo EtapaCliente, docs/33) -- distinta de `estado`. Opcional. */
  etapaId?: string | null;
  ciudad?: string | null;
  direccion?: string | null;
  web?: string | null;
  contacto?: string | null;
  cargoContacto?: string | null;
  valorReferencia?: string | null;
  notas?: string | null;
  telefonos: ClienteTelefono[];
  emails: ClienteEmail[];
}

export interface Cliente extends ClienteInput {
  id: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ClientePrioridad {
  clienteId: string;
  nombre: string;
  puntaje: number;
  razones: string[];
}

// ---------------------------------------------------------------------------
// Adjuntos de cliente
// ---------------------------------------------------------------------------

export interface ClienteAdjuntoInput {
  tipo: string; // "link" | "archivo"
  nombre: string;
  url?: string | null;
  storagePath?: string | null;
  meta?: string | null;
  contentType?: string | null;
  tamanoBytes?: number | null;
  fecha?: string | null;
}

export interface ClienteAdjunto extends ClienteAdjuntoInput {
  id: string;
  clienteId: string;
  fecha: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

export interface ProveedorTelefono {
  id?: string;
  telefono: string;
  etiqueta?: string | null;
}

/** Lista simple de correos, sin "principal" (2026-09-06) -- ver el comentario equivalente en ClienteEmail. */
export interface ProveedorEmail {
  id?: string;
  email: string;
  etiqueta?: string | null;
}

export interface ProveedorInput {
  nombre: string;
  paisId: string;
  regionId?: string | null;
  ciudadId?: string | null;
  categoriaId: string;
  estado: string; // "Activo" | "En evaluación" | "Pausado" | "Bloqueado"
  contacto?: string | null;
  cargoContacto?: string | null;
  web?: string | null;
  direccion?: string | null;
  aforo?: number | null;
  costoReferencia?: string | null;
  score?: number | null;
  presupuesto?: string | null;
  cobertura?: string | null;
  notas?: string | null;
  telefonos: ProveedorTelefono[];
  emails: ProveedorEmail[];
  servicioIds: string[];
}

export interface ColaboradorProveedor {
  usuarioId: string;
  nombre: string;
  iniciales?: string | null;
}

export interface Proveedor extends ProveedorInput {
  id: string;
  createdAt: string;
  updatedAt?: string | null;
  /** "Trabajando con este proveedor" (docs/19/20) -- cada quien se marca a sí mismo. */
  colaboradores: ColaboradorProveedor[];
}

export interface ProveedorPrioridad {
  proveedorId: string;
  nombre: string;
  puntaje: number;
  razones: string[];
}

// ---------------------------------------------------------------------------
// Adjuntos de proveedor
// ---------------------------------------------------------------------------

export interface ProveedorAdjuntoInput {
  tipo: string; // "link" | "archivo"
  nombre: string;
  url?: string | null;
  storagePath?: string | null;
  meta?: string | null;
  contentType?: string | null;
  tamanoBytes?: number | null;
  fecha?: string | null;
}

export interface ProveedorAdjunto extends ProveedorAdjuntoInput {
  id: string;
  proveedorId: string;
  fecha: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

export interface ProyectoEquipoMiembro {
  id?: string;
  rol: string;
  nombre: string;
}

export interface ProyectoInput {
  nombre: string;
  clienteId?: string | null;
  contactoProyecto?: string | null;
  tipoProyecto?: string | null;
  prioridad?: string | null;
  ciudad?: string | null;
  sedeNext?: string | null;
  fechaSolicitud?: string | null;
  fechaEvento?: string | null;
  estadoId: string;
  porcentajeAvance: number;
  estadoBrief: string;
  propuestaEstado: string;
  numeroFactura?: string | null;
  pagado: boolean;
  fechaPago?: string | null;
  notas?: string | null;
  /** Solo admin/super_admin puede asignarlo explícito; si un gerente no lo manda, el backend lo autoasigna. */
  gerenteId?: string | null;
  equipo: ProyectoEquipoMiembro[];
  proveedorIds: string[];
}

export interface Proyecto extends ProyectoInput {
  id: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ProyectoPrioridad {
  proyectoId: string;
  nombre: string;
  puntaje: number;
  razones: string[];
}

// ---------------------------------------------------------------------------
// Adjuntos de proyecto
// ---------------------------------------------------------------------------

export interface ProyectoAdjuntoInput {
  tipo: string; // "link" | "archivo"
  nombre: string;
  url?: string | null;
  storagePath?: string | null;
  meta?: string | null;
  contentType?: string | null;
  tamanoBytes?: number | null;
  fecha?: string | null;
}

export interface ProyectoAdjunto extends ProyectoAdjuntoInput {
  id: string;
  proyectoId: string;
  fecha: string;
  createdAt: string;
}

export interface SeguimientoProyectoInput {
  area: string;
  fecha?: string | null;
  nota: string;
}

export interface SeguimientoProyecto extends SeguimientoProyectoInput {
  id: string;
  autorId?: string | null;
  fecha: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Informes (solo admin/super_admin)
// ---------------------------------------------------------------------------

export interface InformeResumen {
  totalProveedores: number;
  totalClientes: number;
  totalProyectos: number;
  proyectosSinProveedor: number;
  porEstado: Record<string, number>;
  porBrief: Record<string, number>;
}

export interface InformeSnapshot extends InformeResumen {
  id: string;
  tipo: string;
  periodoKey: string;
  createdAt: string;
}

export interface CrearInformeSnapshotInput {
  tipo: string;
  periodoKey: string;
}

// ---------------------------------------------------------------------------
// Usuarios (solo super_admin)
// ---------------------------------------------------------------------------

export type Rol = "super_admin" | "admin" | "manager" | "miembro";

/** Crea el perfil de negocio para una cuenta que YA existe en Supabase Auth (invitada aparte). */
export interface UsuarioCreateInput {
  id: string; // el UUID que Supabase Auth ya le asignó a esa cuenta
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  iniciales?: string | null;
  activo?: boolean;
}

/**
 * Alta manual, sin correo de invitación de por medio (`POST /api/usuarios/registrar`): el backend
 * crea la cuenta en Supabase Auth y el perfil en un solo paso, así que aquí NO se manda ningún id.
 * La persona entra la primera vez con el código del login y ahí crea su contraseña.
 */
export interface UsuarioRegistrarInput {
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  iniciales?: string | null;
}

export interface UsuarioUpdateInput {
  nombre: string;
  apellido: string;
  rol: Rol;
  iniciales?: string | null;
  activo: boolean;
}

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  iniciales?: string | null;
  activo: boolean;
  /** Cuándo se desactivó (null si sigue activa). Se elimina sola a los 30 días de esta fecha. */
  fechaDesactivacion?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

/**
 * Versión liviana de Usuario para GET /api/usuarios/equipo (agregado 2026-09-09): a diferencia de
 * Usuario, cualquier autenticado puede pedir esta lista -- por eso no trae email ni el resto de
 * datos de cuenta, solo lo que hace falta para buscar y mostrar a alguien en el selector de
 * "miembros del equipo" de un proyecto. Ya viene filtrada a rol miembro/manager (Director) activos.
 */
export interface UsuarioEquipo {
  id: string;
  nombre: string;
  apellido: string;
  rol: Rol;
}

// ---------------------------------------------------------------------------
// Catálogos (lectura: cualquier autenticado; crear/editar/eliminar: admin/super_admin)
// ---------------------------------------------------------------------------

export interface Pais {
  id: string;
  nombre: string;
  etiquetaRegion: string;
}
export interface PaisInput {
  nombre: string;
  etiquetaRegion: string;
}

export interface Region {
  id: string;
  paisId: string;
  nombre: string;
}
export interface RegionInput {
  paisId: string;
  nombre: string;
}

export interface Ciudad {
  id: string;
  regionId: string;
  nombre: string;
}
export interface CiudadInput {
  regionId: string;
  nombre: string;
}

/** Usado para categorías de proveedor y para servicios (misma forma, endpoints distintos). */
export interface ItemCatalogo {
  id: string;
  nombre: string;
}

export interface FaseProyecto {
  fase: number;
  nombre: string;
}

export interface EstadoProyecto {
  id: string;
  nombre: string;
  fase: number;
  orden: number;
}
export interface EstadoProyectoInput {
  nombre: string;
  fase: number;
  orden: number;
}

/** Etapa del proceso comercial de un Cliente (E1-E6, docs/33) -- distinta de EstadoProyecto: esta vive
 * en el Cliente, no en el Proyecto, y cubre las etapas E1/E2 que ocurren antes de que exista un brief. */
export interface EtapaCliente {
  id: string;
  nombre: string;
  orden: number;
  porcentajeProceso: number;
}
export interface EtapaClienteInput {
  nombre: string;
  orden: number;
  porcentajeProceso: number;
}

/** Los `tipo` válidos para DELETE /api/catalogos/{tipo}/{id} -- ver CatalogosService en el backend. */
export type CatalogoTipo = "paises" | "regiones" | "ciudades" | "categorias-proveedor" | "servicios" | "estados-proveedor" | "estados-proyecto" | "etapas-cliente";

// ---------------------------------------------------------------------------
// Solicitudes de eliminación
// ---------------------------------------------------------------------------

/** "usuario" se agregó el 2026-09-08: eliminar a una persona también pasa por solicitud (Nexit_Back/docs/40). */
export type TipoEntidadEliminable = "cliente" | "proveedor" | "proyecto" | "usuario";

export interface SolicitudEliminacionInput {
  tipoEntidad: TipoEntidadEliminable;
  entidadId: string;
  motivo?: string | null;
}

export interface RevisionSolicitudInput {
  comentario?: string | null;
}

export interface SolicitudEliminacion {
  id: string;
  tipoEntidad: TipoEntidadEliminable;
  entidadId: string;
  /**
   * Nombre de la entidad al momento de pedir la eliminación (foto, no en vivo): sobrevive aunque la
   * entidad se elimine después. Viene en null en solicitudes creadas antes de este campo (2026-09-09).
   */
  entidadNombre?: string | null;
  /** Null si esa cuenta se eliminó después -- la solicitud sobrevive sin dueño. */
  solicitadoPorId?: string | null;
  motivo?: string | null;
  estado: string;
  gerenteResponsableId?: string | null;
  aprobadoPorGerenteId?: string | null;
  aprobadoPorGerenteEn?: string | null;
  revisadoPorId?: string | null;
  revisadoEn?: string | null;
  comentarioRevision?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Notificaciones (bandeja propia -- nunca la de alguien más)
// ---------------------------------------------------------------------------

export interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  tipoEntidad?: string | null;
  entidadId?: string | null;
  solicitudId?: string | null;
  leida: boolean;
  fechaCreacion: string;
  fechaLeida?: string | null;
}

// ---------------------------------------------------------------------------
// Historial de cambios (de un proyecto, proveedor o cliente)
// ---------------------------------------------------------------------------

export type TipoEntidadHistorial = "proyecto" | "proveedor" | "cliente";

export interface HistorialCambio {
  id: string;
  /** Null si esa cuenta se eliminó después -- la fila del historial no se borra nunca. */
  usuarioId?: string | null;
  usuarioNombre?: string | null;
  accion: string;
  campo?: string | null;
  valorAnterior?: string | null;
  valorNuevo?: string | null;
  fecha: string;
}

// ---------------------------------------------------------------------------
// Invitaciones (invitar y registrar en un solo paso -- docs/25)
// ---------------------------------------------------------------------------

export interface InvitacionInput {
  email: string;
  rol: Rol;
  mensaje?: string | null;
}

export interface AceptarInvitacionInput {
  nombre: string;
  apellido: string;
  iniciales?: string | null;
}

/** Invitar a varios correos de una sola vez (POST /api/invitaciones/lote) -- todos con el mismo rol y mensaje. */
export interface InvitacionLoteDestinatario {
  email: string;
  rol: Rol;
}

export interface InvitacionLoteInput {
  destinatarios: InvitacionLoteDestinatario[];
  mensaje?: string | null;
}

export interface InvitacionFallida {
  email: string;
  motivo: string;
}

/**
 * Resultado de un envío por lote. No es "todo o nada" a propósito (ver
 * CrearInvitacionesLoteUseCase en Nexit_Back): un correo repetido o de un dominio ajeno no
 * cancela el resto, así que la pantalla tiene que mostrar las dos listas.
 */
export interface InvitacionesLoteResultado {
  enviadas: Invitacion[];
  fallidas: InvitacionFallida[];
}

export interface Invitacion {
  id: string;
  email: string;
  rol: Rol;
  mensaje?: string | null;
  estado: string;
  invitadoPorNombre?: string | null;
  createdAt: string;
  fechaRespuesta?: string | null;
}

// ---------------------------------------------------------------------------
// Presencia en vivo (HU-12)
// ---------------------------------------------------------------------------

export interface PresenciaUsuario {
  id: string;
  nombre: string;
  apellido?: string | null;
  rol: Rol;
  enLinea: boolean;
  ultimaActividad?: string | null;
}

// ---------------------------------------------------------------------------
// Estado de cuenta (login: detección "primera vez" vs. "recurrente", docs/30)
// ---------------------------------------------------------------------------

export interface EstadoCuentaResponse {
  tieneContrasena: boolean;
}

// ---------------------------------------------------------------------------
// Importación masiva desde Excel (clientes/proveedores/proyectos, docs/31)
// ---------------------------------------------------------------------------

export interface ImportarError {
  fila: number;
  mensaje: string;
}

export interface ImportarResultado {
  creados: number;
  /** Filas que ya existían (mismo Nombre, o Cliente+Nombre en Proyectos) y se actualizaron en vez de duplicarse (docs/35). */
  actualizados: number;
  errores: ImportarError[];
}
