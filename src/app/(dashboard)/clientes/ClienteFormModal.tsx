"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Phone, X } from "lucide-react";
import { Drawer, FormDrawerBody, FormDrawerFooter, FormDrawerHeader, FormDrawerSection } from "@/components/ui/Drawer";
import { Dropdown } from "@/components/ui/primitives";
import { DeleteOrRequestButton } from "@/components/ui/DeleteAction";
import { EntityAttachments, type PendingAttachment } from "@/components/ui/EntityAttachments";
import { Field, Input, Row, Textarea } from "@/components/ui/form";
import { CLIENTE_ESTADOS } from "@/lib/constants";
import { parseCSVFirstRow } from "@/lib/csv";
import { clearFormDraft, readFormDraft, useFormDraftAutosave } from "@/lib/use-form-draft";
import { clienteAdjuntosApi } from "@/services/api/cliente-adjuntos-service";
import { useCatalogosStore } from "@/store/catalogos-store";
import { useUiStore } from "@/store/ui-store";
import type { Cliente, ClienteEmail, ClienteInput, ClienteTelefono } from "@/types/api";

interface FormState {
  nombre: string;
  sector: string;
  paisId: string;
  regionId: string;
  ciudadId: string;
  estado: string;
  etapaId: string;
  ciudad: string;
  direccion: string;
  web: string;
  contacto: string;
  cargoContacto: string;
  valorReferencia: string;
  notas: string;
  telefonos: ClienteTelefono[];
  emails: ClienteEmail[];
}

const emptyForm: FormState = {
  nombre: "",
  sector: "",
  paisId: "",
  regionId: "",
  ciudadId: "",
  estado: CLIENTE_ESTADOS[0],
  etapaId: "",
  ciudad: "",
  direccion: "",
  web: "",
  contacto: "",
  cargoContacto: "",
  valorReferencia: "",
  notas: "",
  telefonos: [],
  emails: [],
};

const ESTADO_OPTIONS = CLIENTE_ESTADOS.map((e) => ({ value: e, label: e }));

export function ClienteFormModal({
  open,
  onClose,
  onSave,
  onDelete,
  editing,
  pendingAdjuntos,
  onPendingAdjuntosChange,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: ClienteInput) => void;
  /** Solo se usa (y solo se muestra "Eliminar") cuando `editing` no es null: un cliente
   * nuevo, todavía sin guardar, no tiene nada que eliminar. */
  onDelete?: () => void;
  editing: Cliente | null;
  /** Archivos/links agregados en el formulario ANTES de guardar (Alicia 2026-09-10: deben
   * poder agregarse apenas se abre "Nuevo cliente", no solo después de registrar) -- vive en
   * el `page.tsx` para que sobreviva si este modal se remonta. Se ignora si `editing` no es
   * null (ahí "Archivos y enlaces" ya trabaja en vivo contra el id real). */
  pendingAdjuntos: PendingAttachment[];
  onPendingAdjuntosChange: (next: PendingAttachment[]) => void;
}) {
  const { paises, regionesPorPais, ciudadesPorRegion, fetchBase, fetchRegiones, fetchCiudades } = useCatalogosStore();
  const pushToast = useUiStore((s) => s.pushToast);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const [telDraft, setTelDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");

  useEffect(() => {
    if (open) fetchBase();
  }, [open, fetchBase]);

  // Autoguardado (Alicia 2026-09-07): una key por cliente (o "nuevo" para el
  // formulario en blanco) -- así el borrador de uno no se mezcla con el de otro.
  const draftKey = editing ? `cliente:${editing.id}` : "cliente:nuevo";

  useEffect(() => {
    if (!open) return;
    const base: FormState = editing
      ? {
          nombre: editing.nombre,
          sector: editing.sector ?? "",
          paisId: editing.paisId ?? "",
          regionId: editing.regionId ?? "",
          ciudadId: editing.ciudadId ?? "",
          estado: editing.estado,
          etapaId: editing.etapaId ?? "",
          ciudad: editing.ciudad ?? "",
          direccion: editing.direccion ?? "",
          web: editing.web ?? "",
          contacto: editing.contacto ?? "",
          cargoContacto: editing.cargoContacto ?? "",
          valorReferencia: editing.valorReferencia ?? "",
          notas: editing.notas ?? "",
          telefonos: editing.telefonos.length > 0 ? editing.telefonos : [],
          emails: editing.emails.length > 0 ? editing.emails : [],
        }
      : emptyForm;
    // Si hay un borrador guardado (se cerró el formulario sin guardar la
    // última vez) y es distinto de los datos ya guardados, se restaura en
    // vez del formulario en blanco/original.
    const draft = readFormDraft<FormState>(draftKey);
    if (draft && JSON.stringify(draft) !== JSON.stringify(base)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaurando un borrador guardado, no una sincronización derivable sin efecto
      setForm(draft);
      pushToast("Recuperamos un borrador sin guardar de este formulario.", "info");
    } else {
       
      setForm(base);
    }
    if (editing?.paisId) fetchRegiones(editing.paisId);
    if (editing?.regionId) fetchCiudades(editing.regionId);
    setErrors({});
    setTelDraft("");
    setEmailDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftKey se deriva de `editing`, y pushToast es estable
  }, [open, editing, fetchRegiones, fetchCiudades]);

  useFormDraftAutosave(open ? draftKey : null, form, open);

  const regionOptions = useMemo(() => regionesPorPais[form.paisId] ?? [], [regionesPorPais, form.paisId]);
  const cityOptions = useMemo(() => ciudadesPorRegion[form.regionId] ?? [], [ciudadesPorRegion, form.regionId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePaisChange(paisId: string) {
    set("paisId", paisId);
    set("regionId", "");
    set("ciudadId", "");
    if (paisId) fetchRegiones(paisId);
  }

  function handleRegionChange(regionId: string) {
    set("regionId", regionId);
    set("ciudadId", "");
    if (regionId) fetchCiudades(regionId);
  }

  function addTelefono() {
    const value = telDraft.trim();
    if (!value) return;
    set("telefonos", [...form.telefonos, { telefono: value, etiqueta: "" }]);
    setTelDraft("");
  }

  function removeTelefono(idx: number) {
    set(
      "telefonos",
      form.telefonos.filter((_, i) => i !== idx),
    );
  }

  function addEmail() {
    const value = emailDraft.trim();
    if (!value) return;
    set("emails", [...form.emails, { email: value, etiqueta: "" }]);
    setEmailDraft("");
  }

  function removeEmail(idx: number) {
    set(
      "emails",
      form.emails.filter((_, i) => i !== idx),
    );
  }

  /**
   * "Importar datos" (header del drawer) -- rellena el formulario abierto desde la
   * primera fila de un CSV. A diferencia del "Excel" de la barra superior (que crea
   * muchos clientes de una vez), esto es para un solo registro: útil cuando la
   * información ya vive en una hoja de cálculo con una fila por cliente. País/
   * departamento/ciudad no se rellenan porque el CSV trae nombres, no los ids del
   * catálogo -- esos tres se siguen eligiendo a mano.
   */
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
      setForm((f) => ({
        ...f,
        nombre: pick("nombre", "empresa", "cliente") ?? f.nombre,
        sector: pick("sector", "industria") ?? f.sector,
        estado: pick("estado") ?? f.estado,
        contacto: pick("contacto", "persona", "personadecontacto") ?? f.contacto,
        cargoContacto: pick("cargo", "cargocontacto") ?? f.cargoContacto,
        direccion: pick("direccion", "dirección") ?? f.direccion,
        web: pick("web", "sitioweb", "sitio web") ?? f.web,
        valorReferencia: pick("valorreferencia", "valor de referencia", "valor") ?? f.valorReferencia,
        notas: pick("notas") ?? f.notas,
      }));
      const tel = pick("telefono", "teléfono", "telefonos", "teléfonos");
      if (tel) setTelDraft(tel);
      // Al igual que el teléfono, solo se rellena el campo de "agregar" -- no se agrega solo a la
      // lista -- así la persona revisa antes de confirmar.
      const correo = pick("email", "correo");
      if (correo) setEmailDraft(correo);
      pushToast("Datos importados. Revisa los campos y guarda.", "info");
    };
    reader.readAsText(file);
  }

  function handleSave() {
    const nextErrors: Record<string, string> = {};
    if (!form.nombre.trim()) nextErrors.nombre = "El nombre del cliente es requerido";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      pushToast(`Falta completar: ${Object.values(nextErrors).join(" · ")}`, "danger");
      panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // "ciudad" (texto libre) se conserva sincronizada con la ciudad de catálogo elegida --
    // así cualquier pantalla que todavía no resuelva ciudadId (ej. el Excel exportado) sigue
    // mostrando algo legible. Si no se eligió ciudad de catálogo, se respeta lo que ya hubiera.
    const ciudadCatalogoNombre = cityOptions.find((c) => c.id === form.ciudadId)?.nombre;
    const input: ClienteInput = {
      nombre: form.nombre.trim(),
      sector: form.sector.trim() || null,
      paisId: form.paisId || null,
      regionId: form.regionId || null,
      ciudadId: form.ciudadId || null,
      // Defensivo: al crear, el dropdown de estado ni siquiera se muestra (ver sección "Quién
      // es" arriba), pero esto asegura que un cliente nuevo nunca se guarde en otro estado
      // aunque `form.estado` se hubiera quedado con un valor de una edición anterior.
      estado: editing ? form.estado : CLIENTE_ESTADOS[0],
      etapaId: form.etapaId || null,
      ciudad: ciudadCatalogoNombre ?? (form.ciudad.trim() || null),
      direccion: form.direccion.trim() || null,
      web: form.web.trim() || null,
      contacto: form.contacto.trim() || null,
      cargoContacto: form.cargoContacto.trim() || null,
      valorReferencia: form.valorReferencia.trim() || null,
      notas: form.notas.trim() || null,
      telefonos: form.telefonos.filter((t) => t.telefono.trim()),
      emails: form.emails.filter((e) => e.email.trim()),
    };
    clearFormDraft(draftKey);
    onSave(input);
  }

  return (
    <Drawer open={open} onClose={onClose} panelRef={panelRef}>
      <FormDrawerHeader
        eyebrow={editing ? "Editar cliente" : "Registrar cliente"}
        title={editing ? editing.nombre || "Datos del cliente" : "Datos del nuevo cliente"}
        onClose={onClose}
        onImportFile={handleImportFile}
      />

      <FormDrawerBody>
        <FormDrawerSection number="01" title="Quién es">
          {/* Alicia 2026-09-19: "nombre de la empresa" al lado de "industria", no una arriba de
              la otra -- antes, al editar, nombre iba junto a estado e industria quedaba suelta
              abajo; ahora nombre+industria van siempre juntas, y estado (solo aplica al editar)
              pasa a su propia fila. */}
          <div className="grid grid-cols-1 gap-3 min-[1001px]:grid-cols-[1.6fr_1fr]">
            <Field label="Nombre de la empresa" required error={errors.nombre}>
              <Input
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Ej. Grupo Vitalis"
              />
            </Field>
            <Field label="Industria">
              <Input
                value={form.sector}
                onChange={(e) => set("sector", e.target.value)}
                placeholder="Consumo masivo, tecnología, finanzas…"
              />
            </Field>
          </div>
          {editing && (
            // Un cliente nuevo siempre entra como "Activo" -- el estado (Prospecto/Inactivo) solo
            // se decide después, al editarlo, no en el momento de registrarlo (Alicia 2026-09-18,
            // "ya sabemos que va a quedar activo, no hace falta decirlo").
            <Field label="Estado">
              <Dropdown
                value={form.estado}
                onChange={(v) => set("estado", v || CLIENTE_ESTADOS[0])}
                placeholder="Elige un estado"
                options={ESTADO_OPTIONS}
              />
            </Field>
          )}
        </FormDrawerSection>

        <FormDrawerSection number="02" title="Dónde está">
          <Row cols={3}>
            <Field label="País">
              <Dropdown
                value={form.paisId}
                onChange={handlePaisChange}
                placeholder="Seleccionar…"
                options={paises.map((p) => ({ value: p.id, label: p.nombre }))}
              />
            </Field>
            <Field label={paises.find((p) => p.id === form.paisId)?.etiquetaRegion || "Departamento"}>
              <Dropdown
                value={form.regionId}
                onChange={handleRegionChange}
                placeholder="Seleccionar…"
                disabled={!form.paisId}
                disabledHint="— elige país primero —"
                options={regionOptions.map((r) => ({ value: r.id, label: r.nombre }))}
              />
            </Field>
            <Field label="Ciudad">
              <Dropdown
                value={form.ciudadId}
                onChange={(v) => set("ciudadId", v)}
                placeholder="Seleccionar…"
                disabled={!form.regionId}
                disabledHint="— elige departamento primero —"
                options={cityOptions.map((c) => ({ value: c.id, label: c.nombre }))}
              />
            </Field>
          </Row>
          <Row cols={2}>
            <Field label="Dirección">
              <Input value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Dirección" />
            </Field>
            <Field label="Sitio web">
              <Input value={form.web} onChange={(e) => set("web", e.target.value)} placeholder="https://…" />
            </Field>
          </Row>
        </FormDrawerSection>

        <FormDrawerSection number="03" title="Con quién se habla">
          <div className="grid grid-cols-1 gap-3 min-[1001px]:grid-cols-[1.6fr_1fr]">
            <Field label="Persona de contacto">
              <Input value={form.contacto} onChange={(e) => set("contacto", e.target.value)} placeholder="Nombre y apellido" />
            </Field>
            <Field label="Cargo">
              <Input
                value={form.cargoContacto}
                onChange={(e) => set("cargoContacto", e.target.value)}
                placeholder="Ej. Directora de Mercadeo"
              />
            </Field>
          </div>

          {/* Alicia 2026-09-09: "el teléfono y el correo lo podrías acomodar uno al lado del
              otro" -- antes cada uno era un Field de ancho completo, uno debajo del otro; con
              Row quedan lado a lado igual que "Persona de contacto"/"Cargo" arriba. */}
          <Row cols={2}>
            <Field label="Teléfonos" icon={Phone}>
              <div className="flex flex-col gap-2">
                {form.telefonos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.telefonos.map((t, idx) => (
                      <span
                        key={t.id ?? idx}
                        className="inline-flex items-center gap-1.5 rounded-[20px] bg-gray-light py-1.5 pl-3 pr-1.5 text-[13px]"
                      >
                        {t.telefono}
                        {t.etiqueta ? ` · ${t.etiqueta}` : ""}
                        <button
                          type="button"
                          onClick={() => removeTelefono(idx)}
                          aria-label="Quitar teléfono"
                          className="flex h-[18px] w-[18px] flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-2 hover:bg-black/10 hover:text-red"
                        >
                          <X size={11} strokeWidth={2.4} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={telDraft}
                    onChange={(e) => setTelDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTelefono();
                      }
                    }}
                    placeholder="+57 300 000 0000"
                    className="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={addTelefono}
                    className="flex h-[46px] flex-shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-teal-mid px-4 text-sm font-medium text-white transition-colors hover:bg-green hover:text-text"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </Field>

            <Field label="Correos" icon={Mail}>
              <div className="flex flex-col gap-2">
                {form.emails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.emails.map((e, idx) => (
                      <span
                        key={e.id ?? idx}
                        className="inline-flex items-center gap-1.5 rounded-[20px] bg-gray-light py-1.5 pl-3 pr-1.5 text-[13px]"
                      >
                        {e.email}
                        {e.etiqueta ? ` · ${e.etiqueta}` : ""}
                        <button
                          type="button"
                          onClick={() => removeEmail(idx)}
                          aria-label="Quitar correo"
                          className="flex h-[18px] w-[18px] flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-2 hover:bg-black/10 hover:text-red"
                        >
                          <X size={11} strokeWidth={2.4} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addEmail();
                      }
                    }}
                    placeholder="contacto@empresa.com"
                    className="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={addEmail}
                    className="flex h-[46px] flex-shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-teal-mid px-4 text-sm font-medium text-white transition-colors hover:bg-green hover:text-text"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </Field>
          </Row>
        </FormDrawerSection>

        <FormDrawerSection number="04" title="Qué recordar">
          <Field label="Notas internas">
            <Textarea
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              placeholder="Historial, condiciones…"
              rows={7}
              style={{ minHeight: 160 }}
            />
          </Field>
        </FormDrawerSection>

        <FormDrawerSection number="05" title="Archivos y enlaces">
          <EntityAttachments
            entityId={editing?.id ?? null}
            api={clienteAdjuntosApi}
            pending={pendingAdjuntos}
            onPendingChange={onPendingAdjuntosChange}
          />
        </FormDrawerSection>
      </FormDrawerBody>

      <FormDrawerFooter>
        {editing && onDelete && (
          <div className="mr-auto">
            <DeleteOrRequestButton tipoEntidad="cliente" entidadId={editing.id} nombre={editing.nombre} onDelete={onDelete} />
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
          {editing ? "Guardar cambios" : "Registrar cliente"}
        </button>
      </FormDrawerFooter>
    </Drawer>
  );
}
