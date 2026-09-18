"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Drawer, FormDrawerBody, FormDrawerFooter, FormDrawerHeader, FormDrawerSection } from "@/components/ui/Drawer";
import { DeleteOrRequestButton } from "@/components/ui/DeleteAction";
import { EntityAttachments, type PendingAttachment } from "@/components/ui/EntityAttachments";
import { Dropdown, type DropdownGroup } from "@/components/ui/primitives";
import { Field, Input, Row, Textarea } from "@/components/ui/form";
import { parseCSVFirstRow } from "@/lib/csv";
import { clearFormDraft, readFormDraft, useFormDraftAutosave } from "@/lib/use-form-draft";
import { useAuthStore } from "@/store/auth-store";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useClientesStore } from "@/store/clientes-store";
import { useUiStore } from "@/store/ui-store";
import { proyectoAdjuntosApi } from "@/services/api/proyecto-adjuntos-service";
import { usuariosApi } from "@/services/api/usuarios-service";
import type { Proveedor, Proyecto, ProyectoEquipoMiembro, ProyectoInput, UsuarioEquipo } from "@/types/api";
import { ProviderPicker } from "./ProviderPicker";

const BRIEF_ESTADOS = ["Pendiente por enviar", "Entregado, a espera de respuesta", "Requiere ajustes", "Aprobado"];
// Debe calzar EXACTO con `Propuestas` en Nexit_Back/.../Validators/Proyectos/ProyectoValidators.cs
// -- si no coincide, guardar el proyecto falla en el backend con "El estado de la propuesta no es válido.".
const PROPUESTA_ESTADOS = ["No enviada", "En proceso", "Enviada"];
// Listas base del mockup aprobado -- el valor ya guardado en un proyecto viejo (si no está
// en esta lista) se agrega igual como opción extra, para no perderlo por venir de antes de
// que este campo se volviera un dropdown cerrado.
const TIPO_BASE = ["Corporativo", "Evento social"];
const PRIORIDAD_BASE = ["Alta", "Media", "Baja"];
const SEDE_BASE = ["Bogotá", "Ciudad de México"];

function withCurrent(base: string[], current: string): string[] {
  return current && !base.includes(current) ? [...base, current] : base;
}

interface FormState {
  nombre: string;
  clienteId: string;
  contactoProyecto: string;
  tipoProyecto: string;
  prioridad: string;
  ciudad: string;
  sedeNext: string;
  fechaSolicitud: string;
  fechaEvento: string;
  estadoId: string;
  porcentajeAvance: number;
  estadoBrief: string;
  propuestaEstado: string;
  numeroFactura: string;
  pagado: boolean;
  fechaPago: string;
  notas: string;
  gerenteId: string;
  equipo: ProyectoEquipoMiembro[];
}

const emptyForm: FormState = {
  nombre: "",
  clienteId: "",
  contactoProyecto: "",
  tipoProyecto: "",
  prioridad: "",
  ciudad: "",
  sedeNext: "",
  fechaSolicitud: "",
  fechaEvento: "",
  estadoId: "",
  porcentajeAvance: 0,
  estadoBrief: BRIEF_ESTADOS[0],
  propuestaEstado: PROPUESTA_ESTADOS[0],
  numeroFactura: "",
  pagado: false,
  fechaPago: "",
  notas: "",
  gerenteId: "",
  equipo: [],
};

export function ProjectFormModal({
  open,
  onClose,
  onSave,
  onDelete,
  editing,
  providers,
  pendingAdjuntos,
  onPendingAdjuntosChange,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: ProyectoInput) => void;
  /** Solo se usa (y solo se muestra "Eliminar") cuando `editing` no es null. */
  onDelete?: () => void;
  editing: Proyecto | null;
  providers: Proveedor[];
  /** Archivos/links agregados ANTES de guardar (Alicia 2026-09-10) -- ver el mismo patrón en
   * ClienteFormModal.tsx. */
  pendingAdjuntos: PendingAttachment[];
  onPendingAdjuntosChange: (next: PendingAttachment[]) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const pushToast = useUiStore((s) => s.pushToast);
  const { estadosProyecto, fasesProyecto, fetchBase } = useCatalogosStore();
  const { items: clientes, fetchAll: fetchClientes } = useClientesStore();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Personas buscables para "miembros del equipo" (Alicia 2026-09-09): ya vienen filtradas por el
  // backend a solo rol miembro/manager (Director) activos -- ver GET /api/usuarios/equipo. A
  // diferencia del antiguo `usuariosApi.list()` (admin/super_admin exclusivo), esto lo puede pedir
  // cualquiera que esté armando un proyecto.
  const [equipoUsuarios, setEquipoUsuarios] = useState<UsuarioEquipo[]>([]);
  // Fallback para un proyecto viejo cuyo gerente/líder guardado ya no aparece entre los miembros
  // de equipo actuales (p. ej. se le quitó del equipo, o el proyecto es de antes de este cambio) --
  // así igual se ve su nombre en el selector en vez de quedar en blanco.
  const [liderFallback, setLiderFallback] = useState<UsuarioEquipo | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  const puedeAsignarGerente = user?.rol === "admin" || user?.rol === "super_admin";

  useEffect(() => {
    if (!open) return;
    fetchBase();
    fetchClientes();
    usuariosApi.equipo().then(setEquipoUsuarios).catch(() => setEquipoUsuarios([]));
  }, [open, fetchBase, fetchClientes]);

  // Miembros del equipo ya agregados, resueltos contra `equipoUsuarios` por nombre completo --
  // `ProyectoEquipoMiembro` no guarda un usuarioId real (es texto libre desde antes de este
  // cambio), así que el cruce por nombre es lo único disponible. Sirve tanto para lo agregado en
  // esta sesión como para reconciliar el equipo ya guardado de un proyecto existente al editarlo.
  const equipoSeleccionado = useMemo(() => {
    return form.equipo
      .map((m) => equipoUsuarios.find((u) => `${u.nombre} ${u.apellido}`.trim().toLowerCase() === m.nombre.trim().toLowerCase()))
      .filter((u): u is UsuarioEquipo => !!u);
  }, [form.equipo, equipoUsuarios]);

  useEffect(() => {
    if (!open || !editing?.gerenteId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el fallback al cerrar o cuando el proyecto no tiene líder guardado
      setLiderFallback(null);
      return;
    }
    if (equipoSeleccionado.some((u) => u.id === editing.gerenteId)) {
       
      setLiderFallback(null);
      return;
    }
    let cancelado = false;
    usuariosApi
      .getById(editing.gerenteId)
      .then((u) => {
        if (!cancelado) setLiderFallback({ id: u.id, nombre: u.nombre, apellido: u.apellido, rol: u.rol });
      })
      .catch(() => {
        if (!cancelado) setLiderFallback(null);
      });
    return () => {
      cancelado = true;
    };
  }, [open, editing, equipoSeleccionado]);

  const liderOptions = liderFallback && !equipoSeleccionado.some((u) => u.id === liderFallback.id) ? [...equipoSeleccionado, liderFallback] : equipoSeleccionado;
  const miembrosDisponibles = equipoUsuarios.filter((u) => !equipoSeleccionado.some((s) => s.id === u.id));

  // Autoguardado (Alicia 2026-09-07): una key por proyecto (o "nuevo" para
  // el formulario en blanco) -- así el borrador de uno no se mezcla con el
  // de otro. Incluye los proveedores seleccionados (`selectedIds`), no solo
  // los campos de texto -- si no, reabrir un borrador los mostraría vacíos.
  const draftKey = editing ? `proyecto:${editing.id}` : "proyecto:nuevo";

  useEffect(() => {
    if (!open) return;
    const base: FormState = editing
      ? {
          nombre: editing.nombre,
          clienteId: editing.clienteId ?? "",
          contactoProyecto: editing.contactoProyecto ?? "",
          tipoProyecto: editing.tipoProyecto ?? "",
          prioridad: editing.prioridad ?? "",
          ciudad: editing.ciudad ?? "",
          sedeNext: editing.sedeNext ?? "",
          fechaSolicitud: editing.fechaSolicitud?.slice(0, 10) ?? "",
          fechaEvento: editing.fechaEvento?.slice(0, 10) ?? "",
          estadoId: editing.estadoId,
          porcentajeAvance: editing.porcentajeAvance,
          estadoBrief: editing.estadoBrief,
          propuestaEstado: editing.propuestaEstado,
          numeroFactura: editing.numeroFactura ?? "",
          pagado: editing.pagado,
          fechaPago: editing.fechaPago?.slice(0, 10) ?? "",
          notas: editing.notas ?? "",
          gerenteId: editing.gerenteId ?? "",
          equipo: editing.equipo,
        }
      : emptyForm;
    const baseProveedorIds = editing ? editing.proveedorIds : [];
    // Si hay un borrador guardado (se cerró el formulario sin guardar la
    // última vez) y es distinto de los datos ya guardados, se restaura en
    // vez del formulario en blanco/original.
    const draft = readFormDraft<{ form: FormState; proveedorIds: string[] }>(draftKey);
    if (
      draft &&
      (JSON.stringify(draft.form) !== JSON.stringify(base) ||
        JSON.stringify([...draft.proveedorIds].sort()) !== JSON.stringify([...baseProveedorIds].sort()))
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaurando un borrador guardado, no una sincronización derivable sin efecto
      setForm(draft.form);
      setSelectedIds(new Set(draft.proveedorIds));
      pushToast("Recuperamos un borrador sin guardar de este formulario.", "info");
    } else {
       
      setForm(base);
      setSelectedIds(new Set(baseProveedorIds));
    }
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftKey se deriva de `editing`, y pushToast es estable
  }, [open, editing]);

  useFormDraftAutosave(
    open ? draftKey : null,
    useMemo(() => ({ form, proveedorIds: [...selectedIds] }), [form, selectedIds]),
    open,
  );

  const estadosPorFase = useMemo(() => {
    const fases = [...fasesProyecto].sort((a, b) => a.fase - b.fase);
    return fases.map((f) => ({
      fase: f,
      estados: estadosProyecto.filter((e) => e.fase === f.fase).sort((a, b) => a.orden - b.orden),
    }));
  }, [fasesProyecto, estadosProyecto]);

  const estadoGroups: DropdownGroup[] = useMemo(
    () =>
      estadosPorFase.map(({ fase, estados }) => ({
        label: `Fase ${fase.fase} · ${fase.nombre}`,
        options: estados.map((e) => ({ value: e.id, label: e.nombre })),
      })),
    [estadosPorFase],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleProvider(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Agregar ya no pide rol (Alicia 2026-09-09): buscar el nombre y elegirlo de la lista basta.
  function addMiembro(usuarioId: string) {
    const u = equipoUsuarios.find((x) => x.id === usuarioId);
    if (!u) return;
    set("equipo", [...form.equipo, { rol: "", nombre: `${u.nombre} ${u.apellido}`.trim() }]);
  }

  function removeMiembro(idx: number) {
    const quitado = form.equipo[idx];
    // Si a quien se quita era el líder de equipo seleccionado, se limpia esa selección -- no
    // tiene sentido dejar como líder a alguien que ya no está en el equipo del proyecto.
    const eraLider = quitado && equipoSeleccionado.find((u) => `${u.nombre} ${u.apellido}`.trim().toLowerCase() === quitado.nombre.trim().toLowerCase())?.id === form.gerenteId;
    setForm((f) => ({
      ...f,
      equipo: f.equipo.filter((_, i) => i !== idx),
      gerenteId: eraLider ? "" : f.gerenteId,
    }));
  }

  /** "Importar datos" -- rellena el formulario desde la primera fila de un CSV. Cliente y
   * estado se resuelven por nombre contra los catálogos ya cargados; si no hay coincidencia
   * exacta, el campo se deja tal como estaba (no se limpia). */
  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const row = parseCSVFirstRow(String(reader.result));
      if (!row) {
        pushToast("El archivo no tiene una fila de datos para importar", "danger");
        return;
      }
      const pick = (...keys: string[]) => {
        for (const key of keys) {
          const found = Object.keys(row).find((h) => h.trim().toLowerCase() === key);
          if (found && row[found]) return row[found];
        }
        return undefined;
      };
      const clienteNombre = pick("cliente", "empresa");
      const clienteMatch = clienteNombre
        ? clientes.find((c) => c.nombre.toLowerCase() === clienteNombre.toLowerCase())
        : undefined;
      const estadoNombre = pick("estado", "estadoproyecto");
      const estadoMatch = estadoNombre
        ? estadosProyecto.find((e) => e.nombre.toLowerCase() === estadoNombre.toLowerCase())
        : undefined;
      setForm((f) => ({
        ...f,
        nombre: pick("nombre", "proyecto") ?? f.nombre,
        clienteId: clienteMatch ? clienteMatch.id : f.clienteId,
        contactoProyecto: pick("contacto", "contactoproyecto") ?? f.contactoProyecto,
        tipoProyecto: pick("tipo", "tipoproyecto") ?? f.tipoProyecto,
        prioridad: pick("prioridad") ?? f.prioridad,
        ciudad: pick("ciudad") ?? f.ciudad,
        sedeNext: pick("sede", "sedenext") ?? f.sedeNext,
        fechaSolicitud: pick("fechasolicitud") ?? f.fechaSolicitud,
        fechaEvento: pick("fechaevento", "fecha") ?? f.fechaEvento,
        estadoId: estadoMatch ? estadoMatch.id : f.estadoId,
        numeroFactura: pick("factura", "numerofactura") ?? f.numeroFactura,
        notas: pick("notas") ?? f.notas,
      }));
      pushToast("Datos importados. Revisa los campos y guarda.", "info");
    };
    reader.readAsText(file);
  }

  function handleSave() {
    const nextErrors: Record<string, string> = {};
    if (!form.nombre.trim()) nextErrors.nombre = "El nombre del proyecto es requerido";
    if (!form.estadoId) nextErrors.estadoId = "Selecciona el estado";
    if (form.pagado && !form.fechaPago) nextErrors.fechaPago = "La fecha de pago es requerida cuando el proyecto está pagado";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      pushToast(`Falta completar: ${Object.values(nextErrors).join(" · ")}`, "danger");
      panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const input: ProyectoInput = {
      nombre: form.nombre.trim(),
      clienteId: form.clienteId || null,
      contactoProyecto: form.contactoProyecto.trim() || null,
      tipoProyecto: form.tipoProyecto.trim() || null,
      prioridad: form.prioridad.trim() || null,
      ciudad: form.ciudad.trim() || null,
      sedeNext: form.sedeNext.trim() || null,
      fechaSolicitud: form.fechaSolicitud || null,
      fechaEvento: form.fechaEvento || null,
      estadoId: form.estadoId,
      porcentajeAvance: form.porcentajeAvance,
      estadoBrief: form.estadoBrief,
      propuestaEstado: form.propuestaEstado,
      numeroFactura: form.numeroFactura.trim() || null,
      pagado: form.pagado,
      fechaPago: form.fechaPago || null,
      notas: form.notas.trim() || null,
      // Si quien edita no puede reasignar gerente, se reenvía el mismo GerenteId que ya
      // tenía el proyecto (nunca `undefined`/null "porque sí") -- el backend compara este
      // valor contra el guardado y rechaza con 403 cualquier cambio real hecho por alguien
      // sin permiso; si mandáramos `undefined` (se cae del JSON) el backend lo lee como
      // `null`, y eso SE considera un cambio en cuanto el proyecto ya tenía gerente asignado.
      gerenteId: puedeAsignarGerente ? form.gerenteId || null : (editing?.gerenteId ?? null),
      equipo: form.equipo.filter((m) => m.nombre.trim()),
      proveedorIds: [...selectedIds],
    };
    clearFormDraft(draftKey);
    onSave(input);
  }

  return (
    <Drawer open={open} onClose={onClose} panelRef={panelRef}>
      <FormDrawerHeader
        eyebrow={editing ? "Editar proyecto" : "Registrar proyecto"}
        title={editing ? editing.nombre || "Datos del proyecto" : "Datos del nuevo proyecto"}
        onClose={onClose}
        onImportFile={handleImportFile}
      />

      <FormDrawerBody>
        <FormDrawerSection number="01" title="Qué es">
          <Field label="Nombre del proyecto" required error={errors.nombre}>
            <Input
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="Ej. Lanzamiento Marca X"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 min-[1001px]:grid-cols-[1.6fr_1fr]">
            <Field label="Cliente">
              <Dropdown
                value={form.clienteId}
                onChange={(v) => set("clienteId", v)}
                placeholder="Elige un cliente"
                options={clientes.map((c) => ({ value: c.id, label: c.nombre }))}
              />
            </Field>
            <Field label="Fecha del evento">
              <Input type="date" value={form.fechaEvento} onChange={(e) => set("fechaEvento", e.target.value)} />
            </Field>
          </div>

          <Row cols={2}>
            <Field label="Tipo de proyecto">
              <Dropdown
                value={form.tipoProyecto}
                onChange={(v) => set("tipoProyecto", v)}
                placeholder="Elige un tipo"
                options={withCurrent(TIPO_BASE, form.tipoProyecto).map((t) => ({ value: t, label: t }))}
              />
            </Field>
            <Field label="Prioridad">
              <Dropdown
                value={form.prioridad}
                onChange={(v) => set("prioridad", v)}
                placeholder="Elige prioridad"
                options={withCurrent(PRIORIDAD_BASE, form.prioridad).map((p) => ({ value: p, label: p }))}
              />
            </Field>
          </Row>

          <Row cols={2}>
            <Field label="Ciudad del evento">
              {/* Alicia 2026-09-09: este campo se veía más bajito que el dropdown de al lado --
                  h-10 lo iguala a la altura fija (40px) del botón de Dropdown. */}
              <Input value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} placeholder="Bogotá" className="h-10" />
            </Field>
            <Field label="Sede de Next a cargo">
              <Dropdown
                value={form.sedeNext}
                onChange={(v) => set("sedeNext", v)}
                placeholder="Elige sede"
                options={withCurrent(SEDE_BASE, form.sedeNext).map((s) => ({ value: s, label: s }))}
              />
            </Field>
          </Row>

          {/* Alicia 2026-09-18: "fecha de solicitud" y "persona de contacto" van uno al lado del
              otro, no apilados -- mismo criterio que factura/fecha de pago más abajo. Alicia
              2026-09-09: "contacto en el cliente" no era claro -- renombrado a "Persona de
              contacto" (mismo nombre de campo que ya usa Clientes para lo mismo). */}
          <Row cols={2}>
            <Field label="Fecha de solicitud">
              <Input type="date" value={form.fechaSolicitud} onChange={(e) => set("fechaSolicitud", e.target.value)} />
            </Field>
            <Field label="Persona de contacto">
              <Input
                value={form.contactoProyecto}
                onChange={(e) => set("contactoProyecto", e.target.value)}
                placeholder="Nombre y apellido"
              />
            </Field>
          </Row>
        </FormDrawerSection>

        <FormDrawerSection number="02" title="Estado">
          <Row cols={2}>
            <Field label="Estado del proyecto" required error={errors.estadoId}>
              <Dropdown
                value={form.estadoId}
                onChange={(v) => set("estadoId", v)}
                placeholder="Elige un estado"
                groups={estadoGroups}
              />
            </Field>
            <Field label="Estado del brief">
              <Dropdown
                value={form.estadoBrief}
                onChange={(v) => set("estadoBrief", v || BRIEF_ESTADOS[0])}
                placeholder="Elige un estado"
                options={BRIEF_ESTADOS.map((b) => ({ value: b, label: b }))}
              />
            </Field>
          </Row>

          {/* Alicia 2026-09-18: "estado de la propuesta" ocupaba una fila entera para un dropdown
              angosto -- ahora comparte fila con "Pagado", que antes quedaba suelto abajo. */}
          <Row cols={2}>
            <Field label="Estado de la propuesta">
              <Dropdown
                value={form.propuestaEstado}
                onChange={(v) => set("propuestaEstado", v || PROPUESTA_ESTADOS[0])}
                placeholder="Elige un estado"
                options={withCurrent(PROPUESTA_ESTADOS, form.propuestaEstado).map((p) => ({ value: p, label: p }))}
              />
            </Field>
            <label className="flex h-10 w-fit cursor-pointer items-center gap-2 self-end whitespace-nowrap pb-2.5 text-sm font-medium text-text">
              <input
                type="checkbox"
                checked={form.pagado}
                onChange={(e) => set("pagado", e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-teal-mid"
              />
              Pagado
            </label>
          </Row>
          {/* Alicia 2026-09-09: "número de factura y fecha de pago pueden ir uno al lado del otro". */}
          <Row cols={2}>
            <Field label="N.º de factura">
              <Input value={form.numeroFactura} onChange={(e) => set("numeroFactura", e.target.value)} placeholder="Ej. FAC-2026-0000" />
            </Field>
            <Field label="Fecha de pago" error={errors.fechaPago}>
              <Input type="date" value={form.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} />
            </Field>
          </Row>
        </FormDrawerSection>

        <FormDrawerSection number="03" title="Equipo">
          {/* Alicia 2026-09-09: "solamente hay que buscar el nombre del miembro del equipo a
              agregar. No es necesario elegir un rol" -- buscar y elegir ya lo agrega, sin rol. La
              lista de opciones (equipoUsuarios) ya viene del backend filtrada a rol miembro/manager
              (Director): administradores y superadministradores no participan de un equipo. */}
          <Field label="Miembros del equipo">
            <div className="flex flex-col gap-2">
              {form.equipo.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.equipo.map((m, idx) => (
                    <span
                      key={m.id ?? idx}
                      className="inline-flex items-center gap-1.5 rounded-[20px] bg-gray-light py-1.5 pl-3 pr-1.5 text-[13px]"
                    >
                      {m.nombre}
                      <button
                        type="button"
                        onClick={() => removeMiembro(idx)}
                        aria-label="Quitar miembro"
                        className="flex h-[18px] w-[18px] flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-2 hover:bg-black/10 hover:text-red"
                      >
                        <X size={11} strokeWidth={2.4} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Dropdown
                value=""
                onChange={addMiembro}
                placeholder="Buscar y agregar por nombre…"
                options={miembrosDisponibles.map((u) => ({ value: u.id, label: `${u.nombre} ${u.apellido}` }))}
              />
            </div>
          </Field>

          {puedeAsignarGerente && (
            // Alicia 2026-09-09: "ya teniendo los nombres ya seleccionados de los miembros de
            // equipo, ahí sí ya va a aparecer el select... no sería el líder, sino el líder de
            // equipo" -- reemplaza a "Gerente responsable"; las opciones salen solo de quienes ya
            // se agregaron arriba (`liderOptions`, que además reconcilia un líder ya guardado de
            // antes que ya no esté en la lista de equipo actual).
            <Field label="Líder de equipo" hint={<div className="mt-1.5 text-xs text-text-3">Si lo dejas vacío, se te asigna a ti.</div>}>
              <Dropdown
                value={form.gerenteId}
                onChange={(v) => set("gerenteId", v)}
                placeholder={equipoSeleccionado.length === 0 ? "Agrega miembros al equipo primero" : "Auto-asignar"}
                options={liderOptions.map((u) => ({ value: u.id, label: `${u.nombre} ${u.apellido}` }))}
              />
            </Field>
          )}
        </FormDrawerSection>

        <FormDrawerSection number="04" title="Proveedores">
          <Field label="Proveedores trabajando en este proyecto">
            <ProviderPicker providers={providers} selectedIds={selectedIds} onToggle={toggleProvider} />
          </Field>
        </FormDrawerSection>

        {/* Alicia 2026-09-18: notas internas en su propia sección, separada de proveedores --
            antes vivían juntas y no tenía nada que ver una con la otra. */}
        <FormDrawerSection number="05" title="Notas internas">
          {/* Alicia 2026-09-09: "más espacio para las notas internas, es importante para todo,
              proveedor, clientes y proyectos" -- !min-h-[...] para pisar el min-h-[72px] por
              defecto del Textarea compartido (mismo patrón de !bg-surface ya usado en este archivo). */}
          <Field label="Notas internas">
            <Textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Detalles, alcance, condiciones…" className="!min-h-[140px]" />
          </Field>
        </FormDrawerSection>

        <FormDrawerSection number="06" title="Archivos y enlaces">
          {/* Alicia 2026-09-10: apenas se abre el formulario ya se puede arrastrar un archivo o
              agregar un link, sin esperar a darle "Registrar proyecto" -- ver PendingAttachment
              en EntityAttachments.tsx. */}
          <EntityAttachments
            entityId={editing?.id ?? null}
            api={proyectoAdjuntosApi}
            pending={pendingAdjuntos}
            onPendingChange={onPendingAdjuntosChange}
          />
        </FormDrawerSection>
      </FormDrawerBody>

      <FormDrawerFooter>
        {editing && onDelete && (
          <div className="mr-auto">
            <DeleteOrRequestButton tipoEntidad="proyecto" entidadId={editing.id} nombre={editing.nombre} onDelete={onDelete} />
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="h-11 cursor-pointer rounded-[var(--radius-md)] border border-border bg-transparent px-4 text-sm font-medium text-text transition-colors hover:border-text hover:bg-bg"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="h-11 cursor-pointer rounded-[var(--radius-md)] bg-teal-mid px-5 text-sm font-medium text-white transition-colors hover:bg-green hover:text-text"
        >
          {editing ? "Guardar cambios" : "Registrar proyecto"}
        </button>
      </FormDrawerFooter>
    </Drawer>
  );
}
