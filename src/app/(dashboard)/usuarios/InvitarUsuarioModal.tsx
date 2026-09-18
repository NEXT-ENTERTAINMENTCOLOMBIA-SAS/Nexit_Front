"use client";

/* Hallmark · component: modal · genre: modern-minimal · theme: proyecto (tokens de globals.css)
 * states: default · hover · focus · active · disabled · loading · error · success
 * pre-emit critique: P4 H5 E4 S5 R5 V4
 */

import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { AlertTriangle, AtSign, Mail, MessageSquareText, Send, ShieldCheck, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button, Dropdown } from "@/components/ui/primitives";
import { Field, Textarea } from "@/components/ui/form";
import { ROLES_ASIGNABLES, ROL_COLORS, ROL_LABELS } from "@/lib/constants";
import { DOMINIOS_CORREO_PERMITIDOS, esDominioPermitido, mensajeDominioNoPermitido } from "@/lib/dominios-correo";
import { invitacionesApi } from "@/services/api/invitaciones-service";
import { useAuthStore } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";
import type { InvitacionFallida, Rol } from "@/types/api";

/** Mismo tope que CrearInvitacionesLoteValidator en Nexit_Back -- si cambia allá, cambia acá. */
const MAXIMO_POR_LOTE = 25;

/** Lo que separa un correo del siguiente al escribir o pegar: coma, punto y coma, espacio o salto de línea. */
const SEPARADORES = /[\s,;]+/;

/** Un correo del lote junto con el rol que se le asignó al agregarlo. */
type Destinatario = { email: string; rol: Rol };

/**
 * Invitar a alguien: se le manda un correo y ella completa sus propios datos al aceptar (docs/25).
 *
 * Deliberadamente SEPARADO de registrar (`RegistrarUsuarioModal`), aunque las dos acciones den de
 * alta a una persona. Invitar es pedir; registrar es dar por hecho. Tienen campos distintos, ritmo
 * distinto y consecuencias distintas, y meterlas en un mismo formulario con pestañas obligaba a
 * entender la diferencia antes de poder ver cada una.
 *
 * El campo de correos son fichas, como el "Para" de cualquier cliente de correo: se escribe, se
 * pulsa Enter (o coma, o se pega una lista entera) y queda una ficha que se puede quitar. Sin
 * instrucciones al lado -- el gesto ya es conocido y el marcador de posición lo insinúa.
 *
 * Cada ficha lleva el color de SU rol (Alicia 2026-09-09: puede invitar en un mismo envío a gente
 * con roles distintos -- varios miembros, un admin, un directivo -- y quiere verlo de un vistazo).
 * El selector de "Rol" no es un campo del formulario completo sino el rol que se le va a poner a
 * los PRÓXIMOS correos que se escriban: se elige un rol, se agregan los correos de ese rol, se
 * cambia el rol y se agregan los siguientes -- todo dentro del mismo envío. Para corregir el rol de
 * una ficha ya agregada, se quita (la "x") y se vuelve a escribir con el rol correcto seleccionado.
 */
export function InvitarUsuarioModal({
  open,
  onClose,
  onInvitado,
}: {
  open: boolean;
  onClose: () => void;
  onInvitado: () => void;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const quienInvita = useAuthStore((s) => s.user);

  const [correos, setCorreos] = useState<Destinatario[]>([]);
  const [borrador, setBorrador] = useState("");
  const [rol, setRol] = useState<Rol>("miembro");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fallidas, setFallidas] = useState<InvitacionFallida[]>([]);
  const [enviando, setEnviando] = useState(false);

  function cerrar() {
    setCorreos([]);
    setBorrador("");
    setRol("miembro");
    setMensaje("");
    setError(null);
    setFallidas([]);
    onClose();
  }

  /**
   * Convierte lo escrito (o pegado) en fichas, con el rol seleccionado en ese momento. El dominio
   * se valida aquí para avisar de inmediato, sin ida y vuelta al servidor -- el filtro que manda
   * sigue siendo el del backend (ver src/lib/dominios-correo.ts). Los repetidos se ignoran en
   * silencio: escribir dos veces el mismo correo es un error de dedo, no una intención -- y si ya
   * estaba con otro rol, se queda con el que tenía (quitar la ficha y repetirla es cómo se corrige).
   */
  function agregar(texto: string): boolean {
    const nuevos = texto.split(SEPARADORES).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (nuevos.length === 0) return true;

    const invalido = nuevos.find((x) => !esDominioPermitido(x));
    if (invalido) {
      setError(`${invalido} · ${mensajeDominioNoPermitido()}`);
      return false;
    }
    const existentes = new Set(correos.map((c) => c.email));
    const porAgregar = [...new Set(nuevos)].filter((x) => !existentes.has(x));
    if (correos.length + porAgregar.length > MAXIMO_POR_LOTE) {
      setError(`Puedes invitar hasta ${MAXIMO_POR_LOTE} correos por envío.`);
      return false;
    }
    setCorreos([...correos, ...porAgregar.map((email) => ({ email, rol }))]);
    setError(null);
    return true;
  }

  function quitar(email: string) {
    setCorreos(correos.filter((c) => c.email !== email));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === " ") {
      e.preventDefault();
      if (agregar(borrador)) setBorrador("");
      return;
    }
    // Retroceso con el campo vacío borra la última ficha -- el gesto que ya espera cualquiera que
    // haya usado el campo "Para" de un correo.
    if (e.key === "Backspace" && borrador === "" && correos.length > 0) setCorreos(correos.slice(0, -1));
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const texto = e.clipboardData.getData("text");
    if (!SEPARADORES.test(texto)) return; // un solo correo: que siga el camino normal de escritura
    e.preventDefault();
    if (agregar(texto)) setBorrador("");
  }

  async function enviar() {
    // Lo que quedó escrito sin confirmar cuenta igual -- nadie debería perder una invitación por no
    // haber apretado Enter en el último correo.
    const pendiente = borrador.trim();
    if (pendiente && !agregar(pendiente)) return;
    const existentes = new Set(correos.map((c) => c.email));
    const pendientesNuevos = pendiente
      ? [...new Set(pendiente.split(SEPARADORES).map((x) => x.trim().toLowerCase()).filter(Boolean))].filter(
          (x) => !existentes.has(x),
        )
      : [];
    const finales: Destinatario[] = [...correos, ...pendientesNuevos.map((email) => ({ email, rol }))];

    if (finales.length === 0) return setError("Escribe al menos un correo.");
    if (!mensaje.trim()) return setError("Escribe el mensaje que va a leer quien reciba la invitación.");

    setEnviando(true);
    setError(null);
    setFallidas([]);
    try {
      const resultado = await invitacionesApi.crearLote({
        destinatarios: finales.map(({ email, rol: r }) => ({ email, rol: r })),
        mensaje: mensaje.trim(),
      });
      const enviadas = resultado.enviadas.length;
      if (enviadas > 0) {
        pushToast(enviadas === 1 ? "Invitación enviada" : `${enviadas} invitaciones enviadas`, "success");
        onInvitado();
      }
      if (resultado.fallidas.length > 0) {
        // Se queda abierto a propósito cuando algo falló: cerrar escondería justo la información
        // que hace falta para corregir. Las fichas se repueblan solo con las que no salieron, cada
        // una con el rol que tenía.
        const rolPorEmail = new Map(finales.map((f) => [f.email, f.rol]));
        setFallidas(resultado.fallidas);
        setCorreos(resultado.fallidas.map((f) => ({ email: f.email, rol: rolPorEmail.get(f.email) ?? "miembro" })));
        setBorrador("");
        if (enviadas === 0) setError("No se pudo invitar a ninguno de esos correos.");
        return;
      }
      cerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron enviar las invitaciones");
    } finally {
      setEnviando(false);
    }
  }

  const totalDestinatarios = correos.length + (borrador.trim() ? 1 : 0);
  const rolesEnUso = new Set(correos.map((c) => c.rol).concat(borrador.trim() ? [rol] : []));
  const unSoloRol = rolesEnUso.size <= 1;
  const rolDeEjemplo = rolesEnUso.size === 1 ? [...rolesEnUso][0] : rol;

  return (
    <Modal
      open={open}
      onClose={cerrar}
      maxWidth={560}
      eyebrow="Equipo"
      title="Invitar al equipo"
      description="Le llega un correo con tu mensaje. Cada quien completa sus propios datos al aceptar."
      footer={
        <>
          <Button onClick={cerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="primary" icon={Send} onClick={enviar} disabled={enviando}>
            {enviando
              ? "Enviando…"
              : totalDestinatarios > 1
                ? `Enviar ${totalDestinatarios} invitaciones`
                : "Enviar invitación"}
          </Button>
        </>
      }
    >
      <Field label="Rol" icon={ShieldCheck} hint="El rol que se le pone a los correos que agregues ahora -- cámbialo antes de escribir el siguiente grupo para mezclar roles en un mismo envío.">
        <Dropdown
          value={rol}
          onChange={(v) => setRol(v as Rol)}
          placeholder="Elige un rol"
          options={ROLES_ASIGNABLES.map((r) => ({ value: r, label: ROL_LABELS[r] }))}
        />
      </Field>

      <Field label="Para" icon={AtSign} required>
        <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-2 py-1.5 transition-colors focus-within:border-teal-mid">
          {correos.map((c) => {
            const color = ROL_COLORS[c.rol];
            return (
              <span
                key={c.email}
                style={{ backgroundColor: color.bg, color: color.c }}
                className="inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-md)] py-1 pl-2 pr-1 text-[12px]"
              >
                <span className="truncate">{c.email}</span>
                <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.04em] opacity-75">
                  {ROL_LABELS[c.rol]}
                </span>
                <button
                  type="button"
                  onClick={() => quitar(c.email)}
                  aria-label={`Quitar ${c.email}`}
                  className="flex cursor-pointer items-center rounded-[2px] p-0.5 opacity-70 transition-opacity hover:opacity-100"
                >
                  <X size={11} strokeWidth={2.4} />
                </button>
              </span>
            );
          })}
          <input
            type="email"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={() => agregar(borrador) && setBorrador("")}
            placeholder={
              correos.length === 0 ? `nombre@${DOMINIOS_CORREO_PERMITIDOS[0]}` : `otro correo (${ROL_LABELS[rol].toLowerCase()})…`
            }
            className="min-w-[170px] flex-1 border-0 bg-transparent py-1 text-[13px] text-text outline-none placeholder:text-text-3"
          />
        </div>
        {correos.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-2">
            {ROLES_ASIGNABLES.map((r) => {
              const n = correos.filter((c) => c.rol === r).length;
              if (n === 0) return null;
              const color = ROL_COLORS[r];
              return (
                <span key={r} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color.c }} />
                  {n} como {ROL_LABELS[r]}
                </span>
              );
            })}
          </div>
        )}
      </Field>

      <Field label="Mensaje" icon={MessageSquareText} required>
        <Textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={500}
          placeholder="Bienvenida al equipo. Cualquier duda me escribes."
        />
      </Field>

      {/* Lo que de verdad va a leer la otra persona, con el nombre real de quien invita. No es
          adorno: es la única forma de darse cuenta de que el mensaje quedó cortante antes de
          mandarlo a cinco personas a la vez. Cuando hay roles mezclados en el envío, no se puede
          mostrar un solo ejemplo real -- se avisa en vez de inventar uno. */}
      {mensaje.trim() && (
        <div className="rounded-[var(--radius-md)] border border-border bg-bg p-3.5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-3">Le llegará así</div>
          <div className="flex gap-2.5">
            <span
              aria-hidden
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-text-2"
            >
              <Mail size={13} strokeWidth={1.9} />
            </span>
            <div className="min-w-0 text-[12.5px] leading-[1.5]">
              <div className="font-medium text-text">
                {quienInvita?.displayName ?? "Alguien del equipo"} te invitó a Nexit
                {unSoloRol ? ` como ${ROL_LABELS[rolDeEjemplo].toLowerCase()}` : " -- cada quien verá el rol que le asignaste"}
              </div>
              <div className="mt-0.5 text-text-2">“{mensaje.trim()}”</div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3.5 flex items-start gap-2 rounded-[var(--radius-md)] border border-red bg-red-light px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-red"
        >
          <AlertTriangle size={15} strokeWidth={2} className="mt-px flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {fallidas.length > 0 && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-border bg-red-light px-3.5 py-3">
          <div className="mb-1.5 text-[12px] font-semibold text-red">
            {fallidas.length === 1 ? "Un correo no se pudo invitar" : `${fallidas.length} correos no se pudieron invitar`}
          </div>
          <ul className="flex flex-col gap-1 text-[12px] leading-[1.45] text-text-2">
            {fallidas.map((f) => (
              <li key={f.email}>
                <span className="font-medium text-text">{f.email}</span> — {f.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
