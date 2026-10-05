"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, AtSign, KeyRound, ShieldCheck, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge, Button, Dropdown } from "@/components/ui/primitives";
import { Field, Input, Row } from "@/components/ui/form";
import { CUENTA_ACTIVA_COLOR, CUENTA_INACTIVA_COLOR, ROLES_ASIGNABLES } from "@/lib/constants";
import { inicialesPersona } from "@/lib/format";
import type { Rol, Usuario, UsuarioUpdateInput } from "@/types/api";
import { useRolLabels } from "@/store/config-store";

/* Hallmark · component: modal · genre: modern-minimal · theme: proyecto (tokens de globals.css)
 * states: default · hover · focus · active · disabled · loading · error · success
 * pre-emit critique: P4 H5 E4 S5 R5 V4
 */

/**
 * Editar a alguien del equipo -- exclusivo del super administrador (Nexit_Back/docs/06).
 *
 * Sin campo de iniciales: se arman solas con la primera letra del nombre y la del apellido, y la
 * tarjeta de arriba las muestra en vivo mientras se escribe.
 *
 * Sobre la PROPIA cuenta, el rol y "cuenta activa" salen deshabilitados: nadie puede desactivarse ni
 * quitarse a sí mismo el rol de super administrador, o el sistema se quedaría sin nadie capaz de
 * administrar usuarios. No lleva ningún párrafo explicándolo -- para eso están las validaciones y el
 * control apagado; quien administra ya lo sabe. Nombre, apellido e iniciales sí se editan sobre uno
 * mismo.
 */
export function UsuarioFormModal({
  open,
  onClose,
  onSave,
  editing,
  esMiPropiaCuenta = false,
  enLinea = false,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (id: string, input: UsuarioUpdateInput) => void;
  editing: Usuario | null;
  esMiPropiaCuenta?: boolean;
  enLinea?: boolean;
}) {
  const rolLabels = useRolLabels();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [rol, setRol] = useState<Rol>("miembro");
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !editing) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el formulario según el usuario que se abrió a editar
    setNombre(editing.nombre);
    setApellido(editing.apellido);
    setRol(editing.rol);
    setActivo(editing.activo);
    setError(null);
  }, [open, editing]);

  function handleSave() {
    if (!editing) return;
    if (!nombre.trim() || !apellido.trim()) {
      setError("El nombre y el apellido son obligatorios.");
      return;
    }
    onSave(editing.id, {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      rol,
      // Las iniciales se arman solas con la primera letra del nombre y la del apellido -- no hay
      // campo para escribirlas, así que se manda null para que no quede un valor viejo colgado.
      iniciales: null,
      activo,
    });
  }

  if (!editing) return null;

  // Vista previa en vivo del avatar: refleja lo que se está escribiendo, no lo que hay guardado.
  const inicialesPreview = inicialesPersona(nombre, apellido);
  const cuentaColor = activo ? CUENTA_ACTIVA_COLOR : CUENTA_INACTIVA_COLOR;

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth={560}
      eyebrow="Equipo"
      title={esMiPropiaCuenta ? "Editar mi perfil" : "Editar usuario"}
      description={
        esMiPropiaCuenta
          ? "Tus datos. El rol y el acceso no se editan desde tu propia cuenta."
          : "Sus datos, su rol y si puede entrar al sistema."
      }
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave}>
            Guardar cambios
          </Button>
        </>
      }
    >
      {/* Tarjeta de identidad: quién se está editando, sin tener que deducirlo de los campos. */}
      <div className="mb-5 flex items-center gap-3.5 rounded-[var(--radius-lg)] border border-border bg-gray-light px-4 py-3.5">
        <div className="relative">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-text text-[15px] font-semibold text-green">
            {inicialesPreview}
          </div>
          {enLinea && (
            <span
              aria-hidden
              title="En línea ahora"
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-gray-light bg-success"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight">
            {`${nombre} ${apellido}`.trim() || "Sin nombre"}
          </div>
          <div className="truncate text-[12px] text-text-3">{editing.email}</div>
        </div>
        <Badge bg={cuentaColor.bg} color={cuentaColor.c}>
          {activo ? "Activa" : "Desactivada"}
        </Badge>
      </div>

      <Row>
        <Field label="Nombre" icon={User} required>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
        <Field label="Apellido" required>
          <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
        </Field>
      </Row>
      <Field label="Correo" icon={AtSign} required>
        <Input value={editing.email} disabled readOnly />
      </Field>
      <Row>
        <Field label="Rol" icon={ShieldCheck}>
          <Dropdown
            value={rol}
            onChange={(v) => setRol(v as Rol)}
            placeholder="Elige un rol"
            options={ROLES_ASIGNABLES.map((r) => ({ value: r, label: rolLabels[r] }))}
            disabled={esMiPropiaCuenta}
            disabledHint={rolLabels[rol]}
          />
        </Field>
        <Field label="Acceso al sistema" icon={KeyRound}>
          <label
            className={`flex h-10 items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-[13px] ${
              esMiPropiaCuenta ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:border-text-3"
            }`}
          >
            <input
              type="checkbox"
              checked={activo}
              disabled={esMiPropiaCuenta}
              onChange={(e) => setActivo(e.target.checked)}
              className="h-[15px] w-[15px] flex-shrink-0 accent-teal-mid disabled:cursor-not-allowed"
            />
            Cuenta activa
          </label>
        </Field>
      </Row>

      {!activo && !esMiPropiaCuenta && (
        // docs/17: desactivar arranca un conteo de 30 días; reactivar antes lo cancela por completo.
        <div className="mt-1 flex items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-red-light px-3.5 py-3 text-[12px] leading-[1.5] text-text-2">
          <AlertTriangle size={15} strokeWidth={2} className="mt-px flex-shrink-0 text-red" />
          <span>
            Al guardar pierde el acceso. Si nadie la reactiva, a los <strong className="text-text">30 días</strong> el
            sistema elimina la cuenta sola, dejando un respaldo interno. Reactivarla antes de ese plazo lo cancela por
            completo.
          </span>
        </div>
      )}

      {error && (
        <div className="mt-1 flex items-start gap-2 rounded-[var(--radius-md)] border border-red bg-red-light px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-red">
          <AlertTriangle size={15} strokeWidth={2} className="mt-px flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </Modal>
  );
}
