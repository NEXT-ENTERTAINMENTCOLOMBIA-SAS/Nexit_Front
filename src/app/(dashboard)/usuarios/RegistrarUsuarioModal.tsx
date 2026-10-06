"use client";

/* Hallmark · component: modal · genre: modern-minimal · theme: proyecto (tokens de globals.css)
 * states: default · hover · focus · active · disabled · loading · error · success
 * pre-emit critique: P4 H5 E4 S5 R5 V4
 */

import { useState } from "react";
import { AlertTriangle, AtSign, KeyRound, ShieldCheck, User, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button, Dropdown } from "@/components/ui/primitives";
import { Field, Input, Row } from "@/components/ui/form";
import { ROLES_ASIGNABLES } from "@/lib/constants";
import { inicialesPersona } from "@/lib/format";
import { DOMINIOS_CORREO_PERMITIDOS, esDominioPermitido, mensajeDominioNoPermitido } from "@/lib/dominios-correo";
import { usuariosApi } from "@/services/api/usuarios-service";
import { useUiStore } from "@/store/ui-store";
import type { Rol } from "@/types/api";
import { useRolLabels } from "@/store/config-store";

/**
 * Dar de alta a alguien de una vez, sin correo de invitación de por medio: el backend crea su cuenta
 * en Supabase Auth y su perfil en un solo paso (`POST /api/usuarios/registrar`, docs/38).
 *
 * Separado de invitar a propósito -- son dos actos distintos. Invitar es pedirle a alguien que se
 * sume; registrar es darlo por hecho, así que aquí SÍ hay que escribir su nombre y su apellido, y no
 * hay mensaje que redactar.
 *
 * No hay campo de iniciales: se arman solas con la primera letra del nombre y la del apellido, y la
 * vista previa de aquí abajo las muestra mientras se escribe.
 */
export function RegistrarUsuarioModal({
  open,
  onClose,
  onRegistrado,
}: {
  open: boolean;
  onClose: () => void;
  onRegistrado: () => void;
}) {
  const rolLabels = useRolLabels();
  const pushToast = useUiStore((s) => s.pushToast);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState<Rol>("miembro");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function cerrar() {
    setNombre("");
    setApellido("");
    setCorreo("");
    setRol("miembro");
    setError(null);
    onClose();
  }

  async function registrar() {
    if (!nombre.trim() || !apellido.trim()) return setError("El nombre y el apellido son obligatorios.");
    if (!correo.trim()) return setError("El correo es obligatorio.");
    if (!esDominioPermitido(correo)) return setError(mensajeDominioNoPermitido());

    setGuardando(true);
    setError(null);
    try {
      await usuariosApi.registrar({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: correo.trim().toLowerCase(),
        rol,
      });
      pushToast(`${nombre.trim()} ya tiene acceso a Nexit`, "success");
      onRegistrado();
      cerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar a esta persona");
    } finally {
      setGuardando(false);
    }
  }

  const iniciales = inicialesPersona(nombre, apellido);
  const nombreCompleto = `${nombre} ${apellido}`.trim();

  return (
    <Modal
      open={open}
      onClose={cerrar}
      maxWidth={560}
      eyebrow="Equipo"
      title="Registrar usuario"
      description="Queda con acceso de inmediato, sin esperar a que responda ningún correo."
      footer={
        <>
          <Button onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" icon={UserPlus} onClick={registrar} disabled={guardando}>
            {guardando ? "Creando…" : "Crear usuario"}
          </Button>
        </>
      }
    >
      <Row>
        <Field label="Nombre" icon={User} required>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="María" autoComplete="off" />
        </Field>
        <Field label="Apellido" required>
          <Input value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Restrepo" autoComplete="off" />
        </Field>
      </Row>

      <Row>
        <Field label="Correo" icon={AtSign} required>
          <Input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder={`nombre@${DOMINIOS_CORREO_PERMITIDOS[0]}`}
            autoComplete="off"
          />
        </Field>
        <Field label="Rol" icon={ShieldCheck}>
          <Dropdown
            value={rol}
            onChange={(v) => setRol(v as Rol)}
            placeholder="Elige un rol"
            options={ROLES_ASIGNABLES.map((r) => ({ value: r, label: rolLabels[r] }))}
          />
        </Field>
      </Row>

      {/* Cómo va a aparecer en la lista: el avatar con sus iniciales armadas solas. Es también la
          respuesta silenciosa a "¿y dónde pongo las iniciales?". */}
      {(nombre.trim() || apellido.trim()) && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-bg px-3.5 py-3">
          <span
            aria-hidden
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-ink text-[12px] font-semibold text-green"
          >
            {iniciales}
          </span>
          <div className="min-w-0 text-[12.5px] leading-[1.45]">
            <div className="truncate font-medium text-text">{nombreCompleto}</div>
            <div className="truncate text-text-2">
              {correo.trim() || "sin correo todavía"} · {rolLabels[rol]}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3.5 flex gap-2.5 rounded-[var(--radius-md)] border border-border bg-bg px-3.5 py-3">
        <span
          aria-hidden
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-text-2"
        >
          <KeyRound size={13} strokeWidth={1.9} />
        </span>
        <p className="text-[12.5px] leading-[1.5] text-text-2">
          La primera vez pide su código de seguridad en la pantalla de inicio de sesión y crea su contraseña.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3.5 flex items-start gap-2 rounded-[var(--radius-md)] border border-red bg-red-light px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-red"
        >
          <AlertTriangle size={15} strokeWidth={2} className="mt-px flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </Modal>
  );
}
